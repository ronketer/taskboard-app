const { NotFoundError, BadRequestError } = require('../errors');
const todoRepository = require('../repositories/todo.repository');
const boardService = require('./board.service');

const PAGE_SIZE = 10;

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

const parseTodoId = (todoId) => {
  const parsedId = parseInt(todoId, 10);

  if (isNaN(parsedId)) {
    throw new NotFoundError(`No Todo with id ${todoId}`);
  }

  return parsedId;
};

const createTodo = async ({ userId, title, description }) => {
  const validTitle = validateTodoInput(title);

  if (!validTitle) {
    throw new BadRequestError('Title is required');
  }

  return todoRepository.create({
    userId,
    title: validTitle,
    description: description || null,
  });
};

const updateTodo = async ({ userId, todoId, title, description, completed }) => {
  const parsedTodoId = parseTodoId(todoId);

  if (!title && !description && completed === undefined) {
    throw new BadRequestError(
      'At least one of Title, Description, or Completed must be provided for update'
    );
  }

  const patch = {};

  if (title) {
    patch.title = validateTodoInput(title);
  }

  if (description) {
    patch.description = description;
  }

  if (completed !== undefined) {
    patch.completed = completed;
  }

  const todo = await todoRepository.updateByIdAndUserId({
    todoId: parsedTodoId,
    userId,
    patch,
  });

  if (!todo) {
    throw new NotFoundError(`No Todo with id ${parsedTodoId}`);
  }

  return todo;
};

const deleteTodo = async ({ userId, todoId }) => {
  const parsedTodoId = parseTodoId(todoId);
  const deleted = await todoRepository.deleteByIdAndUserId(parsedTodoId, userId);

  if (!deleted) {
    throw new NotFoundError(`no Todo with id ${parsedTodoId}`);
  }
};

const getAllTodos = async ({ userId, page }) => {
  let currentPage = parseInt(page) || 1;

  if (currentPage < 1) currentPage = 1;

  const totalTodos = await todoRepository.countByUserId(userId);
  const pageCount = Math.ceil(totalTodos / PAGE_SIZE) || 1;

  if (currentPage > pageCount) currentPage = pageCount;

  const offset = (currentPage - 1) * PAGE_SIZE;
  const data = await todoRepository.findAllByUserId(userId, {
    limit: PAGE_SIZE,
    offset,
  });

  return {
    data,
    page: currentPage,
    pageCount,
    totalTodos,
  };
};

const getTodo = async ({ userId, todoId }) => {
  const parsedTodoId = parseTodoId(todoId);
  const todo = await todoRepository.findByIdAndUserId(parsedTodoId, userId);

  if (!todo) {
    throw new NotFoundError(`No Todo with id ${parsedTodoId}`);
  }

  return todo;
};

const createBoardTodo = async ({ userId, boardId, title, description }) => {
  const { boardId: parsedBoardId } = await boardService.authorizeBoardMember({
    userId,
    boardId,
  });

  const validTitle = validateTodoInput(title);
  if (!validTitle) {
    throw new BadRequestError('Title is required');
  }

  return todoRepository.createForBoard({
    boardId: parsedBoardId,
    userId,
    title: validTitle,
    description: description || null,
  });
};

const updateBoardTodo = async ({
  userId,
  boardId,
  todoId,
  title,
  description,
  completed,
}) => {
  const { boardId: parsedBoardId } = await boardService.authorizeBoardMember({
    userId,
    boardId,
  });
  const parsedTodoId = parseTodoId(todoId);

  if (!title && !description && completed === undefined) {
    throw new BadRequestError(
      'At least one of Title, Description, or Completed must be provided for update'
    );
  }

  const patch = {};

  if (title) {
    patch.title = validateTodoInput(title);
  }

  if (description) {
    patch.description = description;
  }

  if (completed !== undefined) {
    patch.completed = completed;
  }

  const todo = await todoRepository.updateByIdAndBoardId({
    todoId: parsedTodoId,
    boardId: parsedBoardId,
    patch,
  });

  if (!todo) {
    throw new NotFoundError(`No Todo with id ${parsedTodoId}`);
  }

  return todo;
};

const deleteBoardTodo = async ({ userId, boardId, todoId }) => {
  const { boardId: parsedBoardId } = await boardService.authorizeBoardMember({
    userId,
    boardId,
  });
  const parsedTodoId = parseTodoId(todoId);

  const deleted = await todoRepository.deleteByIdAndBoardId(parsedTodoId, parsedBoardId);

  if (!deleted) {
    throw new NotFoundError(`no Todo with id ${parsedTodoId}`);
  }
};

const getAllBoardTodos = async ({ userId, boardId, page }) => {
  const { boardId: parsedBoardId } = await boardService.authorizeBoardMember({
    userId,
    boardId,
  });

  let currentPage = parseInt(page) || 1;
  if (currentPage < 1) currentPage = 1;

  const totalTodos = await todoRepository.countByBoardId(parsedBoardId);
  const pageCount = Math.ceil(totalTodos / PAGE_SIZE) || 1;

  if (currentPage > pageCount) currentPage = pageCount;

  const offset = (currentPage - 1) * PAGE_SIZE;
  const data = await todoRepository.findAllByBoardId(parsedBoardId, {
    limit: PAGE_SIZE,
    offset,
  });

  return {
    data,
    page: currentPage,
    pageCount,
    totalTodos,
  };
};

const getBoardTodo = async ({ userId, boardId, todoId }) => {
  const { boardId: parsedBoardId } = await boardService.authorizeBoardMember({
    userId,
    boardId,
  });
  const parsedTodoId = parseTodoId(todoId);

  const todo = await todoRepository.findByIdAndBoardId(parsedTodoId, parsedBoardId);

  if (!todo) {
    throw new NotFoundError(`No Todo with id ${parsedTodoId}`);
  }

  return todo;
};

module.exports = {
  createTodo,
  updateTodo,
  deleteTodo,
  getAllTodos,
  getTodo,
  createBoardTodo,
  updateBoardTodo,
  deleteBoardTodo,
  getAllBoardTodos,
  getBoardTodo,
};
