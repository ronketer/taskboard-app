const { StatusCodes } = require('http-status-codes');
const db = require('../db/pool');
const { NotFoundError, BadRequestError } = require('../errors/index');

const validateTodoInput = (title) => {
  if (title === undefined) return;

  if (typeof title !== 'string') {
    throw new BadRequestError('Title must be a string');
  }

  const trimmedTitle = title.trim();

  if (trimmedTitle.length === 0) {
    throw new BadRequestError('Title cannot be only whitespace');
  }

  if (trimmedTitle.length < 3) {
    throw new BadRequestError('Title must be at least 3 characters long');
  }

  if (trimmedTitle.length > 50) {
    throw new BadRequestError('Title cannot exceed 50 characters');
  }

  return trimmedTitle;
};

const createTodo = async (req, res) => {
  const { title, description } = req.body;
  const userId = req.user.userId;

  const validTitle = validateTodoInput(title);

  if (!validTitle) {
    throw new BadRequestError('Title is required');
  }

  const { rows } = await db.pool.query(
    `INSERT INTO todos (title, description, created_by)
     VALUES ($1, $2, $3)
     RETURNING id, title, description, completed`,
    [validTitle, description || null, userId]
  );

  const todo = rows[0];
  res.status(StatusCodes.CREATED).json({
    id: todo.id,
    title: todo.title,
    description: todo.description,
    completed: todo.completed,
  });
};

const updateTodo = async (req, res) => {
  const { title, description, completed } = req.body;
  const userId = req.user.userId;
  const todoId = parseInt(req.params.id, 10);

  if (isNaN(todoId)) {
    throw new NotFoundError(`No Todo with id ${req.params.id}`);
  }

  if (!title && !description && completed === undefined) {
    throw new BadRequestError('At least one of Title, Description, or Completed must be provided for update');
  }

  const setClauses = [];
  const values = [];
  let idx = 1;

  if (title) {
    setClauses.push(`title = $${idx++}`);
    values.push(validateTodoInput(title));
  }

  if (description) {
    setClauses.push(`description = $${idx++}`);
    values.push(description);
  }

  if (completed !== undefined) {
    setClauses.push(`completed = $${idx++}`);
    values.push(completed);
  }

  setClauses.push(`updated_at = NOW()`);
  values.push(todoId, userId);

  const { rows } = await db.pool.query(
    `UPDATE todos
     SET ${setClauses.join(', ')}
     WHERE id = $${idx} AND created_by = $${idx + 1}
     RETURNING id, title, description, completed`,
    values
  );

  if (rows.length === 0) {
    throw new NotFoundError(`No Todo with id ${todoId}`);
  }

  const todo = rows[0];
  res.status(StatusCodes.OK).json({
    id: todo.id,
    title: todo.title,
    description: todo.description,
    completed: todo.completed,
  });
};

const deleteTodo = async (req, res) => {
  const userId = req.user.userId;
  const todoId = parseInt(req.params.id, 10);

  if (isNaN(todoId)) {
    throw new NotFoundError(`No Todo with id ${req.params.id}`);
  }

  const { rows } = await db.pool.query(
    `DELETE FROM todos WHERE id = $1 AND created_by = $2 RETURNING id`,
    [todoId, userId]
  );

  if (rows.length === 0) {
    throw new NotFoundError(`no Todo with id ${todoId}`);
  }

  res.status(StatusCodes.NO_CONTENT).json({ msg: 'Todo deleted successfully' });
};

const getAllTodo = async (req, res) => {
  const userId = req.user.userId;
  let page = parseInt(req.query.p) || 1;
  const limit = 10;

  if (page < 1) page = 1;

  const countResult = await db.pool.query(
    `SELECT COUNT(*) FROM todos WHERE created_by = $1`,
    [userId]
  );
  const totalTodos = parseInt(countResult.rows[0].count, 10);
  const pageCount = Math.ceil(totalTodos / limit) || 1;

  if (page > pageCount) page = pageCount;

  const skip = (page - 1) * limit;

  const { rows } = await db.pool.query(
    `SELECT id, title, description, completed
     FROM todos
     WHERE created_by = $1
     ORDER BY created_at DESC
     LIMIT $2 OFFSET $3`,
    [userId, limit, skip]
  );

  res.status(StatusCodes.OK).json({
    data: rows.map((todo) => ({
      id: todo.id,
      title: todo.title,
      description: todo.description,
      completed: todo.completed,
    })),
    page,
    pageCount,
    totalTodos,
  });
};

const getTodo = async (req, res) => {
  const userId = req.user.userId;
  const todoId = parseInt(req.params.id, 10);

  if (isNaN(todoId)) {
    throw new NotFoundError(`No Todo with id ${req.params.id}`);
  }

  const { rows } = await db.pool.query(
    `SELECT id, title, description, completed, created_at, updated_at
     FROM todos
     WHERE id = $1 AND created_by = $2`,
    [todoId, userId]
  );

  if (rows.length === 0) {
    throw new NotFoundError(`No Todo with id ${todoId}`);
  }

  res.status(StatusCodes.OK).json({ todo: rows[0] });
};

module.exports = {
  createTodo,
  updateTodo,
  deleteTodo,
  getAllTodo,
  getTodo,
};
