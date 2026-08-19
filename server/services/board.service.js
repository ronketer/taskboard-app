const boardRepository = require('../repositories/board.repository');
const membershipRepository = require('../repositories/membership.repository');

const createPersonalBoardForUser = async ({ userId, client }) => {
  const board = await boardRepository.create(
    {
      name: 'Personal',
      createdBy: userId,
      isPersonal: true,
    },
    client
  );

  await membershipRepository.add(
    {
      boardId: board.id,
      userId,
      role: 'OWNER',
    },
    client
  );

  return board;
};

module.exports = { createPersonalBoardForUser };
