process.env.NODE_ENV = 'test';
process.env.JWT_SECRET =
  process.env.JWT_SECRET || 'test-secret-key-for-jwt-signing';
process.env.JWT_EXPIRATION = process.env.JWT_EXPIRATION || '30d';
process.env.PORT = process.env.PORT || '3001';

if (!process.env.DATABASE_URL) {
  throw new Error(
    'DATABASE_URL is required for real PostgreSQL integration tests'
  );
}

jest.setTimeout(30000);

const db = require('../db/pool');
const { runMigrations } = require('../db/migrate');

beforeAll(async () => {
  await runMigrations(db.pool, { silent: true });
});

afterEach(async () => {
  await db.pool.query(
    'TRUNCATE TABLE todos, board_members, boards, users RESTART IDENTITY CASCADE'
  );
});

afterAll(async () => {
  await db.pool.end();
});
