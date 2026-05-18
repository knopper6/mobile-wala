const { AppError } = require("../utils/errors");

function isEmail(value) {
  return typeof value === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function requiredString(body, field, label = field) {
  if (typeof body[field] !== "string" || body[field].trim() === "") {
    return `${label} is required`;
  }
  body[field] = body[field].trim();
  return null;
}

function positiveNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0;
}

function nonNegativeInteger(value) {
  return Number.isInteger(Number(value)) && Number(value) >= 0;
}

function validateBody(validator) {
  return (req, _res, next) => {
    const errors = validator(req.body || {});
    if (errors.length) {
      return next(new AppError("Validation failed", 422, errors));
    }
    return next();
  };
}

module.exports = {
  isEmail,
  requiredString,
  positiveNumber,
  nonNegativeInteger,
  validateBody
};
