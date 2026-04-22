const { StatusCodes } = require('http-status-codes');
const Todo = require('../models/Todo');
const { NotFoundError, BadRequestError, ForbiddenError } = require('../errors/index');

// Validate todo title against schema constraints (minlength: 3, maxlength: 50)
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
  
  const validTitle = validateTodoInput(title);
  
  if (!validTitle) {
     throw new BadRequestError('Title is required');
  }

  req.body.createdBy = req.user.userId;
  req.body.title = validTitle;
  
  const todo = await Todo.create({ ...req.body });

  res.status(StatusCodes.CREATED).json({
    id: todo.id,
    title: todo.title,
    description: todo.description,
  });
};

const updateTodo = async (req, res) => {
  const { title, description } = req.body;
  const userId = req.user.userId;
  const todoId = req.params.id;

  if (!title && !description) {
    throw new BadRequestError('At least one of Title or Description must be provided for update');
  }

  let updateData = { description };
  
  if (title) {
    updateData.title = validateTodoInput(title);
  }

  const todo = await Todo.findOneAndUpdate(
    { id: todoId, createdBy: userId },
    updateData,
    { new: true, runValidators: true }
  );

  if (!todo) {
    throw new NotFoundError(`No Todo with id ${todoId}`);
  }

  if(!todo.createdBy.equals(userId)) {
    throw new ForbiddenError('Forbidden');
  }

  res.status(StatusCodes.OK).json({
    id : todo.id,
    title: todo.title,
    description: todo.description,
  });
};

const deleteTodo = async (req, res) => {
  const todoId = req.params.id;
  const userId = req.user.userId;
  const todo = await Todo.findOneAndDelete(
    { id: todoId, createdBy: userId }
  );
  if(!todo) {
    throw new NotFoundError(`no Todo with id ${todoId}`);
  }

  res.status(StatusCodes.NO_CONTENT).json({msg: 'Todo deleted successfully'});
};

const getAllTodo = async (req, res) => {
  const userId = req.user.userId;
  
  let page = parseInt(req.query.p) || 1; // let because we need to validate value 
  
  const limit = 10; 

  if (page < 1) {
    page = 1;

  }

  const totalTodos = await Todo.countDocuments({ createdBy: userId });
  const pageCount = Math.ceil(totalTodos / limit) || 1;

  if (page > pageCount) {
    page = pageCount;

  }

  const skip = (page - 1) * limit;

  const todos = await Todo.find({ createdBy: userId })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  res.status(StatusCodes.OK).json({
    data: todos.map((todo) => ({
      id: todo.id,
      title: todo.title,
      description: todo.description,
    })),
    page,
    pageCount,
    totalTodos,
  });
};

const getTodo = async (req, res) => {
  const todoId = req.params.id;
  const userId = req.user.userId;

  const todo = await Todo.findOne({ id: todoId, createdBy: userId });

  if (!todo) {
    throw new NotFoundError(`No Todo with id ${todoId}`);
  }
  res.status(StatusCodes.OK).json({ todo });
};

module.exports = {
  createTodo,
  updateTodo,
  deleteTodo,
  getAllTodo,
  getTodo,
};


