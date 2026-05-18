const app = require("./app");
const env = require("./config/env");
const pool = require("./db/pool");

const server = app.listen(env.port, () => {
  console.log(`MobileWala auction API listening on port ${env.port}`);
});

function shutdown(signal) {
  console.log(`${signal} received, shutting down`);
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
