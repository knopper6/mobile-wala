const { AppError } = require("../utils/errors");

function errorHandler(error, _req, res, _next) {
  if (["ECONNREFUSED", "ENOTFOUND", "28P01", "3D000", "42P01"].includes(error.code)) {
    console.error(error);
    return res.status(503).json({
      error: {
        message: "Database is not ready. Check DATABASE_URL, start PostgreSQL, then run npm run db:reset.",
        details: { code: error.code }
      }
    });
  }

  const isOperational = error instanceof AppError;
  const statusCode = isOperational ? error.statusCode : 500;

  if (!isOperational) {
    console.error(error);
  }

  res.status(statusCode).json({
    error: {
      message: isOperational ? error.message : "Internal server error",
      details: error.details || (process.env.NODE_ENV !== "production"
        ? { code: error.code, detail: error.detail, hint: error.hint, internal: error.message }
        : undefined)
    }
  });
}

module.exports = errorHandler;
