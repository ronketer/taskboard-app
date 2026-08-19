const fs = require('fs');
const path = require('path');

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

/**
 * Discovers and returns all SQL migration files sorted deterministically.
 *
 * @param {string} dir - Directory containing migration files
 * @returns {Array<{ name: string, filepath: string }>}
 */
const discoverMigrations = (dir = MIGRATIONS_DIR) => {
  if (!fs.existsSync(dir)) {
    return [];
  }

  const files = fs.readdirSync(dir);
  const migrationFiles = files
    .filter((file) => /^\d+.*\.sql$/i.test(file))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

  return migrationFiles.map((name) => ({
    name,
    filepath: path.join(dir, name),
  }));
};

/**
 * Ensures the schema_migrations tracking table exists.
 *
 * @param {import('pg').ClientBase} client
 */
const ensureMigrationTable = async (client) => {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version     VARCHAR(255) PRIMARY KEY,
      applied_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
};

/**
 * Retrieves the set of already applied migration versions.
 *
 * @param {import('pg').ClientBase} client
 * @returns {Promise<Set<string>>}
 */
const getAppliedVersions = async (client) => {
  const { rows } = await client.query(
    'SELECT version FROM schema_migrations ORDER BY version ASC'
  );
  return new Set(rows.map((row) => row.version));
};

/**
 * Checks if a table exists in the public schema.
 *
 * @param {import('pg').ClientBase} client
 * @param {string} tableName
 * @returns {Promise<boolean>}
 */
const checkTableExists = async (client, tableName) => {
  const { rows } = await client.query(
    `SELECT table_name FROM information_schema.tables WHERE table_name = $1`,
    [tableName]
  );
  return rows.length > 0;
};

/**
 * Retrieves column metadata for a given table.
 *
 * @param {import('pg').ClientBase} client
 * @param {string} tableName
 * @returns {Promise<Map<string, { isNullable: boolean, dataType: string }>>}
 */
const getTableColumns = async (client, tableName) => {
  const { rows } = await client.query(
    `SELECT column_name, is_nullable, data_type 
     FROM information_schema.columns 
     WHERE table_name = $1`,
    [tableName]
  );
  const columnMap = new Map();
  for (const row of rows) {
    columnMap.set(row.column_name, {
      isNullable: row.is_nullable === 'YES',
      dataType: row.data_type,
    });
  }
  return columnMap;
};

/**
 * Retrieves constraint metadata for a given table.
 *
 * @param {import('pg').ClientBase} client
 * @param {string} tableName
 * @returns {Promise<Array<{ constraintType: string, columnName: string, foreignTableName: string | null }>>}
 */
const getTableConstraints = async (client, tableName) => {
  const { rows } = await client.query(
    `SELECT 
       tc.constraint_type,
       kcu.column_name,
       ccu.table_name AS foreign_table_name
     FROM information_schema.table_constraints tc
     JOIN information_schema.key_column_usage kcu
       ON tc.constraint_name = kcu.constraint_name
       AND tc.table_schema = kcu.table_schema
     LEFT JOIN information_schema.constraint_column_usage ccu
       ON tc.constraint_name = ccu.constraint_name
       AND tc.table_schema = ccu.table_schema
     WHERE tc.table_name = $1`,
    [tableName]
  );
  return rows.map((r) => ({
    constraintType: r.constraint_type,
    columnName: r.column_name,
    foreignTableName: r.foreign_table_name,
  }));
};

/**
 * Verifies compatibility of an existing legacy 'users' table against 001_create_users baseline.
 *
 * @param {import('pg').ClientBase} client
 */
const verifyLegacyUsersSchema = async (client) => {
  const columns = await getTableColumns(client, 'users');
  const requiredNotNullColumns = ['id', 'name', 'email', 'password', 'created_at'];

  for (const col of requiredNotNullColumns) {
    if (!columns.has(col)) {
      throw new Error(`Legacy table "users" is missing required baseline column: "${col}"`);
    }
    if (columns.get(col).isNullable) {
      throw new Error(`Legacy table "users" column "${col}" must be NOT NULL`);
    }
  }

  const constraints = await getTableConstraints(client, 'users');
  if (constraints.length > 0) {
    const hasPrimaryKey = constraints.some(
      (c) => c.constraintType === 'PRIMARY KEY' && c.columnName === 'id'
    );
    if (!hasPrimaryKey) {
      throw new Error('Legacy table "users" must have a PRIMARY KEY on "id"');
    }

    const hasUniqueEmail = constraints.some(
      (c) => (c.constraintType === 'UNIQUE' || c.constraintType === 'PRIMARY KEY') && c.columnName === 'email'
    );
    if (!hasUniqueEmail) {
      throw new Error('Legacy table "users" must have a UNIQUE constraint on "email"');
    }
  }
};

/**
 * Verifies compatibility of an existing legacy 'todos' table against 002_create_todos baseline.
 *
 * @param {import('pg').ClientBase} client
 */
