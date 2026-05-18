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

/* ───── Admin self‑update ───── */

const updateAdminProfile = asyncHandler(async (req, res) => {
  const { rows: [user] } = await query(
    "SELECT id, email, password_hash, role, status, display_name, company_name, phone FROM users WHERE id = $1",
    [req.user.id]
  );

  const updates = [];
  const values = [];
  let idx = 0;

  if (req.body.email && req.body.email !== user.email) {
    const { rows: dup } = await query(
      "SELECT id FROM users WHERE lower(email) = lower($1) AND id <> $2",
      [req.body.email, user.id]
    );
    if (dup.length) throw new AppError("Email already in use", 409);

    idx += 1;
    updates.push(`email = $${idx}`);
    values.push(req.body.email.toLowerCase());
  }

  if (req.body.currentPassword && req.body.newPassword) {
    const pwOk = await bcrypt.compare(req.body.currentPassword, user.password_hash);
    if (!pwOk) throw new AppError("Current password is incorrect", 403);

    if (req.body.newPassword.length < 6) {
      throw new AppError("New password must be at least 6 characters", 422);
    }

    idx += 1;
    updates.push(`password_hash = $${idx}`);
    values.push(await bcrypt.hash(req.body.newPassword, 12));
  }

  if (!updates.length) {
    throw new AppError("Nothing to update", 422);
  }

  idx += 1;
  values.push(user.id);

  const { rows } = await query(
    `UPDATE users SET ${updates.join(", ")}, updated_at = NOW()
      WHERE id = $${idx}
      RETURNING id, email, role, status, display_name, company_name, phone`,
    values
  );

  res.json({ user: publicUserProfile(rows[0]) });
});

/* ───── Admin edits reseller ───── */

const updateResellerByAdmin = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const { rows: target } = await query(
    "SELECT id, role FROM users WHERE id = $1",
    [id]
  );
  if (!target[0] || target[0].role !== "reseller") {
    throw notFound("Reseller");
  }

  const userUpdates = {};
  const userValues = [];
  const profileUpdates = {};
  const profileValues = [];
  let ui = 0;
  let pi = 0;

  /* user-level fields */
  const userFields = ["email", "displayName", "companyName", "phone"];
  for (const f of userFields) {
    if (req.body[f] !== undefined) {
      const col = { email: "email", displayName: "display_name", companyName: "company_name", phone: "phone" }[f];
      ui += 1;
      userUpdates[col] = `$${ui}`;
      userValues.push(f === "email" ? req.body[f].toLowerCase() : req.body[f]);
    }
  }

  /* profile-level fields */
  const profileMap = {
    gstOrTaxId: "gst_or_tax_id",
    businessAddress: "business_address",
    city: "city",
    state: "state",
    country: "country",
    postalCode: "postal_code",
    preferredBrands: "preferred_brands",
    monthlyVolumeEstimate: "monthly_volume_estimate"
  };

  for (const [bodyKey, col] of Object.entries(profileMap)) {
    if (req.body[bodyKey] !== undefined) {
      pi += 1;
      profileUpdates[col] = `$${pi}`;
      const val = bodyKey === "preferredBrands" && Array.isArray(req.body[bodyKey])
        ? req.body[bodyKey]
        : req.body[bodyKey];
      profileValues.push(val ?? null);
    }
  }

  let userResult;
  await withTransaction(async (client) => {
    /* update user table */
    if (Object.keys(userUpdates).length) {
      const setClauses = Object.entries(userUpdates).map(([col, ph]) => `${col} = ${ph}`);
      ui += 1;
      userValues.push(id);
      const { rows } = await client.query(
        `UPDATE users SET ${setClauses.join(", ")}, updated_at = NOW()
          WHERE id = $${ui}
          RETURNING id, email, role, status, display_name, company_name, phone`,
        userValues
      );
      userResult = rows[0];
    } else {
      const { rows } = await client.query(
        "SELECT id, email, role, status, display_name, company_name, phone FROM users WHERE id = $1",
        [id]
      );
      userResult = rows[0];
    }

    /* update profile table */
    if (Object.keys(profileUpdates).length) {
      const setClauses = Object.entries(profileUpdates).map(([col, ph]) => `${col} = ${ph}`);
      pi += 1;
      profileValues.push(id);
      await client.query(
        `UPDATE reseller_profiles SET ${setClauses.join(", ")} WHERE user_id = $${pi}`,
        profileValues
      );
    }
  });

  const profile = await query(
    `SELECT * FROM reseller_profiles WHERE user_id = $1`,
    [id]
  );

  res.json({
    reseller: {
      id: Number(userResult.id),
      email: userResult.email,
      role: userResult.role,
      status: userResult.status,
      displayName: userResult.display_name,
      companyName: userResult.company_name,
      phone: userResult.phone,
      profile: profile.rows[0] ? profileRow(profile.rows[0]) : null
    }
  });
});

/* ───── Admin resets reseller password ───── */

const resetResellerPassword = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { newPassword } = req.body;

  if (!newPassword || newPassword.length < 6) {
    throw new AppError("newPassword must be at least 6 characters", 422);
  }

  const { rows } = await query(
    "SELECT id, role FROM users WHERE id = $1",
    [id]
  );
  if (!rows[0] || rows[0].role !== "reseller") {
    throw notFound("Reseller");
  }

  const hash = await bcrypt.hash(newPassword, 12);
  await query(
    "UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2",
    [hash, id]
  );

  res.json({ message: "Password updated" });
});

/* ───── helpers ───── */

function publicUserProfile(user) {
  return {
    id: Number(user.id),
    email: user.email,
    role: user.role,
    status: user.status,
    displayName: user.display_name,
    companyName: user.company_name,
    phone: user.phone
  };
}

function profileRow(r) {
  return {
    gstOrTaxId: r.gst_or_tax_id,
    businessAddress: r.business_address,
    city: r.city,
    state: r.state,
    country: r.country,
    postalCode: r.postal_code,
    preferredBrands: r.preferred_brands,
    monthlyVolumeEstimate: r.monthly_volume_estimate
  };
}

module.exports = {
  createResellerByAdmin,
  getResellerProfile,
  listResellers,
  updateResellerStatus,
  updateAdminProfile,
  updateResellerByAdmin,
  resetResellerPassword
};
