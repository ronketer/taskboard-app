const db = require('../db/pool');
const { runMigrations } = require('../db/migrate');

const createUser = async (email) => {
  const {
    rows: [user],
  } = await db.pool.query(
    `INSERT INTO users (name, email, password)
     VALUES ($1, $2, $3)
     RETURNING id, email`,
    ['Database Test User', email, 'not-used-by-database-tests']
  );

  return user;
};

describe('Real PostgreSQL database invariants', () => {
  it('has applied all current migrations and remains idempotent', async () => {
    const { rows } = await db.pool.query(
      'SELECT version FROM schema_migrations ORDER BY version'
    );

    expect(rows.map((row) => row.version)).toEqual(
      expect.arrayContaining([
        '001_create_users.sql',
        '002_create_todos.sql',
        '003_enforce_normalized_email_uniqueness.sql',
        '004_add_todos_ownership_pagination_index.sql',
        '005_add_boards_and_memberships.sql',
      ])
    );

    const result = await runMigrations(db.pool, { silent: true });
    expect(result.applied).toEqual([]);
  });

  it('enforces normalized case-insensitive email uniqueness in PostgreSQL', async () => {
    await createUser('db-invariant@example.com');

    await expect(
      createUser('  DB-INVARIANT@EXAMPLE.COM  ')
    ).rejects.toMatchObject({ code: '23505' });
  });

  it('enforces one OWNER per board with the partial unique index', async () => {
    const owner = await createUser('owner-index@example.com');
    const secondUser = await createUser('second-owner@example.com');

    const {
      rows: [board],
    } = await db.pool.query(
      `INSERT INTO boards (name, created_by, is_personal)
       VALUES ($1, $2, FALSE)
       RETURNING id`,
      ['Owner Constraint Board', owner.id]
    );

    await db.pool.query(
      `INSERT INTO board_members (board_id, user_id, role)
       VALUES ($1, $2, 'OWNER')`,
      [board.id, owner.id]
    );

    await expect(
      db.pool.query(
        `INSERT INTO board_members (board_id, user_id, role)
         VALUES ($1, $2, 'OWNER')`,
        [board.id, secondUser.id]
      )
    ).rejects.toMatchObject({ code: '23505' });
  });

  it('enforces unique board membership', async () => {
    const owner = await createUser('membership-owner-db@example.com');
    const member = await createUser('membership-member-db@example.com');

    const {
      rows: [board],
    } = await db.pool.query(
      `INSERT INTO boards (name, created_by, is_personal)
       VALUES ($1, $2, FALSE)
       RETURNING id`,
      ['Membership Constraint Board', owner.id]
    );

    await db.pool.query(
      `INSERT INTO board_members (board_id, user_id, role)
       VALUES ($1, $2, 'MEMBER')`,
      [board.id, member.id]
    );

    await expect(
      db.pool.query(
        `INSERT INTO board_members (board_id, user_id, role)
         VALUES ($1, $2, 'MEMBER')`,
        [board.id, member.id]
      )
    ).rejects.toMatchObject({ code: '23505' });
  });

  it('enforces todo board foreign-key integrity', async () => {
    const user = await createUser('todo-fk-db@example.com');

    await expect(
      db.pool.query(
        `INSERT INTO todos (title, created_by, board_id)
         VALUES ($1, $2, $3)`,
        ['Invalid board reference', user.id, 2147483647]
      )
    ).rejects.toMatchObject({ code: '23503' });
  });
});
