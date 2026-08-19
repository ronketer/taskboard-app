process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key-for-jwt-signing';
process.env.JWT_EXPIRATION = '30d';
process.env.PORT = 3001;
// Provide a dummy URL so pg.Pool constructor doesn't warn; it is replaced below.
process.env.DATABASE_URL = 'postgresql://localhost/test';

jest.setTimeout(30000);

const { createTestDb } = require('./test-utils');
const { runMigrations } = require('../db/migrate');

const mem = createTestDb();

const { Pool } = mem.adapters.createPg();
const memPool = new Pool();

// Replace the exported pool before any test file imports the app.
// Controllers access db.pool at query time (not import time), so this mutation is visible to all.
const db = require('../db/pool');
db.pool = memPool;

beforeAll(async () => {
  await runMigrations(memPool, { silent: true });

  // pg-mem currently has a partial-index lookup bug: queries can incorrectly
  // return only rows covered by a partial index. The production schema keeps
  // idx_board_members_single_owner; migration tests verify that invariant
  // separately against an isolated pg-mem database. Drop it only from this
  // shared API-test database so MEMBER rows remain visible to normal lookups.
  await memPool.query('DROP INDEX idx_board_members_single_owner');
});

afterEach(async () => {
  // Delete in FK-safe order: referencing tables first.
  await memPool.query('DELETE FROM todos');
  await memPool.query('DELETE FROM board_members');
  await memPool.query('DELETE FROM boards');
  await memPool.query('DELETE FROM users');
});
