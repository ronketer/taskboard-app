const { StatusCodes } = require('http-status-codes');
const boardService = require('../services/board.service');

const listBoards = async (req, res) => {
  const boards = await boardService.listBoards({ userId: req.user.userId });
  res.status(StatusCodes.OK).json({ boards });
};

const createBoard = async (req, res) => {
  const board = await boardService.createBoard({
    userId: req.user.userId,
    name: req.body.name,
  });

  res.status(StatusCodes.CREATED).json(board);
};

const listMembers = async (req, res) => {
  const members = await boardService.listMembers({
    userId: req.user.userId,
    boardId: req.params.boardId,
  });

  res.status(StatusCodes.OK).json({ members });
};

const addMember = async (req, res) => {
  const membership = await boardService.addMember({
    userId: req.user.userId,
    boardId: req.params.boardId,
    email: req.body.email,
  });

  res.status(StatusCodes.CREATED).json(membership);
};

const removeMember = async (req, res) => {
  await boardService.removeMember({
    userId: req.user.userId,
    boardId: req.params.boardId,
    memberUserId: req.params.userId,
  });

  res.status(StatusCodes.NO_CONTENT).send();
};

module.exports = {
  listBoards,
  createBoard,
  listMembers,
  addMember,
  removeMember,
};
