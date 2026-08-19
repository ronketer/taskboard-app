const db = require('../db/pool');

const findIdByNormalizedEmail = async (normalizedEmail) => {
  const { rows } = await db.pool.query(
    `SELECT id
     FROM users
     WHERE LOWER(BTRIM(email)) = $1`,
    [normalizedEmail]
  );

  return rows[0] || null;
};

const findCredentialsByNormalizedEmail = async (normalizedEmail) => {
  const { rows } = await db.pool.query(
    `SELECT id, password
     FROM users
     WHERE LOWER(BTRIM(email)) = $1`,
    [normalizedEmail]
  );

  return rows[0] || null;
};

const create = async ({ name, email, passwordHash }, queryable = db.pool) => {
  const { rows } = await queryable.query(
    `INSERT INTO users (name, email, password)
     VALUES ($1, $2, $3)
     RETURNING id`,
    [name, email, passwordHash]
  );

  return rows[0];
};

module.exports = {
  findIdByNormalizedEmail,
  findCredentialsByNormalizedEmail,
  create,
};
