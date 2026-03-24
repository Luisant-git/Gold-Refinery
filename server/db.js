// server/db.js — MS SQL Server connection
require('dotenv').config();
const sql = require('mssql');

let pool = null;

function getConfig() {
  const server = process.env.DB_SERVER || 'localhost';

  return {
    server:   server,
    database: process.env.DB_DATABASE || 'gold_refinery',
    user:     process.env.DB_USER     || 'sa',
    password: process.env.DB_PASSWORD || '',
    port:     parseInt(process.env.DB_PORT) || 1433,
    options: {
      encrypt:                false,  // false for local SQL Server
      trustServerCertificate: true,   // always true for local
      enableArithAbort:       true,
      instanceName:           process.env.DB_INSTANCE || undefined, // e.g. SQLEXPRESS
    },
    pool: { max: 10, min: 0, idleTimeoutMillis: 30000 },
    connectionTimeout: 20000,
    requestTimeout:    30000,
  };
}

async function connectDB(overrideConfig) {
  try {
    if (pool) { try { await pool.close(); } catch(e){} pool = null; }
    pool = await sql.connect(overrideConfig || getConfig());
    return { success: true };
  } catch(err) {
    pool = null;
    return { success: false, error: err.message };
  }
}

function getPool() {
  if (!pool) throw new Error('Database not connected. Check your .env file.');
  return pool;
}

function dbStatus() {
  return { connected: !!pool };
}

module.exports = { sql, connectDB, getPool, dbStatus };