const verifyLegacyTodosSchema = async (client) => {
  const columns = await getTableColumns(client, 'todos');
  const requiredColumns = ['id', 'title', 'description', 'completed', 'created_by', 'created_at', 'updated_at'];
  const requiredNotNullColumns = ['id', 'title', 'completed', 'created_by', 'created_at', 'updated_at'];

  for (const col of requiredColumns) {
    if (!columns.has(col)) {
      throw new Error(`Legacy table "todos" is missing required baseline column: "${col}"`);
    }
  }

  for (const col of requiredNotNullColumns) {
    if (columns.get(col).isNullable) {
      throw new Error(`Legacy table "todos" column "${col}" must be NOT NULL`);
    }
  }

  const constraints = await getTableConstraints(client, 'todos');
  if (constraints.length > 0) {
    const hasPrimaryKey = constraints.some(
      (c) => c.constraintType === 'PRIMARY KEY' && c.columnName === 'id'
    );
    if (!hasPrimaryKey) {
      throw new Error('Legacy table "todos" must have a PRIMARY KEY on "id"');
    }

    const hasForeignKey = constraints.some(
      (c) => c.constraintType === 'FOREIGN KEY' && c.columnName === 'created_by' && c.foreignTableName === 'users'
    );
    if (!hasForeignKey) {
      throw new Error('Legacy table "todos" must have a FOREIGN KEY constraint on "created_by" -> "users(id)"');
    }
  }
};

/**
 * Baseline verifiers for pre-migration tables.
 */
const BASELINE_VERIFIERS = {
  '001_create_users.sql': {
    tableName: 'users',
    verify: verifyLegacyUsersSchema,
  },
  '002_create_todos.sql': {
    tableName: 'todos',
    verify: verifyLegacyTodosSchema,
  },
};

/**
 * Applies a single migration within an atomic transaction.
 *
 * @param {import('pg').ClientBase} client
 * @param {{ name: string, filepath: string }} migration
 */
const applyMigration = async (client, migration) => {
  const sql = fs.readFileSync(migration.filepath, 'utf8');

  await client.query('BEGIN');
  try {
    await client.query(sql);
    await client.query(
      'INSERT INTO schema_migrations (version) VALUES ($1)',
      [migration.name]
    );
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw new Error(`Failed to apply migration "${migration.name}": ${err.message}`);
  }
};

/**
 * Adopts a verified pre-existing legacy table and records its baseline version.
 *
 * @param {import('pg').ClientBase} client
 * @param {string} migrationName
 */
const recordBaselineAdoption = async (client, migrationName) => {
  await client.query('BEGIN');
  try {
    await client.query(
      'INSERT INTO schema_migrations (version) VALUES ($1)',
      [migrationName]
    );
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw new Error(`Failed to record adoption of "${migrationName}": ${err.message}`);
  }
};

/**
 * Runs all unapplied migrations against a PostgreSQL pool or client.
 *
 * @param {import('pg').Pool | import('pg').ClientBase} poolOrClient
 * @param {{ migrationsDir?: string, silent?: boolean }} [options]
 * @returns {Promise<{ applied: string[], alreadyApplied: string[] }>}
 */
const runMigrations = async (poolOrClient, options = {}) => {
  const { migrationsDir = MIGRATIONS_DIR, silent = false } = options;

  const isPool = typeof poolOrClient.connect === 'function';
  const client = isPool ? await poolOrClient.connect() : poolOrClient;

  try {
    await ensureMigrationTable(client);
    const appliedVersions = await getAppliedVersions(client);
    const availableMigrations = discoverMigrations(migrationsDir);

    const pendingMigrations = availableMigrations.filter(
      (m) => !appliedVersions.has(m.name)
    );

    const applied = [];
    for (const migration of pendingMigrations) {
      const baseline = BASELINE_VERIFIERS[migration.name];

      if (baseline) {
        const tableExists = await checkTableExists(client, baseline.tableName);

        if (tableExists) {
          // Pre-existing table found: verify schema compatibility before recording
          if (!silent) {
            console.log(
              `Verifying existing legacy table "${baseline.tableName}" for baseline migration: ${migration.name}`
            );
          }
          await baseline.verify(client);
          await recordBaselineAdoption(client, migration.name);
          applied.push(migration.name);
          if (!silent) {
            console.log(
              `Adopted existing legacy table "${baseline.tableName}" for baseline migration: ${migration.name}`
            );
          }
          continue;
        }
      }

      // Normal migration execution (fresh table or non-baseline migration)
      if (!silent) {
        console.log(`Applying migration: ${migration.name}`);
      }
      await applyMigration(client, migration);
      applied.push(migration.name);
      if (!silent) {
        console.log(`Applied migration: ${migration.name}`);
      }
    }

    if (!silent && applied.length === 0) {
      console.log('Database is up to date. No migrations to apply.');
    }

    return {
      applied,
      alreadyApplied: Array.from(appliedVersions),
    };
  } finally {
    if (isPool && typeof client.release === 'function') {
      client.release();
    }
  }
};

// CLI execution handler
if (require.main === module) {
  require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
  const { pool } = require('./pool');

  runMigrations(pool)
    .then(({ applied, alreadyApplied }) => {
      console.log(
        `Migration run completed. ${applied.length} applied, ${alreadyApplied.length} previously recorded.`
      );
      return pool.end();
    })
    .catch((err) => {
      console.error('Migration execution failed:', err.message || err);
      pool.end().finally(() => process.exit(1));
    });
}

module.exports = {
  discoverMigrations,
  ensureMigrationTable,
  getAppliedVersions,
  checkTableExists,
  getTableColumns,
  getTableConstraints,
  verifyLegacyUsersSchema,
  verifyLegacyTodosSchema,
  applyMigration,
  recordBaselineAdoption,
  runMigrations,
};
