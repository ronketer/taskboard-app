const db = require('../db/pool');

const create = async ({ userId, title, description }) => {
  const { rows } = await db.pool.query(
    `INSERT INTO todos (title, description, created_by)
     VALUES ($1, $2, $3)
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
     WHERE id = $${parameterIndex} AND created_by = $${parameterIndex + 1}
     RETURNING id, title, description, completed`,
    values
  );

  return rows[0] || null;
};

const deleteByIdAndUserId = async (todoId, userId) => {
  const { rows } = await db.pool.query(
    'DELETE FROM todos WHERE id = $1 AND created_by = $2 RETURNING id',
    [todoId, userId]
  );

  return rows[0] || null;
};

const countByUserId = async (userId) => {
  const { rows } = await db.pool.query(
    'SELECT COUNT(*) FROM todos WHERE created_by = $1',
    [userId]
  );

  return parseInt(rows[0].count, 10);
};

const findAllByUserId = async (userId, { limit, offset }) => {
  const { rows } = await db.pool.query(
    `SELECT id, title, description, completed
     FROM todos
     WHERE created_by = $1
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
     WHERE id = $1 AND created_by = $2`,
    [todoId, userId]
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
};
