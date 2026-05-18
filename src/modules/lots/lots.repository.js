const { query } = require("../../db/query");
const { maskName } = require("../../utils/mask");

function mapLot(row) {
  return {
    id: Number(row.id),
    title: row.title,
    series: row.series,
    gradeLabel: row.grade_label,
    status: row.status,
    description: row.description,
    startingBid: Number(row.starting_bid),
    bidIncrement: Number(row.bid_increment),
    currency: row.currency,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    totalQuantity: Number(row.total_quantity || 0),
    highestBid: row.highest_bid === null ? null : Number(row.highest_bid),
    bidCount: Number(row.bid_count || 0),
    variants: row.variants || []
  };
}

async function listLots({ status, activeOnly, includeBidderNames = false }) {
  const clauses = [];
  const params = [];
  const bidderNameField = includeBidderNames ? "vb.highest_bidder_name" : "NULL";
  const bidderCompanyField = includeBidderNames ? "vb.highest_bidder_company" : "NULL";

  if (status) {
    params.push(status);
    clauses.push(`l.status = $${params.length}`);
  }

  if (activeOnly) {
    clauses.push("l.status = 'active'");
    clauses.push("l.starts_at <= NOW()");
    clauses.push("l.ends_at > NOW()");
  }

  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";

  const { rows } = await query(
    `SELECT
       l.*,
       COALESCE(vs.total_quantity, 0) AS total_quantity,
       bs.highest_bid,
       COALESCE(bs.bid_count, 0) AS bid_count,
       COALESCE(vs.variants, '[]'::jsonb) AS variants
     FROM lots l
     LEFT JOIN LATERAL (
       SELECT
         SUM(v.quantity) AS total_quantity,
         jsonb_agg(
           jsonb_build_object(
             'id', v.id,
             'storageCapacity', v.storage_capacity,
             'colorName', v.color_name,
             'colorIndicator', v.color_indicator,
             'quantity', v.quantity,
             'startingBid', v.starting_bid,
             'bidIncrement', v.bid_increment,
             'highestBid', vb.highest_bid,
             'highestBidderName', ${bidderNameField},
             'highestBidderCompany', ${bidderCompanyField},
             'bidCount', COALESCE(vb.bid_count, 0),
             'minimumBid', COALESCE(vb.highest_bid + v.bid_increment, v.starting_bid),
             'gradeLabel', COALESCE(v.grade_label, l.grade_label),
             'sortOrder', v.sort_order
           )
           ORDER BY v.sort_order, v.id
         ) AS variants
       FROM lot_variants v
       LEFT JOIN LATERAL (
         SELECT
           hb.amount AS highest_bid,
           hb.display_name AS highest_bidder_name,
           hb.company_name AS highest_bidder_company,
           bc.bid_count
         FROM (
           SELECT COUNT(*) AS bid_count
           FROM bids b
           WHERE b.variant_id = v.id
         ) bc
         LEFT JOIN LATERAL (
           SELECT b.amount, u.display_name, u.company_name
           FROM bids b
           JOIN users u ON u.id = b.reseller_id
           WHERE b.variant_id = v.id
           ORDER BY b.amount DESC, b.created_at ASC
           LIMIT 1
         ) hb ON true
       ) vb ON true
       WHERE v.lot_id = l.id
     ) vs ON true
     LEFT JOIN LATERAL (
       SELECT MAX(b.amount) AS highest_bid, COUNT(*) AS bid_count
       FROM bids b
       WHERE b.lot_id = l.id
     ) bs ON true
     ${where}
     ORDER BY l.starts_at ASC, l.id DESC`,
    params
  );

  return rows.map(mapLot);
}

async function getLotById(id) {
  const { rows } = await query(
    `SELECT
       l.*,
       COALESCE(vs.total_quantity, 0) AS total_quantity,
       bs.highest_bid,
       COALESCE(bs.bid_count, 0) AS bid_count,
       COALESCE(vs.variants, '[]'::jsonb) AS variants
     FROM lots l
     LEFT JOIN LATERAL (
       SELECT
         SUM(v.quantity) AS total_quantity,
         jsonb_agg(
           jsonb_build_object(
             'id', v.id,
             'storageCapacity', v.storage_capacity,
             'colorName', v.color_name,
             'colorIndicator', v.color_indicator,
             'quantity', v.quantity,
             'startingBid', v.starting_bid,
             'bidIncrement', v.bid_increment,
             'highestBid', vb.highest_bid,
             'bidCount', COALESCE(vb.bid_count, 0),
             'minimumBid', COALESCE(vb.highest_bid + v.bid_increment, v.starting_bid),
             'gradeLabel', COALESCE(v.grade_label, l.grade_label),
             'sortOrder', v.sort_order
           )
           ORDER BY v.sort_order, v.id
         ) AS variants
       FROM lot_variants v
       LEFT JOIN LATERAL (
         SELECT MAX(b.amount) AS highest_bid, COUNT(*) AS bid_count
         FROM bids b
         WHERE b.variant_id = v.id
       ) vb ON true
       WHERE v.lot_id = l.id
     ) vs ON true
     LEFT JOIN LATERAL (
       SELECT MAX(b.amount) AS highest_bid, COUNT(*) AS bid_count
       FROM bids b
       WHERE b.lot_id = l.id
     ) bs ON true
     WHERE l.id = $1
     `,
    [id]
  );

  return rows[0] ? mapLot(rows[0]) : null;
}

async function getMaskedBidHistory(lotId) {
  const { rows } = await query(
    `SELECT
       b.id,
       b.amount,
       b.created_at,
       b.variant_id,
       v.storage_capacity,
       v.color_name,
       v.color_indicator,
       u.display_name,
       u.company_name
       FROM bids b
       JOIN lot_variants v ON v.id = b.variant_id
       JOIN users u ON u.id = b.reseller_id
      WHERE b.lot_id = $1
      ORDER BY b.amount DESC, b.created_at ASC`,
    [lotId]
  );

  return rows.map((row) => ({
    id: Number(row.id),
    amount: Number(row.amount),
    variantId: Number(row.variant_id),
    variant: `${row.color_indicator} ${row.storage_capacity} ${row.color_name}`,
    bidder: maskName(row.display_name || row.company_name),
    createdAt: row.created_at
  }));
}

module.exports = { getLotById, getMaskedBidHistory, listLots, mapLot };
