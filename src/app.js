const cors = require("cors");
const express = require("express");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const morgan = require("morgan");
const path = require("path");
const env = require("./config/env");
const authRoutes = require("./modules/auth/auth.routes");
const bidRoutes = require("./modules/bids/bids.routes");
const lotRoutes = require("./modules/lots/lots.routes");
const userRoutes = require("./modules/users/users.routes");
const errorHandler = require("./middleware/error-handler");
const notFoundHandler = require("./middleware/not-found");

const app = express();
const publicDir = path.join(__dirname, "..", "public");

app.use(
  helmet({
    contentSecurityPolicy: false
  })
);
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || env.corsOrigin.length === 0 || env.corsOrigin.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error("Not allowed by CORS"));
    }
  })
);
app.use(express.json({ limit: "1mb" }));
app.use(morgan(env.nodeEnv === "production" ? "combined" : "dev"));
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 300,
    standardHeaders: true,
    legacyHeaders: false
  })
);
app.use(express.static(publicDir));

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "mobilewala-auction-backend" });
});

app.get("/", (_req, res) => {
  res.sendFile(path.join(publicDir, "index.html"));
});

app.get("/admin", (_req, res) => {
  res.sendFile(path.join(publicDir, "admin.html"));
});

app.get("/api", (_req, res) => {
  res.json({
    name: "MobileWala Auction API",
    version: "1.0.0",
    resources: [
      "POST /api/auth/register",
      "POST /api/auth/login",
      "GET /api/auth/me",
      "GET /api/lots",
      "GET /api/lots/:id",
      "POST /api/lots/:lotId/bids",
      "GET /api/lots/:lotId/bids",
      "GET /api/reseller/profile",
      "POST /api/admin/resellers",
      "PATCH /api/admin/resellers/:id/status",
      "GET /api/lots/admin/all",
      "POST /api/lots/admin",
      "PATCH /api/lots/admin/:id",
      "PATCH /api/lots/admin/:id/status",
      "GET /api/admin/resellers"
    ]
  });
});

app.get("/models", (_req, res) => {
  res.json({
    message: "MobileWala uses /api/lots for auction inventory. Product images/models are not part of this backend.",
    lotsEndpoint: "/api/lots"
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/lots", lotRoutes);
app.use("/api", bidRoutes);
app.use("/api", userRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
