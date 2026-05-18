const { positiveNumber } = require("../../middleware/validate");

function validateBid(body) {
  const errors = [];
  if (!positiveNumber(body.amount)) errors.push("amount must be greater than 0");
  if (!Number.isInteger(Number(body.variantId)) || Number(body.variantId) <= 0) {
    errors.push("variantId is required");
  }
  if (body.note !== undefined && typeof body.note !== "string") {
    errors.push("note must be a string");
  }
  return errors;
}

module.exports = { validateBid };
