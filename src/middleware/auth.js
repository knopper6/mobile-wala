const jwt = require("jsonwebtoken");
const env = require("../config/env");
const { query } = require("../db/query");
const { AppError } = require("../utils/errors");
const asyncHandler = require("../utils/async-handler");

const authenticate = asyncHandler(async (req, _res, next) => {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");

  if (scheme !== "Bearer" || !token) {
    throw new AppError("Authentication token is required", 401);
  }

  let payload;
  try {
    payload = jwt.verify(token, env.jwtSecret);
  } catch (_error) {
    throw new AppError("Authentication token is invalid or expired", 401);
  }

  const { rows } = await query(
    `SELECT id, email, role, status, display_name, company_name
       FROM users
      WHERE id = $1`,
    [payload.sub]
  );

  const user = rows[0];
  if (!user || user.status !== "active") {
    throw new AppError("Account is not active", 401);
  }

  req.user = user;
  next();
});

function requireRole(...roles) {
  return (req, _res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(new AppError("You do not have permission to access this resource", 403));
    }

    return next();
  };
}

module.exports = { authenticate, requireRole };
