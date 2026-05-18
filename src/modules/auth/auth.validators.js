const { isEmail, requiredString } = require("../../middleware/validate");

function validateRegister(body) {
  const errors = [];
  ["email", "password", "displayName", "companyName", "phone"].forEach((field) => {
    const error = requiredString(body, field);
    if (error) errors.push(error);
  });
  if (body.email && !isEmail(body.email)) errors.push("email must be valid");
  if (body.password && body.password.length < 8) errors.push("password must be at least 8 characters");
  if (body.monthlyVolumeEstimate !== undefined && Number(body.monthlyVolumeEstimate) < 0) {
    errors.push("monthlyVolumeEstimate must be a positive number");
  }
  return errors;
}

function validateLogin(body) {
  const errors = [];
  const identifier = body.identifier || body.email || body.name;
  if (typeof identifier !== "string" || identifier.trim() === "") {
    errors.push("name or email is required");
  } else {
    body.identifier = identifier.trim();
  }

  ["password"].forEach((field) => {
    const error = requiredString(body, field);
    if (error) errors.push(error);
  });
  return errors;
}

module.exports = { validateRegister, validateLogin };
