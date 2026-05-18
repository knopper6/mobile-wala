const bcrypt = require("bcryptjs");
const { query, withTransaction } = require("../../db/query");
const asyncHandler = require("../../utils/async-handler");
const { AppError, notFound } = require("../../utils/errors");

const getResellerProfile = asyncHandler(async (req, res) => {
  const { rows: profileRows } = await query(
    `SELECT
       u.id,
       u.email,
       u.display_name,
       u.company_name,
       u.phone,
       u.status,
       rp.gst_or_tax_id,
       rp.business_address,
       rp.city,
       rp.state,
       rp.country,
       rp.postal_code,
       rp.preferred_brands,
       rp.monthly_volume_estimate,
       rp.approved_at
     FROM users u
     LEFT JOIN reseller_profiles rp ON rp.user_id = u.id
     WHERE u.id = $1 AND u.role = 'reseller'`,
    [req.user.id]
  );

  const { rows: bidRows } = await query(
    `SELECT
       b.id,
       b.amount,
       b.created_at,
       l.id AS lot_id,
       l.title AS lot_title,
       l.status AS lot_status
     FROM bids b
     JOIN lots l ON l.id = b.lot_id
     WHERE b.reseller_id = $1
     ORDER BY b.created_at DESC`,
    [req.user.id]
  );

  res.json({
    profile: profileRows[0],
    biddingHistory: bidRows.map((bid) => ({
      id: Number(bid.id),
      amount: Number(bid.amount),
      createdAt: bid.created_at,
      lot: {
        id: Number(bid.lot_id),
        title: bid.lot_title,
        status: bid.lot_status
      }
    }))
  });
});

const listResellers = asyncHandler(async (_req, res) => {
  const { rows } = await query(
    `SELECT
       u.id,
       u.email,
       u.display_name,
       u.company_name,
       u.phone,
       u.status,
       u.created_at,
       COUNT(b.id) AS bid_count,
       COALESCE(SUM(b.amount), 0) AS total_bid_value
     FROM users u
     LEFT JOIN bids b ON b.reseller_id = u.id
     WHERE u.role = 'reseller'
     GROUP BY u.id
     ORDER BY u.created_at DESC`
  );

  res.json({
    resellers: rows.map((row) => ({
      id: Number(row.id),
      email: row.email,
      displayName: row.display_name,
      companyName: row.company_name,
      phone: row.phone,
      status: row.status,
      createdAt: row.created_at,
      bidCount: Number(row.bid_count),
      totalBidValue: Number(row.total_bid_value)
    }))
  });
});

const createResellerByAdmin = asyncHandler(async (req, res) => {
  const required = ["email", "password", "displayName", "companyName", "phone"];
  const missing = required.filter((field) => !req.body[field]);
  if (missing.length) {
    throw new AppError(`Missing fields: ${missing.join(", ")}`, 422);
  }

  const passwordHash = await bcrypt.hash(req.body.password, 12);
  const status = ["active", "pending", "suspended"].includes(req.body.status)
    ? req.body.status
    : "active";

  const user = await withTransaction(async (client) => {
    const existing = await client.query("SELECT id FROM users WHERE lower(email) = lower($1)", [
      req.body.email
    ]);
    if (existing.rows.length) {
      throw new AppError("An account with this email already exists", 409);
    }

    const { rows } = await client.query(
      `INSERT INTO users (email, password_hash, role, status, display_name, company_name, phone)
       VALUES (lower($1), $2, 'reseller', $3, $4, $5, $6)
       RETURNING id, email, role, status, display_name, company_name, phone, created_at`,
      [
        req.body.email,
        passwordHash,
        status,
        req.body.displayName,
        req.body.companyName,
        req.body.phone
      ]
    );

    await client.query(
      `INSERT INTO reseller_profiles (
         user_id,
         gst_or_tax_id,
         business_address,
         city,
         state,
         country,
         postal_code,
         preferred_brands,
         monthly_volume_estimate,
         approved_at
       )
       VALUES ($1, $2, $3, $4, $5, COALESCE($6, 'USA'), $7, $8, $9, CASE WHEN $10 = 'active' THEN NOW() ELSE NULL END)`,
      [
        rows[0].id,
        req.body.gstOrTaxId || null,
        req.body.businessAddress || null,
        req.body.city || null,
        req.body.state || null,
        req.body.country || null,
        req.body.postalCode || null,
        Array.isArray(req.body.preferredBrands) ? req.body.preferredBrands : [],
        req.body.monthlyVolumeEstimate || null,
        status
      ]
    );

    return rows[0];
  });

  res.status(201).json({
    reseller: {
      id: Number(user.id),
      email: user.email,
      role: user.role,
      status: user.status,
      displayName: user.display_name,
      companyName: user.company_name,
      phone: user.phone,
      createdAt: user.created_at
    }
  });
});

const updateResellerStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  if (!["active", "pending", "suspended"].includes(status)) {
    throw new AppError("status must be active, pending, or suspended", 422);
  }

  const user = await withTransaction(async (client) => {
    const { rows } = await client.query(
      `UPDATE users
          SET status = $1
        WHERE id = $2 AND role = 'reseller'
        RETURNING id, email, role, status, display_name, company_name, phone, created_at`,
      [status, req.params.id]
    );
    if (!rows[0]) throw notFound("Reseller");

    await client.query(
      `UPDATE reseller_profiles
          SET approved_at = CASE WHEN $1 = 'active' THEN COALESCE(approved_at, NOW()) ELSE approved_at END
        WHERE user_id = $2`,
      [status, req.params.id]
    );

    return rows[0];
  });

  res.json({
    reseller: {
      id: Number(user.id),
      email: user.email,
      role: user.role,
      status: user.status,
      displayName: user.display_name,
      companyName: user.company_name,
      phone: user.phone,
      createdAt: user.created_at
    }
  });
});

module.exports = {
  createResellerByAdmin,
  getResellerProfile,
  listResellers,
  updateResellerStatus
};
