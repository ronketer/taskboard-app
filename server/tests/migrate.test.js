const fs = require('fs');
const path = require('path');
const os = require('os');
const { newDb } = require('pg-mem');
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
    mem = newDb({ noAstCoverageCheck: true });
    const { Pool } = mem.adapters.createPg();
    pool = new Pool();
  });

  afterEach(async () => {
    await pool.end();
  });

  describe('Migration Discovery', () => {
    it('should discover and sort real migration files in deterministic ascending order', () => {
      const migrations = discoverMigrations();

      expect(migrations.length).toBeGreaterThanOrEqual(2);
      expect(migrations[0].name).toBe('001_create_users.sql');
      expect(migrations[1].name).toBe('002_create_todos.sql');

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
      expect(result.applied).toEqual(['001_create_users.sql', '002_create_todos.sql']);

      // Verify schema_migrations table exists and has rows
      const history = await pool.query(
        'SELECT version, applied_at FROM schema_migrations ORDER BY version ASC'
      );
      expect(history.rows).toHaveLength(2);
      expect(history.rows[0].version).toBe('001_create_users.sql');
      expect(history.rows[0].applied_at).toBeDefined();
      expect(history.rows[1].version).toBe('002_create_todos.sql');
      expect(history.rows[1].applied_at).toBeDefined();

      // Verify application tables were created
      const userTableCheck = await pool.query('SELECT * FROM users');
      expect(userTableCheck.rows).toEqual([]);

      const todoTableCheck = await pool.query('SELECT * FROM todos');
      expect(todoTableCheck.rows).toEqual([]);
    });
  });

  describe('Repeat Execution & Idempotency', () => {
    it('should skip already-applied migrations on second run without duplicating schema', async () => {
      // First run: applies migrations
      const firstRun = await runMigrations(pool, { silent: true });
      expect(firstRun.applied).toHaveLength(2);

      // Seed a user to prove data is not wiped or recreated
      await pool.query(
        "INSERT INTO users (name, email, password) VALUES ('Existing User', 'existing@example.com', 'hashedpassword')"
      );

      // Second run: should be a no-op
      const secondRun = await runMigrations(pool, { silent: true });
      expect(secondRun.applied).toEqual([]);
      expect(secondRun.alreadyApplied).toEqual(['001_create_users.sql', '002_create_todos.sql']);

      // Verify pre-existing data remains intact
      const users = await pool.query("SELECT email FROM users WHERE email = 'existing@example.com'");
      expect(users.rows).toHaveLength(1);
    });
  });

  describe('Compatible Legacy Database Adoption', () => {
    it('should adopt a database with pre-existing compatible tables safely without dropping data', async () => {
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

      // Insert pre-existing legacy data
      await pool.query(
        "INSERT INTO users (id, name, email, password) VALUES (1, 'Legacy User', 'legacy@example.com', 'pass1234')"
      );
      await pool.query(
        "INSERT INTO todos (id, title, created_by) VALUES (1, 'Legacy Todo', 1)"
      );

      // Run migrations on legacy DB
      const result = await runMigrations(pool, { silent: true });
      expect(result.applied).toEqual(['001_create_users.sql', '002_create_todos.sql']);

      // Verify schema_migrations was created and recorded both migrations
      const versions = await getAppliedVersions(pool);
      expect(versions.has('001_create_users.sql')).toBe(true);
      expect(versions.has('002_create_todos.sql')).toBe(true);

      // Verify legacy data was untouched
      const legacyUser = await pool.query('SELECT * FROM users WHERE id = 1');
      expect(legacyUser.rows[0].email).toBe('legacy@example.com');

      const legacyTodo = await pool.query('SELECT * FROM todos WHERE id = 1');
      expect(legacyTodo.rows[0].title).toBe('Legacy Todo');
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
