const db = require('../db/pool');

const create = async ({ name, createdBy, isPersonal = false }, queryable = db.pool) => {
  const { rows } = await queryable.query(
    `INSERT INTO boards (name, created_by, is_personal)
     VALUES ($1, $2, $3)
     RETURNING
       id,
       name,
       created_by AS "createdBy",
       is_personal AS "isPersonal",
       created_at AS "createdAt",
       updated_at AS "updatedAt"`,
    [name, createdBy, isPersonal]
  );

  return rows[0];
};

const listForUser = async (userId, queryable = db.pool) => {
  const { rows } = await queryable.query(
    `SELECT
       b.id,
       b.name,
       b.created_by AS "createdBy",
       b.is_personal AS "isPersonal",
       b.created_at AS "createdAt",
       b.updated_at AS "updatedAt",
       bm.role
     FROM boards b
     INNER JOIN board_members bm ON bm.board_id = b.id
     WHERE bm.user_id = $1
     ORDER BY b.is_personal DESC, b.created_at ASC, b.id ASC`,
    [userId]
  );

  return rows;
};

module.exports = {
  create,
  listForUser,
};
