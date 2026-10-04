const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || undefined,
  user: process.env.PGUSER || undefined,
  host: process.env.PGHOST || 'localhost',
  database: process.env.PGDATABASE || 'seatswap',
  password: process.env.PGPASSWORD || undefined,
  port: process.env.PGPORT ? parseInt(process.env.PGPORT, 10) : 5432,
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle PostgreSQL client', err);
});

async function query(text, params) {
  const start = Date.now();
  const res = await pool.query(text, params);
  const duration = Date.now() - start;
  // in dev, optional debug log for slow queries:
  if (process.env.NODE_ENV === 'development' && duration > 200) {
    console.log('Executed query', { text: text.slice(0, 80), duration, rows: res.rowCount });
  }
  return res;
}

async function getClient() {
  const client = await pool.connect();
  return client;
}

async function initSchema() {
  const schemaPath = path.join(__dirname, 'schema.sql');
  const sql = fs.readFileSync(schemaPath, 'utf8');
  await pool.query(sql);
  console.log('✅ PostgreSQL Schema initialized successfully.');
}

module.exports = {
  pool,
  query,
  getClient,
  initSchema
};
