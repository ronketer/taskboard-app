process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key-for-jwt-signing';
process.env.JWT_EXPIRATION = '30d';
process.env.PORT = 3001;
// Provide a dummy URL so pg.Pool constructor doesn't warn; it is replaced below.
process.env.DATABASE_URL = 'postgresql://localhost/test';

jest.setTimeout(30000);

const { newDb } = require('pg-mem');
const { runMigrations } = require('../db/migrate');

const mem = newDb({ noAstCoverageCheck: true });

const { Pool } = mem.adapters.createPg();
const memPool = new Pool();

// Replace the exported pool before any test file imports the app.
// Controllers access db.pool at query time (not import time), so this mutation is visible to all.
const db = require('../db/pool');
db.pool = memPool;

beforeAll(async () => {
  await runMigrations(memPool, { silent: true });
});

afterEach(async () => {
  // Delete in FK-safe order: referencing table first
  await memPool.query('DELETE FROM todos');
  await memPool.query('DELETE FROM users');
});
