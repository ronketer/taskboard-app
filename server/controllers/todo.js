const { StatusCodes } = require('http-status-codes');
const todoService = require('../services/todo.service');

const createTodo = async (req, res) => {
  const todo = await todoService.createTodo({
    userId: req.user.userId,
    title: req.body.title,
    description: req.body.description,
  });

  res.status(StatusCodes.CREATED).json(todo);
};

const updateTodo = async (req, res) => {
  const todo = await todoService.updateTodo({
    userId: req.user.userId,
    todoId: req.params.id,
    title: req.body.title,
    description: req.body.description,
    completed: req.body.completed,
  });

  res.status(StatusCodes.OK).json(todo);
};

const deleteTodo = async (req, res) => {
  await todoService.deleteTodo({
    userId: req.user.userId,
    todoId: req.params.id,
  });

  res.status(StatusCodes.NO_CONTENT).json({ msg: 'Todo deleted successfully' });
};

const getAllTodo = async (req, res) => {
  const result = await todoService.getAllTodos({
    userId: req.user.userId,
    page: req.query.p,
  });

  res.status(StatusCodes.OK).json(result);
};

const getTodo = async (req, res) => {
  const todo = await todoService.getTodo({
    userId: req.user.userId,
    todoId: req.params.id,
  });

  res.status(StatusCodes.OK).json({ todo });
};

module.exports = {
  createTodo,
  updateTodo,
  deleteTodo,
  getAllTodo,
  getTodo,
};
