const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const env = require("../../config/env");
const { query, withTransaction } = require("../../db/query");
const asyncHandler = require("../../utils/async-handler");
const { AppError } = require("../../utils/errors");

function issueToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      role: user.role
    },
    env.jwtSecret,
    { expiresIn: env.jwtExpiresIn }
  );
}

function publicUser(user) {
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

const registerReseller = asyncHandler(async (req, res) => {
  const passwordHash = await bcrypt.hash(req.body.password, 12);

  const user = await withTransaction(async (client) => {
    const existing = await client.query("SELECT id FROM users WHERE email = $1", [
      req.body.email.toLowerCase()
    ]);
    if (existing.rows.length) {
      throw new AppError("An account with this email already exists", 409);
    }

    const { rows } = await client.query(
      `INSERT INTO users (email, password_hash, role, status, display_name, company_name, phone)
       VALUES ($1, $2, 'reseller', 'pending', $3, $4, $5)
       RETURNING id, email, role, status, display_name, company_name, phone`,
      [
        req.body.email.toLowerCase(),
        passwordHash,
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
         monthly_volume_estimate
       )
       VALUES ($1, $2, $3, $4, $5, COALESCE($6, 'USA'), $7, $8, $9)`,
      [
        rows[0].id,
        req.body.gstOrTaxId || null,
        req.body.businessAddress || null,
        req.body.city || null,
        req.body.state || null,
        req.body.country || null,
        req.body.postalCode || null,
        Array.isArray(req.body.preferredBrands) ? req.body.preferredBrands : [],
        req.body.monthlyVolumeEstimate || null
      ]
    );

    return rows[0];
  });

  res.status(201).json({
    user: publicUser(user),
    message: "Registration submitted. Admin approval is required before login."
  });
});

const login = asyncHandler(async (req, res) => {
  const identifier = req.body.identifier || req.body.email || req.body.name;
  const { rows } = await query(
    `SELECT id, email, password_hash, role, status, display_name, company_name, phone
       FROM users
      WHERE lower(email) = lower($1)
         OR lower(display_name) = lower($1)
         OR lower(company_name) = lower($1)
      ORDER BY
        CASE
          WHEN lower(email) = lower($1) THEN 1
          WHEN lower(display_name) = lower($1) THEN 2
          ELSE 3
        END
      LIMIT 1`,
    [identifier]
  );

  const user = rows[0];
  const passwordMatches = user
    ? await bcrypt.compare(req.body.password, user.password_hash)
    : false;

  if (!user || !passwordMatches) {
    throw new AppError("Invalid name or password", 401);
  }

  if (user.status !== "active") {
    const message = user.status === "pending"
      ? "Account is pending admin approval"
      : "Account is not active";
    throw new AppError(message, 403);
  }

  res.json({
    user: publicUser(user),
    token: issueToken(user)
  });
});

const me = asyncHandler(async (req, res) => {
  const { rows } = await query(
    `SELECT
       u.id,
       u.email,
       u.role,
       u.status,
       u.display_name,
       u.company_name,
       u.phone,
       rp.gst_or_tax_id,
       rp.business_address,
       rp.city,
       rp.state,
       rp.country,
       rp.postal_code,
       rp.preferred_brands,
       rp.monthly_volume_estimate
     FROM users u
     LEFT JOIN reseller_profiles rp ON rp.user_id = u.id
     WHERE u.id = $1`,
    [req.user.id]
  );

  res.json({ user: rows[0] });
});

module.exports = { registerReseller, login, me };
