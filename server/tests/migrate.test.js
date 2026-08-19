const fs = require('fs');
const path = require('path');
const os = require('os');
const { createTestDb } = require('./test-utils');
const {
  discoverMigrations,
  ensureMigrationTable,
  getAppliedVersions,
  verifyLegacyUsersSchema,
  verifyLegacyTodosSchema,
  runMigrations,
} = require('../db/migrate');

describe('PostgreSQL Migration Runner', () => {
  let mem;
  let pool;

  beforeEach(() => {
    mem = createTestDb();
    const { Pool } = mem.adapters.createPg();
    pool = new Pool();
  });

  afterEach(async () => {
    await pool.end();
  });

  describe('Migration Discovery', () => {
    it('should discover and sort real migration files in deterministic ascending order', () => {
      const migrations = discoverMigrations();

      expect(migrations.length).toBeGreaterThanOrEqual(5);
      expect(migrations[0].name).toBe('001_create_users.sql');
      expect(migrations[1].name).toBe('002_create_todos.sql');
      expect(migrations[2].name).toBe('003_enforce_normalized_email_uniqueness.sql');
      expect(migrations[3].name).toBe('004_add_todos_ownership_pagination_index.sql');
      expect(migrations[4].name).toBe('005_add_boards_and_memberships.sql');

      // Verify files actually exist on disk
      for (const m of migrations) {
        expect(fs.existsSync(m.filepath)).toBe(true);
      }
    });

    it('should filter out non-SQL and non-conforming files', () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'test-migrate-discovery-'));
      try {
        fs.writeFileSync(path.join(tempDir, '001_init.sql'), 'SELECT 1;');
        fs.writeFileSync(path.join(tempDir, '002_add_table.sql'), 'SELECT 1;');
        fs.writeFileSync(path.join(tempDir, 'README.md'), '# Migrations');
        fs.writeFileSync(path.join(tempDir, 'notes.txt'), 'notes');
        fs.writeFileSync(path.join(tempDir, '.DS_Store'), '');

        const migrations = discoverMigrations(tempDir);
        expect(migrations.map((m) => m.name)).toEqual(['001_init.sql', '002_add_table.sql']);
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });
  });

  describe('Fresh Database Initialization', () => {
    it('should create schema_migrations, apply all migrations, and record history', async () => {
      const result = await runMigrations(pool, { silent: true });

      expect(result.alreadyApplied).toEqual([]);
      expect(result.applied).toEqual([
        '001_create_users.sql',
        '002_create_todos.sql',
        '003_enforce_normalized_email_uniqueness.sql',
        '004_add_todos_ownership_pagination_index.sql',
        '005_add_boards_and_memberships.sql',
      ]);

      // Verify schema_migrations table exists and has rows
      const history = await pool.query(
        'SELECT version, applied_at FROM schema_migrations ORDER BY version ASC'
      );
      expect(history.rows).toHaveLength(5);
      expect(history.rows[0].version).toBe('001_create_users.sql');
      expect(history.rows[0].applied_at).toBeDefined();
      expect(history.rows[1].version).toBe('002_create_todos.sql');
      expect(history.rows[1].applied_at).toBeDefined();
      expect(history.rows[2].version).toBe('003_enforce_normalized_email_uniqueness.sql');
      expect(history.rows[2].applied_at).toBeDefined();
      expect(history.rows[3].version).toBe('004_add_todos_ownership_pagination_index.sql');
      expect(history.rows[3].applied_at).toBeDefined();
      expect(history.rows[4].version).toBe('005_add_boards_and_memberships.sql');
      expect(history.rows[4].applied_at).toBeDefined();

      // Verify application tables were created
      const userTableCheck = await pool.query('SELECT * FROM users');
      expect(userTableCheck.rows).toEqual([]);

      const todoTableCheck = await pool.query('SELECT * FROM todos');
      expect(todoTableCheck.rows).toEqual([]);

      const boardTableCheck = await pool.query('SELECT * FROM boards');
      expect(boardTableCheck.rows).toEqual([]);

      const membershipTableCheck = await pool.query('SELECT * FROM board_members');
      expect(membershipTableCheck.rows).toEqual([]);
    });
  });

  describe('Repeat Execution & Idempotency', () => {
    it('should skip already-applied migrations on second run without duplicating schema', async () => {
      // First run: applies migrations
      const firstRun = await runMigrations(pool, { silent: true });
      expect(firstRun.applied).toHaveLength(5);

      // Seed a user to prove data is not wiped or recreated
      await pool.query(
        "INSERT INTO users (name, email, password) VALUES ('Existing User', 'existing@example.com', 'hashedpassword')"
      );

      // Second run: should be a no-op
      const secondRun = await runMigrations(pool, { silent: true });
      expect(secondRun.applied).toEqual([]);
      expect(secondRun.alreadyApplied).toEqual([
        '001_create_users.sql',
        '002_create_todos.sql',
        '003_enforce_normalized_email_uniqueness.sql',
        '004_add_todos_ownership_pagination_index.sql',
        '005_add_boards_and_memberships.sql',
      ]);

      // Verify pre-existing data remains intact
      const users = await pool.query("SELECT email FROM users WHERE email = 'existing@example.com'");
      expect(users.rows).toHaveLength(1);
    });
  });

  describe('Compatible Legacy Database Adoption', () => {
    it('should adopt a database with pre-existing compatible tables and normalize emails', async () => {
      // Simulate pre-existing database tables created before schema_migrations existed
      await pool.query(`
        CREATE TABLE users (
          id SERIAL PRIMARY KEY,
          name VARCHAR(30) NOT NULL,
          email VARCHAR(255) NOT NULL UNIQUE,
          password TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE TABLE todos (
          id SERIAL PRIMARY KEY,
          title VARCHAR(50) NOT NULL,
          description TEXT,
          completed BOOLEAN NOT NULL DEFAULT FALSE,
          created_by INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `);

      // Insert pre-existing legacy data with mixed casing and whitespace
      await pool.query(
        "INSERT INTO users (id, name, email, password) VALUES (1, 'Legacy User', '  Ron.Keter@Example.COM  ', 'pass1234')"
      );
      await pool.query(
        "INSERT INTO todos (id, title, created_by) VALUES (1, 'Legacy Todo', 1)"
      );

      // Run migrations on legacy DB
      const result = await runMigrations(pool, { silent: true });
      expect(result.applied).toEqual([
        '001_create_users.sql',
        '002_create_todos.sql',
        '003_enforce_normalized_email_uniqueness.sql',
        '004_add_todos_ownership_pagination_index.sql',
        '005_add_boards_and_memberships.sql',
      ]);

      // Verify schema_migrations recorded all migrations
      const versions = await getAppliedVersions(pool);
      expect(versions.has('001_create_users.sql')).toBe(true);
      expect(versions.has('002_create_todos.sql')).toBe(true);
      expect(versions.has('003_enforce_normalized_email_uniqueness.sql')).toBe(true);
      expect(versions.has('004_add_todos_ownership_pagination_index.sql')).toBe(true);
      expect(versions.has('005_add_boards_and_memberships.sql')).toBe(true);

      // Verify legacy user's email was safely normalized to canonical lowercase & trimmed
      const legacyUser = await pool.query('SELECT * FROM users WHERE id = 1');
      expect(legacyUser.rows[0].email).toBe('ron.keter@example.com');

      const legacyBoard = await pool.query(
        `SELECT b.id, b.name, b.created_by, b.is_personal, bm.role
         FROM boards b
         JOIN board_members bm ON bm.board_id = b.id
         WHERE b.created_by = 1 AND bm.user_id = 1`
      );
      expect(legacyBoard.rows).toHaveLength(1);
      expect(legacyBoard.rows[0].name).toBe('Personal');
      expect(legacyBoard.rows[0].is_personal).toBe(true);
      expect(legacyBoard.rows[0].role).toBe('OWNER');

      const legacyTodo = await pool.query('SELECT * FROM todos WHERE id = 1');
      expect(legacyTodo.rows[0].title).toBe('Legacy Todo');
      expect(legacyTodo.rows[0].board_id).toBe(legacyBoard.rows[0].id);
    });
  });

  describe('Migration 005: Boards and Memberships', () => {
    it('should backfill one Personal board and OWNER membership per existing user', async () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'test-pre-boards-'));

      try {
        for (const filename of [
          '001_create_users.sql',
          '002_create_todos.sql',
          '003_enforce_normalized_email_uniqueness.sql',
          '004_add_todos_ownership_pagination_index.sql',
        ]) {
          fs.copyFileSync(
            path.join(__dirname, '../db/migrations', filename),
            path.join(tempDir, filename)
          );
        }

        await runMigrations(pool, { migrationsDir: tempDir, silent: true });

        await pool.query(
          `INSERT INTO users (id, name, email, password)
           VALUES
             (10, 'Alice', 'alice@example.com', 'password1'),
             (20, 'Bob', 'bob@example.com', 'password2')`
        );
        await pool.query(
          `INSERT INTO todos (id, title, created_by)
           VALUES
             (101, 'Alice Todo', 10),
             (102, 'Bob Todo', 20)`
        );

        await runMigrations(pool, { silent: true });

        const boards = await pool.query(
          `SELECT created_by, name, is_personal
           FROM boards
           ORDER BY created_by`
        );
        expect(boards.rows).toEqual([
          { created_by: 10, name: 'Personal', is_personal: true },
          { created_by: 20, name: 'Personal', is_personal: true },
        ]);

        const memberships = await pool.query(
          `SELECT b.created_by, bm.user_id, bm.role
           FROM board_members bm
           JOIN boards b ON b.id = bm.board_id
           ORDER BY b.created_by`
        );
        expect(memberships.rows).toEqual([
          { created_by: 10, user_id: 10, role: 'OWNER' },
          { created_by: 20, user_id: 20, role: 'OWNER' },
        ]);

        const todos = await pool.query(
          `SELECT t.id, t.created_by, b.created_by AS board_creator
           FROM todos t
           JOIN boards b ON b.id = t.board_id
           ORDER BY t.id`
        );
        expect(todos.rows).toEqual([
          { id: 101, created_by: 10, board_creator: 10 },
          { id: 102, created_by: 20, board_creator: 20 },
        ]);
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it('should enforce Personal-board, owner, membership, and todo board invariants', async () => {
      await runMigrations(pool, { silent: true });

      const userA = await pool.query(
        `INSERT INTO users (name, email, password)
         VALUES ('User A', 'user-a@example.com', 'password1')
         RETURNING id`
      );
      const userB = await pool.query(
        `INSERT INTO users (name, email, password)
         VALUES ('User B', 'user-b@example.com', 'password2')
         RETURNING id`
      );

      const userAId = userA.rows[0].id;
      const userBId = userB.rows[0].id;

      const board = await pool.query(
        `INSERT INTO boards (name, created_by, is_personal)
         VALUES ('Personal', $1, TRUE)
         RETURNING id`,
        [userAId]
      );
      const boardId = board.rows[0].id;

      await pool.query(
        `INSERT INTO board_members (board_id, user_id, role)
         VALUES ($1, $2, 'OWNER')`,
        [boardId, userAId]
      );

      await expect(
        pool.query(
          `INSERT INTO boards (name, created_by, is_personal)
           VALUES ('Another Personal', $1, TRUE)`,
          [userAId]
        )
      ).rejects.toThrow(/unique|duplicate/i);

      await expect(
        pool.query(
          `INSERT INTO board_members (board_id, user_id, role)
           VALUES ($1, $2, 'OWNER')`,
          [boardId, userBId]
        )
      ).rejects.toThrow(/unique|duplicate/i);

      await pool.query(
        `INSERT INTO board_members (board_id, user_id, role)
         VALUES ($1, $2, 'MEMBER')`,
        [boardId, userBId]
      );

      await expect(
        pool.query(
          `INSERT INTO board_members (board_id, user_id, role)
           VALUES ($1, $2, 'MEMBER')`,
          [boardId, userBId]
        )
      ).rejects.toThrow(/unique|duplicate/i);

      const userC = await pool.query(
        `INSERT INTO users (name, email, password)
         VALUES ('User C', 'user-c@example.com', 'password3')
         RETURNING id`
      );

      await expect(
        pool.query(
          `INSERT INTO board_members (board_id, user_id, role)
           VALUES ($1, $2, 'ADMIN')`,
          [boardId, userC.rows[0].id]
        )
      ).rejects.toThrow();

      await expect(
        pool.query(
          `INSERT INTO todos (title, created_by)
           VALUES ('Missing Board', $1)`,
          [userAId]
        )
      ).rejects.toThrow();
    });
  });

  describe('Migration 003: Enforce Normalized Email Uniqueness', () => {
    it('should normalize existing mixed-case email to lowercase', async () => {
      // Setup tables without migration 003
      await pool.query(`
        CREATE TABLE users (
          id SERIAL PRIMARY KEY,
          name VARCHAR(30) NOT NULL,
          email VARCHAR(255) NOT NULL UNIQUE,
          password TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE TABLE todos (
          id SERIAL PRIMARY KEY,
          title VARCHAR(50) NOT NULL,
          description TEXT,
          completed BOOLEAN NOT NULL DEFAULT FALSE,
          created_by INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `);

      await pool.query(
        "INSERT INTO users (name, email, password) VALUES ('Alice', 'Alice.Smith@Domain.COM', 'password123')"
      );

      await runMigrations(pool, { silent: true });

      const { rows } = await pool.query("SELECT email FROM users WHERE name = 'Alice'");
      expect(rows[0].email).toBe('alice.smith@domain.com');
    });

    it('should trim surrounding whitespace from existing emails', async () => {
      await pool.query(`
        CREATE TABLE users (
          id SERIAL PRIMARY KEY,
          name VARCHAR(30) NOT NULL,
          email VARCHAR(255) NOT NULL UNIQUE,
          password TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE TABLE todos (
          id SERIAL PRIMARY KEY,
          title VARCHAR(50) NOT NULL,
          description TEXT,
          completed BOOLEAN NOT NULL DEFAULT FALSE,
          created_by INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `);

      await pool.query(
        "INSERT INTO users (name, email, password) VALUES ('Bob', '   bob@domain.com   ', 'password123')"
      );

      await runMigrations(pool, { silent: true });

      const { rows } = await pool.query("SELECT email FROM users WHERE name = 'Bob'");
      expect(rows[0].email).toBe('bob@domain.com');
    });

    it('should normalize existing emails with both mixed-case and whitespace', async () => {
      await pool.query(`
        CREATE TABLE users (
          id SERIAL PRIMARY KEY,
          name VARCHAR(30) NOT NULL,
          email VARCHAR(255) NOT NULL UNIQUE,
          password TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE TABLE todos (
          id SERIAL PRIMARY KEY,
          title VARCHAR(50) NOT NULL,
          description TEXT,
          completed BOOLEAN NOT NULL DEFAULT FALSE,
          created_by INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `);

      await pool.query(
        "INSERT INTO users (name, email, password) VALUES ('Charlie', '  Charlie.Brown@PEANUTS.ORG  ', 'password123')"
      );

      await runMigrations(pool, { silent: true });

      const { rows } = await pool.query("SELECT email FROM users WHERE name = 'Charlie'");
      expect(rows[0].email).toBe('charlie.brown@peanuts.org');
    });

    it('should fail migration and preserve original data when normalized email collision is detected', async () => {
      await pool.query(`
        CREATE TABLE users (
          id SERIAL PRIMARY KEY,
          name VARCHAR(30) NOT NULL,
          email VARCHAR(255) NOT NULL,
          password TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE TABLE todos (
          id SERIAL PRIMARY KEY,
          title VARCHAR(50) NOT NULL,
          description TEXT,
          completed BOOLEAN NOT NULL DEFAULT FALSE,
          created_by INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `);

      // Seed colliding emails: user 12 and user 37
      await pool.query(
        "INSERT INTO users (id, name, email, password) VALUES (12, 'User 12', 'Ron@Example.com', 'pass12')"
      );
      await pool.query(
        "INSERT INTO users (id, name, email, password) VALUES (37, 'User 37', 'ron@example.com', 'pass37')"
      );

      // Run migrations: 001 and 002 adopt, but 003 must fail due to unique index collision on LOWER(BTRIM(email))
      await expect(runMigrations(pool, { silent: true })).rejects.toThrow(/unique|duplicate/i);

      // Verify migration 003 was NOT recorded
      const versions = await getAppliedVersions(pool);
      expect(versions.has('001_create_users.sql')).toBe(true);
      expect(versions.has('002_create_todos.sql')).toBe(true);
      expect(versions.has('003_enforce_normalized_email_uniqueness.sql')).toBe(false);

      // Verify both original rows were NOT modified, merged, or deleted
      const checkUser12 = await pool.query('SELECT email FROM users WHERE id = 12');
      expect(checkUser12.rows[0].email).toBe('Ron@Example.com');

      const checkUser37 = await pool.query('SELECT email FROM users WHERE id = 37');
      expect(checkUser37.rows[0].email).toBe('ron@example.com');
    });

    it('should reject case-insensitive and whitespace-variant email duplicates via database invariant', async () => {
      // Run all migrations
      await runMigrations(pool, { silent: true });

      // Insert canonical email
      await pool.query(
        "INSERT INTO users (name, email, password) VALUES ('User 1', 'user@example.com', 'pass12345')"
      );

      // Rejection variant 1: uppercase
      await expect(
        pool.query(
          "INSERT INTO users (name, email, password) VALUES ('User 2', 'USER@EXAMPLE.COM', 'pass12345')"
        )
      ).rejects.toThrow(/unique|duplicate/i);

      // Rejection variant 2: leading whitespace
      await expect(
        pool.query(
          "INSERT INTO users (name, email, password) VALUES ('User 3', ' user@example.com', 'pass12345')"
        )
      ).rejects.toThrow(/unique|duplicate/i);

      // Rejection variant 3: mixed-case with trailing whitespace
      await expect(
        pool.query(
          "INSERT INTO users (name, email, password) VALUES ('User 4', 'USER@EXAMPLE.COM   ', 'pass12345')"
        )
      ).rejects.toThrow(/unique|duplicate/i);
    });
  });

  describe('Incompatible Legacy Database Rejection', () => {
    it('should reject legacy users table missing a required column (e.g. password)', async () => {
      // Create incomplete users table (missing password)
      await pool.query(`
        CREATE TABLE users (
          id SERIAL PRIMARY KEY,
          name VARCHAR(30) NOT NULL,
          email VARCHAR(255) NOT NULL UNIQUE,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `);

      await expect(runMigrations(pool, { silent: true })).rejects.toThrow(
        /Legacy table "users" is missing required baseline column: "password"/i
      );

      // Verify 001_create_users.sql was NOT recorded
      const versions = await getAppliedVersions(pool);
      expect(versions.has('001_create_users.sql')).toBe(false);
    });

    it('should reject legacy users table missing id or email column', async () => {
      await pool.query(`
        CREATE TABLE users (
          name VARCHAR(30) NOT NULL
        );
      `);

      await expect(runMigrations(pool, { silent: true })).rejects.toThrow(
        /Legacy table "users" is missing required baseline column: "id"/i
      );

      const versions = await getAppliedVersions(pool);
      expect(versions.has('001_create_users.sql')).toBe(false);
    });

    it('should reject legacy todos table missing a required column (e.g. created_by)', async () => {
      // First create valid users table
      await pool.query(`
        CREATE TABLE users (
          id SERIAL PRIMARY KEY,
          name VARCHAR(30) NOT NULL,
          email VARCHAR(255) NOT NULL UNIQUE,
          password TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `);

      // Create incomplete todos table (missing created_by)
      await pool.query(`
        CREATE TABLE todos (
          id SERIAL PRIMARY KEY,
          title VARCHAR(50) NOT NULL,
          description TEXT,
          completed BOOLEAN NOT NULL DEFAULT FALSE,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `);

      await expect(runMigrations(pool, { silent: true })).rejects.toThrow(
        /Legacy table "todos" is missing required baseline column: "created_by"/i
      );

      // Verify 001 was adopted (since users was valid) but 002 was NOT recorded
      const versions = await getAppliedVersions(pool);
      expect(versions.has('001_create_users.sql')).toBe(true);
      expect(versions.has('002_create_todos.sql')).toBe(false);
    });

    it('should reject legacy todos table missing title or completed column', async () => {
      await pool.query(`
        CREATE TABLE users (
          id SERIAL PRIMARY KEY,
          name VARCHAR(30) NOT NULL,
          email VARCHAR(255) NOT NULL UNIQUE,
          password TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE TABLE todos (
          id SERIAL PRIMARY KEY,
          description TEXT
        );
      `);

      await expect(runMigrations(pool, { silent: true })).rejects.toThrow(
        /Legacy table "todos" is missing required baseline column: "title"/i
      );

      const versions = await getAppliedVersions(pool);
      expect(versions.has('002_create_todos.sql')).toBe(false);
    });

    it('should not mutate, drop, or truncate existing data when legacy schema validation fails', async () => {
      // Incomplete table with data
      await pool.query(`
        CREATE TABLE users (
          id SERIAL PRIMARY KEY,
          name VARCHAR(30) NOT NULL,
          email VARCHAR(255) NOT NULL
        );
        INSERT INTO users (id, name, email) VALUES (42, 'Do Not Delete', 'keep@example.com');
      `);

      await expect(runMigrations(pool, { silent: true })).rejects.toThrow();

      // Data is intact
      const check = await pool.query('SELECT * FROM users WHERE id = 42');
      expect(check.rows).toHaveLength(1);
      expect(check.rows[0].name).toBe('Do Not Delete');
    });
  });

  describe('Constraint and Nullability Verification Logic', () => {
    it('should reject users schema when a required NOT NULL column is nullable', async () => {
      const mockClient = {
        query: jest.fn().mockImplementation((sql, params) => {
          if (sql.includes('information_schema.tables')) {
            return Promise.resolve({ rows: [{ table_name: 'users' }] });
          }
          if (sql.includes('information_schema.columns')) {
            return Promise.resolve({
              rows: [
                { column_name: 'id', is_nullable: 'NO', data_type: 'integer' },
                { column_name: 'name', is_nullable: 'NO', data_type: 'text' },
                { column_name: 'email', is_nullable: 'YES', data_type: 'text' }, // Nullable!
                { column_name: 'password', is_nullable: 'NO', data_type: 'text' },
                { column_name: 'created_at', is_nullable: 'NO', data_type: 'timestamptz' },
              ],
            });
          }
          if (sql.includes('information_schema.table_constraints')) {
            return Promise.resolve({
              rows: [
                { constraint_type: 'PRIMARY KEY', column_name: 'id', foreign_table_name: null },
                { constraint_type: 'UNIQUE', column_name: 'email', foreign_table_name: null },
              ],
            });
          }
          return Promise.resolve({ rows: [] });
        }),
      };

      await expect(verifyLegacyUsersSchema(mockClient)).rejects.toThrow(
        /Legacy table "users" column "email" must be NOT NULL/i
      );
    });

    it('should reject users schema when PRIMARY KEY on id is missing in constraints', async () => {
      const mockClient = {
        query: jest.fn().mockImplementation((sql, params) => {
          if (sql.includes('information_schema.tables')) {
            return Promise.resolve({ rows: [{ table_name: 'users' }] });
          }
          if (sql.includes('information_schema.columns')) {
            return Promise.resolve({
              rows: [
                { column_name: 'id', is_nullable: 'NO', data_type: 'integer' },
                { column_name: 'name', is_nullable: 'NO', data_type: 'text' },
                { column_name: 'email', is_nullable: 'NO', data_type: 'text' },
                { column_name: 'password', is_nullable: 'NO', data_type: 'text' },
                { column_name: 'created_at', is_nullable: 'NO', data_type: 'timestamptz' },
              ],
            });
          }
          if (sql.includes('information_schema.table_constraints')) {
            return Promise.resolve({
              rows: [
                { constraint_type: 'UNIQUE', column_name: 'email', foreign_table_name: null },
              ],
            });
          }
          return Promise.resolve({ rows: [] });
        }),
      };

      await expect(verifyLegacyUsersSchema(mockClient)).rejects.toThrow(
        /Legacy table "users" must have a PRIMARY KEY on "id"/i
      );
    });

    it('should reject users schema when UNIQUE constraint on email is missing in constraints', async () => {
      const mockClient = {
        query: jest.fn().mockImplementation((sql, params) => {
          if (sql.includes('information_schema.tables')) {
            return Promise.resolve({ rows: [{ table_name: 'users' }] });
          }
          if (sql.includes('information_schema.columns')) {
            return Promise.resolve({
              rows: [
                { column_name: 'id', is_nullable: 'NO', data_type: 'integer' },
                { column_name: 'name', is_nullable: 'NO', data_type: 'text' },
                { column_name: 'email', is_nullable: 'NO', data_type: 'text' },
                { column_name: 'password', is_nullable: 'NO', data_type: 'text' },
                { column_name: 'created_at', is_nullable: 'NO', data_type: 'timestamptz' },
              ],
            });
          }
          if (sql.includes('information_schema.table_constraints')) {
            return Promise.resolve({
              rows: [
                { constraint_type: 'PRIMARY KEY', column_name: 'id', foreign_table_name: null },
              ],
            });
          }
          return Promise.resolve({ rows: [] });
        }),
      };

      await expect(verifyLegacyUsersSchema(mockClient)).rejects.toThrow(
        /Legacy table "users" must have a UNIQUE constraint on "email"/i
      );
    });

    it('should reject todos schema when FOREIGN KEY on created_by -> users is missing in constraints', async () => {
      const mockClient = {
        query: jest.fn().mockImplementation((sql, params) => {
          if (sql.includes('information_schema.tables')) {
            return Promise.resolve({ rows: [{ table_name: 'todos' }] });
          }
          if (sql.includes('information_schema.columns')) {
            return Promise.resolve({
              rows: [
                { column_name: 'id', is_nullable: 'NO', data_type: 'integer' },
                { column_name: 'title', is_nullable: 'NO', data_type: 'text' },
                { column_name: 'description', is_nullable: 'YES', data_type: 'text' },
                { column_name: 'completed', is_nullable: 'NO', data_type: 'boolean' },
                { column_name: 'created_by', is_nullable: 'NO', data_type: 'integer' },
                { column_name: 'created_at', is_nullable: 'NO', data_type: 'timestamptz' },
                { column_name: 'updated_at', is_nullable: 'NO', data_type: 'timestamptz' },
              ],
            });
          }
          if (sql.includes('information_schema.table_constraints')) {
            return Promise.resolve({
              rows: [
                { constraint_type: 'PRIMARY KEY', column_name: 'id', foreign_table_name: null },
              ],
            });
          }
          return Promise.resolve({ rows: [] });
        }),
      };

      await expect(verifyLegacyTodosSchema(mockClient)).rejects.toThrow(
        /Legacy table "todos" must have a FOREIGN KEY constraint on "created_by" -> "users\(id\)"/i
      );
    });
  });

  describe('Atomic Rollback on Migration Failure', () => {
    it('should rollback failed migration and not record it in schema_migrations', async () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'test-migrate-fail-'));
      try {
        // Migration 1 is valid
        fs.writeFileSync(
          path.join(tempDir, '001_step_one.sql'),
          'CREATE TABLE step_one_table (id INT PRIMARY KEY);'
        );
        // Migration 2 contains a syntax error
        fs.writeFileSync(
          path.join(tempDir, '002_step_two_broken.sql'),
          'CREATE TABLE step_two_table (id INT PRIMARY KEY); INVALID SQL SYNTAX ERROR;'
        );

        await expect(
          runMigrations(pool, { migrationsDir: tempDir, silent: true })
        ).rejects.toThrow(/Failed to apply migration "002_step_two_broken.sql"/);

        // Verify step_one was committed and recorded
        const versions = await getAppliedVersions(pool);
        expect(versions.has('001_step_one.sql')).toBe(true);
        expect(versions.has('002_step_two_broken.sql')).toBe(false);

        const stepOneCheck = await pool.query('SELECT * FROM step_one_table');
        expect(stepOneCheck.rows).toEqual([]);

        // Verify step_two_table was rolled back (does not exist)
        await expect(pool.query('SELECT * FROM step_two_table')).rejects.toThrow();
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });
  });
});
