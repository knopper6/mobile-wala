const { query, withTransaction } = require("../../db/query");
const asyncHandler = require("../../utils/async-handler");
const { AppError, notFound } = require("../../utils/errors");
const { getLotById, getMaskedBidHistory, listLots } = require("./lots.repository");

function publicLotResponse(lot, bids = undefined) {
  return {
    ...lot,
    listingText: [
      lot.title,
      ...lot.variants
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((variant) => {
          const grade = variant.gradeLabel ? ` ${variant.gradeLabel}` : "";
          return `- ${variant.colorIndicator} ${variant.storageCapacity} ${variant.colorName.toUpperCase()}${grade} - ${variant.quantity} PCS - ${lot.currency} ${variant.startingBid}`;
        })
    ].join("\n"),
    bidHistory: bids
  };
}

async function insertVariants(client, lotId, variants, defaults = {}) {
  for (const [index, variant] of variants.entries()) {
    await client.query(
      `INSERT INTO lot_variants (
         lot_id,
         storage_capacity,
         color_name,
         color_indicator,
         quantity,
         starting_bid,
         bid_increment,
         grade_label,
         sort_order
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        lotId,
        variant.storageCapacity,
        variant.colorName,
        variant.colorIndicator,
        Number(variant.quantity),
        variant.startingBid || variant.price || defaults.startingBid,
        variant.bidIncrement || defaults.bidIncrement || 1,
        variant.gradeLabel || null,
        variant.sortOrder ?? index + 1
      ]
    );
  }
}

const listActiveLots = asyncHandler(async (_req, res) => {
  const lots = await listLots({ activeOnly: true });
  res.json({ lots: lots.map((lot) => publicLotResponse(lot)) });
});

const listAdminLots = asyncHandler(async (req, res) => {
  const lots = await listLots({ status: req.query.status, includeBidderNames: true });
  res.json({ lots: lots.map((lot) => publicLotResponse(lot)) });
});

const getLot = asyncHandler(async (req, res) => {
  const lot = await getLotById(req.params.id);
  if (!lot) throw notFound("Lot");

  const bids = await getMaskedBidHistory(req.params.id);
  res.json({ lot: publicLotResponse(lot, bids) });
});

const createLot = asyncHandler(async (req, res) => {
  const lotId = await withTransaction(async (client) => {
    const { rows } = await client.query(
      `INSERT INTO lots (
         title,
         series,
         grade_label,
         status,
         description,
         starting_bid,
         bid_increment,
         currency,
         starts_at,
         ends_at,
         created_by
       )
       VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7, 1), COALESCE($8, 'USD'), $9, $10, $11)
       RETURNING id`,
      [
        req.body.title,
        req.body.series,
        req.body.gradeLabel,
        req.body.status || "draft",
        req.body.description || null,
        req.body.startingBid,
        req.body.bidIncrement || null,
        req.body.currency || "USD",
        req.body.startsAt,
        req.body.endsAt,
        req.user.id
      ]
    );

    await insertVariants(client, rows[0].id, req.body.variants, {
      startingBid: req.body.startingBid,
      bidIncrement: req.body.bidIncrement || 1
    });
    await client.query(
      `INSERT INTO auction_events (lot_id, actor_id, event_type, metadata)
       VALUES ($1, $2, 'created', jsonb_build_object('title', $3::text))`,
      [rows[0].id, req.user.id, req.body.title]
    );
    return rows[0].id;
  });

  const lot = await getLotById(lotId);
  res.status(201).json({ lot: publicLotResponse(lot) });
});

const updateLot = asyncHandler(async (req, res) => {
  const existing = await getLotById(req.params.id);
  if (!existing) throw notFound("Lot");

  await withTransaction(async (client) => {
    await client.query(
      `UPDATE lots
          SET title = COALESCE($1, title),
              series = COALESCE($2, series),
              grade_label = COALESCE($3, grade_label),
              status = COALESCE($4, status),
              description = COALESCE($5, description),
              starting_bid = COALESCE($6, starting_bid),
              bid_increment = COALESCE($7, bid_increment),
              currency = COALESCE($8, currency),
              starts_at = COALESCE($9, starts_at),
              ends_at = COALESCE($10, ends_at)
        WHERE id = $11`,
      [
        req.body.title || null,
        req.body.series || null,
        req.body.gradeLabel || null,
        req.body.status || null,
        req.body.description || null,
        req.body.startingBid || null,
        req.body.bidIncrement || null,
        req.body.currency || null,
        req.body.startsAt || null,
        req.body.endsAt || null,
        req.params.id
      ]
    );

    if (req.body.variants) {
      await client.query("DELETE FROM lot_variants WHERE lot_id = $1", [req.params.id]);
      await insertVariants(client, req.params.id, req.body.variants, {
        startingBid: req.body.startingBid || existing.startingBid,
        bidIncrement: req.body.bidIncrement || existing.bidIncrement
      });
    }

    await client.query(
      `INSERT INTO auction_events (lot_id, actor_id, event_type, metadata)
       VALUES ($1, $2, 'updated', $3::jsonb)`,
      [req.params.id, req.user.id, JSON.stringify(req.body)]
    );
  });

  const lot = await getLotById(req.params.id);
  res.json({ lot: publicLotResponse(lot) });
});

const updateLotStatus = asyncHandler(async (req, res) => {
  if (!["draft", "scheduled", "active", "closed", "sold", "cancelled"].includes(req.body.status)) {
    throw new AppError("status is invalid", 422);
  }

  const eventTypeByStatus = {
    draft: "updated",
    scheduled: "updated",
    active: "started",
    closed: "closed",
    sold: "closed",
    cancelled: "cancelled"
  };

  const { rowCount } = await query("UPDATE lots SET status = $1 WHERE id = $2", [
    req.body.status,
    req.params.id
  ]);
  if (!rowCount) throw notFound("Lot");

  await query(
    `INSERT INTO auction_events (lot_id, actor_id, event_type, metadata)
     VALUES ($1, $2, $3::auction_event_type, jsonb_build_object('status', $4::text))`,
    [
      req.params.id,
      req.user.id,
      eventTypeByStatus[req.body.status],
      req.body.status
    ]
  );

  const lot = await getLotById(req.params.id);
  res.json({ lot: publicLotResponse(lot) });
});

module.exports = {
  createLot,
  getLot,
  listActiveLots,
  listAdminLots,
  updateLot,
  updateLotStatus
};
