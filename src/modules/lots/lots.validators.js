const {
  nonNegativeInteger,
  positiveNumber,
  requiredString
} = require("../../middleware/validate");

const statuses = new Set(["draft", "scheduled", "active", "closed", "sold", "cancelled"]);

function validateVariant(variant, index) {
  const errors = [];
  ["storageCapacity", "colorName", "colorIndicator"].forEach((field) => {
    if (typeof variant[field] !== "string" || variant[field].trim() === "") {
      errors.push(`variants[${index}].${field} is required`);
    }
  });
  if (!nonNegativeInteger(variant.quantity)) {
    errors.push(`variants[${index}].quantity must be a non-negative integer`);
  }
  if (variant.startingBid !== undefined && !positiveNumber(variant.startingBid)) {
    errors.push(`variants[${index}].startingBid must be greater than 0`);
  }
  if (variant.bidIncrement !== undefined && !positiveNumber(variant.bidIncrement)) {
    errors.push(`variants[${index}].bidIncrement must be greater than 0`);
  }
  return errors;
}

function validateLotCreate(body) {
  const errors = [];
  ["title", "series", "gradeLabel", "startsAt", "endsAt"].forEach((field) => {
    const error = requiredString(body, field);
    if (error) errors.push(error);
  });
  if (!positiveNumber(body.startingBid)) errors.push("startingBid must be greater than 0");
  if (body.bidIncrement !== undefined && !positiveNumber(body.bidIncrement)) {
    errors.push("bidIncrement must be greater than 0");
  }
  if (body.status && !statuses.has(body.status)) errors.push("status is invalid");
  if (!Array.isArray(body.variants) || body.variants.length === 0) {
    errors.push("variants must include at least one item");
  } else {
    body.variants.forEach((variant, index) => errors.push(...validateVariant(variant, index)));
  }
  if (body.startsAt && body.endsAt && new Date(body.endsAt) <= new Date(body.startsAt)) {
    errors.push("endsAt must be after startsAt");
  }
  return errors;
}

function validateLotUpdate(body) {
  const errors = [];
  if (body.status && !statuses.has(body.status)) errors.push("status is invalid");
  if (body.startingBid !== undefined && !positiveNumber(body.startingBid)) {
    errors.push("startingBid must be greater than 0");
  }
  if (body.bidIncrement !== undefined && !positiveNumber(body.bidIncrement)) {
    errors.push("bidIncrement must be greater than 0");
  }
  if (body.variants !== undefined) {
    if (!Array.isArray(body.variants) || body.variants.length === 0) {
      errors.push("variants must include at least one item");
    } else {
      body.variants.forEach((variant, index) => errors.push(...validateVariant(variant, index)));
    }
  }
  if (body.startsAt && body.endsAt && new Date(body.endsAt) <= new Date(body.startsAt)) {
    errors.push("endsAt must be after startsAt");
  }
  return errors;
}

module.exports = { validateLotCreate, validateLotUpdate };
