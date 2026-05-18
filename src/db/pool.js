const { Pool } = require("pg");
const env = require("../config/env");

const pool = new Pool({
  connectionString: env.databaseUrl,
  max: 12,
  idleTimeoutMillis: 30_000
});

module.exports = pool;
