const express = require('express');
const router = express.Router();
const {
  listBoards,
  createBoard,
  listMembers,
  addMember,
  removeMember,
} = require('../controllers/board');

router.route('/').get(listBoards).post(createBoard);
router.route('/:boardId/members').get(listMembers).post(addMember);
router.route('/:boardId/members/:userId').delete(removeMember);

module.exports = router;
