// server/scripts/recreate_db.js
const { Client } = require('pg');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const config = {
  host:     process.env.PG_HOST     || 'localhost',
  port:     parseInt(process.env.PG_PORT || '5432'),
  user:     process.env.PG_USER     || 'postgres',
  password: process.env.PG_PASSWORD || 'postgres',
  database: 'postgres', // Connect to default database to drop/create
};

const targetDb = process.env.PG_DATABASE || 'gold_refinery';

async function recreate() {
  const client = new Client(config);
  try {
    console.log(`Connecting to PostgreSQL on ${config.host}:${config.port}...`);
    await client.connect();

    console.log(`Terminating connections to [${targetDb}]...`);
    await client.query(`
      SELECT pg_terminate_backend(pg_stat_activity.pid)
      FROM pg_stat_activity
      WHERE pg_stat_activity.datname = '${targetDb}'
      AND pid <> pg_backend_pid();
    `);

    console.log(`Dropping database [${targetDb}] if it exists...`);
    await client.query(`DROP DATABASE IF EXISTS "${targetDb}";`);

    console.log(`Creating database [${targetDb}]...`);
    await client.query(`CREATE DATABASE "${targetDb}";`);

    console.log(`Database [${targetDb}] recreated!`);

    await client.end();

    // Now connect to the new DB and run schema
    console.log(`Running schema from schema.sql...`);
    const schemaClient = new Client({ ...config, database: targetDb });
    await schemaClient.connect();

    const sqlPath = path.join(__dirname, 'schema.sql');
    if (!fs.existsSync(sqlPath)) {
        throw new Error(`Schema file not found at ${sqlPath}`);
    }
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    await schemaClient.query(sql);

    console.log(`Schema applied successfully!`);
    await schemaClient.end();
    console.log(`PostgreSQL reset complete!`);

  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

recreate();
