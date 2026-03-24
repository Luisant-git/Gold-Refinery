// server/routes/db.js — PostgreSQL version
const { Pool } = require('pg');

let pool = null;

function getPool() {
  if (!pool) {
    pool = new Pool({
      host:     process.env.PG_HOST     || 'localhost',
      port:     parseInt(process.env.PG_PORT || '5432'),
      database: process.env.PG_DATABASE || 'gold_refinery',
      user:     process.env.PG_USER     || 'postgres',
      password: process.env.PG_PASSWORD || 'postgres',
    });
    pool.on('error', (err) => console.error('PG pool error:', err));
  }
  return pool;
}

// Simple query helper — returns rows array
async function query(text, params) {
  const result = await getPool().query(text, params);
  return result.rows;
}

// Transaction helper — returns client for manual tx management
async function getClient() {
  return await getPool().connect();
}

module.exports = { getPool, query, getClient };
