const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://postgres:ATHLETEN123@localhost:5432/athletenportal',
});

module.exports = {
  query: (text, params) => pool.query(text, params),
};