const db = require('../db/pool');

const add = async ({ boardId, userId, role }, queryable = db.pool) => {
  const { rows } = await queryable.query(
    `INSERT INTO board_members (board_id, user_id, role)
     VALUES ($1, $2, $3)
     RETURNING
       board_id AS "boardId",
       user_id AS "userId",
       role,
       joined_at AS "joinedAt"`,
    [boardId, userId, role]
  );

  return rows[0];
};

const findByBoardAndUser = async ({ boardId, userId }, queryable = db.pool) => {
  const { rows } = await queryable.query(
    `SELECT
       board_id AS "boardId",
       user_id AS "userId",
       role,
       joined_at AS "joinedAt"
     FROM board_members
     WHERE board_id = $1
       AND user_id = $2`,
    [boardId, userId]
  );

  return rows[0] || null;
};

const listByBoard = async (boardId, queryable = db.pool) => {
  const { rows } = await queryable.query(
    `SELECT
       bm.user_id AS "userId",
       u.name,
       u.email,
       bm.role,
       bm.joined_at AS "joinedAt"
     FROM board_members bm
     INNER JOIN users u ON u.id = bm.user_id
     WHERE bm.board_id = $1
     ORDER BY
       CASE WHEN bm.role = 'OWNER' THEN 0 ELSE 1 END,
       bm.joined_at ASC,
       bm.user_id ASC`,
    [boardId]
  );

  return rows;
};

const remove = async ({ boardId, userId }, queryable = db.pool) => {
  const { rows } = await queryable.query(
    `DELETE FROM board_members
     WHERE board_id = $1
       AND user_id = $2
     RETURNING
       board_id AS "boardId",
       user_id AS "userId",
       role`,
    [boardId, userId]
  );

  return rows[0] || null;
};

module.exports = {
  add,
  findByBoardAndUser,
  listByBoard,
  remove,
};
