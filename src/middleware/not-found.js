function notFoundHandler(req, res) {
  res.status(404).json({
    error: {
      message: `Route ${req.method} ${req.originalUrl} not found`
    }
  });
}

module.exports = notFoundHandler;
