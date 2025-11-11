// server/database.js
// Adaptive PostgreSQL connection for local dev + Railway production
const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.resolve(process.cwd(), '.env') });

const isProduction = process.env.NODE_ENV === 'production' || process.env.RAILWAY_ENV === 'production';
const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/pi_rideshare_dev';

// Default pool options (tweaks allowed)
const basePoolOptions = {
  connectionString,
  max: isProduction ? 50 : 20,
  min: isProduction ? 10 : 2,
  idleTimeoutMillis: isProduction ? 10000 : 30000,
  connectionTimeoutMillis: isProduction ? 5000 : 10000,
};

// Helper: detect Railway (common host patterns)
// Railway sometimes uses hostnames like *.railway.app or *.proxy.rlwy.net
const isRailwayHost = (cs) => {
  if (!cs) return false;
  return cs.includes('.railway.app') || cs.includes('proxy.rlwy.net') || cs.includes('railway');
};

// Adaptive SSL config
let sslOption = false; // default: no SSL (works for localhost)
try {
  if (isRailwayHost(connectionString) || isProduction) {
    // For Railway-hosted DBs, enable SSL but do not reject self-signed certs
    sslOption = { rejectUnauthorized: false };
    console.log('🔐 Using SSL (rejectUnauthorized: false) for DB connection');
  } else {
    sslOption = false;
    console.log('🔓 Connecting to DB without SSL (development/local)');
  }
} catch (err) {
  console.warn('⚠️ SSL detection error, falling back to non-SSL', err.message || err);
  sslOption = false;
}

const pool = new Pool({
  ...basePoolOptions,
  ssl: sslOption,
});

// Basic runtime logs for debug
pool.on('connect', () => {
  console.log('✅ Connected to PostgreSQL database successfully.');
});

pool.on('error', (err) => {
  console.error('❌ Database pool error:', err && err.message ? err.message : err);
});

// Use a quick test at startup (optional; your index.js may already do schema init)
const testConnection = async () => {
  try {
    const client = await pool.connect();
    client.release();
    console.log('✅ Database connectivity test passed.');
  } catch (err) {
    // Surface a more explicit message to help with Railway SSL vs non-SSL situations
    const msg = err && err.message ? err.message : String(err);
    if (msg.toLowerCase().includes('ssl')) {
      console.error('❌ Database initialization error (SSL related):', msg);
    } else {
      console.error('❌ Database initialization error:', msg);
    }
    // Do not crash the process here; index.js can handle the fallback if needed
  }
};

// Run quick test but don't block module export
testConnection().catch(() => { /* already logged */ });

module.exports = {
  pool,
};
