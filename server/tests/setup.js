process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key-for-jwt-signing';
process.env.JWT_EXPIRATION = '30d';
process.env.PORT = 3001;
// Provide a dummy URL so pg.Pool constructor doesn't warn; it is replaced below.
process.env.DATABASE_URL = 'postgresql://localhost/test';

jest.setTimeout(30000);

const { newDb } = require('pg-mem');

const mem = newDb();

mem.public.none(`
  CREATE TABLE users (
    id         SERIAL PRIMARY KEY,
    name       VARCHAR(30)  NOT NULL,
    email      VARCHAR(255) NOT NULL UNIQUE,
    password   TEXT         NOT NULL,
    created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
  )
`);

mem.public.none(`
  CREATE TABLE todos (
    id          SERIAL PRIMARY KEY,
    title       VARCHAR(50)  NOT NULL,
    description TEXT,
    completed   BOOLEAN      NOT NULL DEFAULT FALSE,
    created_by  INT          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
  )
`);

const { Pool } = mem.adapters.createPg();
const memPool = new Pool();

// Replace the exported pool before any test file imports the app.
// Controllers access db.pool at query time (not import time), so this mutation is visible to all.
const db = require('../db/pool');
db.pool = memPool;

afterEach(async () => {
  // Delete in FK-safe order: referencing table first
  await memPool.query('DELETE FROM todos');
  await memPool.query('DELETE FROM users');
});
