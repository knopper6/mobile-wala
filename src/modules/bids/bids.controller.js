const { withTransaction } = require("../../db/query");
const asyncHandler = require("../../utils/async-handler");
const { AppError, notFound } = require("../../utils/errors");
const { getLotById, getMaskedBidHistory } = require("../lots/lots.repository");

const placeBid = asyncHandler(async (req, res) => {
  if (req.user.role !== "reseller") {
    throw new AppError("Only reseller accounts can place bids", 403);
  }

  const amount = Number(req.body.amount);

  const bid = await withTransaction(async (client) => {
    const lotResult = await client.query(
      `SELECT id, status, starts_at, ends_at
         FROM lots
        WHERE id = $1
        FOR UPDATE`,
      [req.params.lotId]
    );

    const lot = lotResult.rows[0];
    if (!lot) throw notFound("Lot");
    if (lot.status !== "active") throw new AppError("Auction is not active", 409);
    if (new Date(lot.starts_at) > new Date()) throw new AppError("Auction has not started", 409);
    if (new Date(lot.ends_at) <= new Date()) throw new AppError("Auction has ended", 409);

    const variantResult = await client.query(
      `SELECT id, lot_id, storage_capacity, color_name, starting_bid, bid_increment
         FROM lot_variants
        WHERE id = $1 AND lot_id = $2
        FOR UPDATE`,
      [req.body.variantId, lot.id]
    );

    const variant = variantResult.rows[0];
    if (!variant) throw new AppError("Variant is not part of this lot", 404);

    const highBidResult = await client.query(
      "SELECT MAX(amount) AS highest_bid FROM bids WHERE variant_id = $1",
      [variant.id]
    );

    const highestBid = highBidResult.rows[0].highest_bid
      ? Number(highBidResult.rows[0].highest_bid)
      : null;
    const minimumBid = highestBid
      ? highestBid + Number(variant.bid_increment)
      : Number(variant.starting_bid);

    if (amount < minimumBid) {
      throw new AppError(`Bid must be at least ${minimumBid.toFixed(2)}`, 409, {
        minimumBid
      });
    }

    const { rows } = await client.query(
      `INSERT INTO bids (lot_id, variant_id, reseller_id, amount, note)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, lot_id, variant_id, reseller_id, amount, note, created_at`,
      [lot.id, variant.id, req.user.id, amount, req.body.note || null]
    );

    await client.query(
      `INSERT INTO auction_events (lot_id, actor_id, event_type, metadata)
       VALUES ($1, $2, 'bid_placed', jsonb_build_object('amount', $3::numeric, 'variantId', $4::bigint))`,
      [lot.id, req.user.id, amount, variant.id]
    );

    return rows[0];
  });

  const lot = await getLotById(req.params.lotId);
  const bidHistory = await getMaskedBidHistory(req.params.lotId);

  res.status(201).json({
    bid: {
      id: Number(bid.id),
      lotId: Number(bid.lot_id),
      variantId: Number(bid.variant_id),
      amount: Number(bid.amount),
      note: bid.note,
      createdAt: bid.created_at
    },
    lot: {
      id: lot.id,
      highestBid: lot.highestBid,
      bidCount: lot.bidCount
    },
    bidHistory
  });
});

const listLotBids = asyncHandler(async (req, res) => {
  const lot = await getLotById(req.params.lotId);
  if (!lot) throw notFound("Lot");

  const bidHistory = await getMaskedBidHistory(req.params.lotId);
  res.json({ bids: bidHistory });
});

module.exports = { listLotBids, placeBid };
