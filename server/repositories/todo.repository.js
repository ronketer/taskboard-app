const db = require('../db/pool');

const PERSONAL_BOARD_ID_SQL = `
  SELECT id
  FROM boards
  WHERE created_by = $1
    AND is_personal = TRUE
`;

const create = async ({ userId, title, description }) => {
  const { rows } = await db.pool.query(
    `INSERT INTO todos (title, description, created_by, board_id)
     VALUES (
       $1,
       $2,
       $3,
       (
         SELECT id
         FROM boards
         WHERE created_by = $3
           AND is_personal = TRUE
       )
     )
     RETURNING id, title, description, completed`,
    [title, description, userId]
  );

  return rows[0];
};

const updateByIdAndUserId = async ({ todoId, userId, patch }) => {
  const setClauses = [];
  const values = [];
  let parameterIndex = 1;

  if (Object.prototype.hasOwnProperty.call(patch, 'title')) {
    setClauses.push(`title = $${parameterIndex++}`);
    values.push(patch.title);
  }

  if (Object.prototype.hasOwnProperty.call(patch, 'description')) {
    setClauses.push(`description = $${parameterIndex++}`);
    values.push(patch.description);
  }

  if (Object.prototype.hasOwnProperty.call(patch, 'completed')) {
    setClauses.push(`completed = $${parameterIndex++}`);
    values.push(patch.completed);
  }

  setClauses.push('updated_at = NOW()');
  values.push(todoId, userId);

  const { rows } = await db.pool.query(
    `UPDATE todos
     SET ${setClauses.join(', ')}
     WHERE id = $${parameterIndex}
       AND board_id = (
         SELECT id
         FROM boards
         WHERE created_by = $${parameterIndex + 1}
           AND is_personal = TRUE
       )
     RETURNING id, title, description, completed`,
    values
  );

  return rows[0] || null;
};

const deleteByIdAndUserId = async (todoId, userId) => {
  const { rows } = await db.pool.query(
    `DELETE FROM todos
     WHERE id = $1
       AND board_id = (
         SELECT id
         FROM boards
         WHERE created_by = $2
           AND is_personal = TRUE
       )
     RETURNING id`,
    [todoId, userId]
  );

  return rows[0] || null;
};

const countByUserId = async (userId) => {
  const { rows } = await db.pool.query(
    `SELECT COUNT(*)
     FROM todos
     WHERE board_id = (${PERSONAL_BOARD_ID_SQL})`,
    [userId]
  );

  return parseInt(rows[0].count, 10);
};

const findAllByUserId = async (userId, { limit, offset }) => {
  const { rows } = await db.pool.query(
    `SELECT id, title, description, completed
     FROM todos
     WHERE board_id = (${PERSONAL_BOARD_ID_SQL})
     ORDER BY created_at DESC, id DESC
     LIMIT $2 OFFSET $3`,
    [userId, limit, offset]
  );

  return rows.map((todo) => ({
    id: todo.id,
    title: todo.title,
    description: todo.description,
    completed: todo.completed,
  }));
};

const findByIdAndUserId = async (todoId, userId) => {
  const { rows } = await db.pool.query(
    `SELECT id, title, description, completed, created_at, updated_at
     FROM todos
     WHERE id = $1
       AND board_id = (
         SELECT id
         FROM boards
         WHERE created_by = $2
           AND is_personal = TRUE
       )`,
    [todoId, userId]
  );

  return rows[0] || null;
};

const createForBoard = async ({ boardId, userId, title, description }) => {
  const { rows } = await db.pool.query(
    `INSERT INTO todos (title, description, created_by, board_id)
     VALUES ($1, $2, $3, $4)
     RETURNING id, title, description, completed`,
    [title, description, userId, boardId]
  );

  return rows[0];
};

const updateByIdAndBoardId = async ({ todoId, boardId, patch }) => {
  const setClauses = [];
  const values = [];
  let parameterIndex = 1;

  if (Object.prototype.hasOwnProperty.call(patch, 'title')) {
    setClauses.push(`title = $${parameterIndex++}`);
    values.push(patch.title);
  }

  if (Object.prototype.hasOwnProperty.call(patch, 'description')) {
    setClauses.push(`description = $${parameterIndex++}`);
    values.push(patch.description);
  }

  if (Object.prototype.hasOwnProperty.call(patch, 'completed')) {
    setClauses.push(`completed = $${parameterIndex++}`);
    values.push(patch.completed);
  }

  setClauses.push('updated_at = NOW()');
  values.push(todoId, boardId);

  const { rows } = await db.pool.query(
    `UPDATE todos
     SET ${setClauses.join(', ')}
     WHERE id = $${parameterIndex}
       AND board_id = $${parameterIndex + 1}
     RETURNING id, title, description, completed`,
    values
  );

  return rows[0] || null;
};

const deleteByIdAndBoardId = async (todoId, boardId) => {
  const { rows } = await db.pool.query(
    `DELETE FROM todos
     WHERE id = $1
       AND board_id = $2
     RETURNING id`,
    [todoId, boardId]
  );

  return rows[0] || null;
};

const countByBoardId = async (boardId) => {
  const { rows } = await db.pool.query(
    'SELECT COUNT(*) FROM todos WHERE board_id = $1',
    [boardId]
  );

  return parseInt(rows[0].count, 10);
};

const findAllByBoardId = async (boardId, { limit, offset }) => {
  const { rows } = await db.pool.query(
    `SELECT id, title, description, completed
     FROM todos
     WHERE board_id = $1
     ORDER BY created_at DESC, id DESC
     LIMIT $2 OFFSET $3`,
    [boardId, limit, offset]
  );

  return rows.map((todo) => ({
    id: todo.id,
    title: todo.title,
    description: todo.description,
    completed: todo.completed,
  }));
};

const findByIdAndBoardId = async (todoId, boardId) => {
  const { rows } = await db.pool.query(
    `SELECT id, title, description, completed, created_at, updated_at
     FROM todos
     WHERE id = $1
       AND board_id = $2`,
    [todoId, boardId]
  );

  return rows[0] || null;
};

module.exports = {
  create,
  updateByIdAndUserId,
  deleteByIdAndUserId,
  countByUserId,
  findAllByUserId,
  findByIdAndUserId,
  createForBoard,
  updateByIdAndBoardId,
  deleteByIdAndBoardId,
  countByBoardId,
  findAllByBoardId,
  findByIdAndBoardId,
};
