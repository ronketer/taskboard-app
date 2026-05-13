const { Pool } = require('pg');

// Exported as an object (not a bare value) so tests can swap the pool:
//   const db = require('../db/pool'); db.pool = memPool;
module.exports = {
  pool: new Pool({ connectionString: process.env.DATABASE_URL }),
};
