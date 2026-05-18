class AppError extends Error {
  constructor(message, statusCode = 500, details = undefined) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.details = details;
  }
}

function notFound(resource = "Resource") {
  return new AppError(`${resource} not found`, 404);
}

module.exports = { AppError, notFound };
