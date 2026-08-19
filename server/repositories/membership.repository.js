const db = require('../db/pool');

const add = async ({ boardId, userId, role }, queryable = db.pool) => {
  const { rows } = await queryable.query(
    `INSERT INTO board_members (board_id, user_id, role)
     VALUES ($1, $2, $3)
     RETURNING board_id, user_id, role, joined_at`,
    [boardId, userId, role]
  );

  return rows[0];
};

module.exports = { add };
