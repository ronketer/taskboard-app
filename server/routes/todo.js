const express = require('express');
const router = express.Router();
const {
    createTodo,
    updateTodo,
    deleteTodo,
    getTodo,
    getAllTodo
} = require('../controllers/todo'); 


router.route('/').post(createTodo).get(getAllTodo);
router.route('/:id').put(updateTodo).delete(deleteTodo).get(getTodo);

module.exports = router;