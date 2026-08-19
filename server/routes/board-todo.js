const express = require('express');
const router = express.Router({ mergeParams: true });
const {
  createBoardTodo,
  updateBoardTodo,
  deleteBoardTodo,
  getBoardTodo,
  getAllBoardTodos,
} = require('../controllers/todo');

router.route('/').post(createBoardTodo).get(getAllBoardTodos);
router.route('/:id').put(updateBoardTodo).delete(deleteBoardTodo).get(getBoardTodo);

module.exports = router;
