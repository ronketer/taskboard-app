const db = require('../db/pool');

const create = async ({ name, createdBy, isPersonal = false }, queryable = db.pool) => {
  const { rows } = await queryable.query(
    `INSERT INTO boards (name, created_by, is_personal)
     VALUES ($1, $2, $3)
     RETURNING id, name, created_by, is_personal, created_at, updated_at`,
    [name, createdBy, isPersonal]
  );

  return rows[0];
};

module.exports = { create };
