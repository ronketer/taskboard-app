const boardRepository = require('../repositories/board.repository');
const membershipRepository = require('../repositories/membership.repository');
const userRepository = require('../repositories/user.repository');
const { withTransaction } = require('../db/transaction');
const {
  BadRequestError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
} = require('../errors');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const parsePositiveId = (value, label) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new BadRequestError(`Invalid ${label}`);
  }
  return parsed;
};

const normalizeBoardName = (name) => {
  if (typeof name !== 'string') {
    throw new BadRequestError('Board name is required');
  }

  const normalized = name.trim();
  if (normalized.length < 1 || normalized.length > 80) {
    throw new BadRequestError('Board name must be between 1 and 80 characters');
  }

  return normalized;
};

const normalizeEmail = (email) => {
  if (typeof email !== 'string') {
    throw new BadRequestError('Valid member email is required');
  }

  const normalized = email.trim().toLowerCase();
  if (!EMAIL_REGEX.test(normalized)) {
    throw new BadRequestError('Valid member email is required');
  }

  return normalized;
};

const requireMembership = async ({ boardId, userId }) => {
  const membership = await membershipRepository.findByBoardAndUser({ boardId, userId });

  // Hide board existence from authenticated non-members.
  if (!membership) {
    throw new NotFoundError('Board not found');
  }

  return membership;
};

const requireOwner = async ({ boardId, userId }) => {
  const membership = await requireMembership({ boardId, userId });

  if (membership.role !== 'OWNER') {
    throw new ForbiddenError('Board owner access required');
  }

  return membership;
};

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

const createBoard = async ({ userId, name }) => {
  const normalizedName = normalizeBoardName(name);

  return withTransaction(async (client) => {
    const board = await boardRepository.create(
      {
        name: normalizedName,
        createdBy: userId,
        isPersonal: false,
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

    return { ...board, role: 'OWNER' };
  });
};

const listBoards = async ({ userId }) => boardRepository.listForUser(userId);

const listMembers = async ({ userId, boardId }) => {
  const parsedBoardId = parsePositiveId(boardId, 'board ID');
  await requireMembership({ boardId: parsedBoardId, userId });
  return membershipRepository.listByBoard(parsedBoardId);
};

const addMember = async ({ userId, boardId, email }) => {
  const parsedBoardId = parsePositiveId(boardId, 'board ID');
  await requireOwner({ boardId: parsedBoardId, userId });

  const normalizedEmail = normalizeEmail(email);
  const targetUser = await userRepository.findIdByNormalizedEmail(normalizedEmail);

  if (!targetUser) {
    throw new NotFoundError('User not found');
  }

  const existingMembership = await membershipRepository.findByBoardAndUser({
    boardId: parsedBoardId,
    userId: targetUser.id,
  });

  if (existingMembership) {
    throw new ConflictError('User is already a board member');
  }

  try {
    return await membershipRepository.add({
      boardId: parsedBoardId,
      userId: targetUser.id,
      role: 'MEMBER',
    });
  } catch (err) {
    // The (board_id, user_id) primary key is the final concurrency guard.
    if (err.code === '23505') {
      throw new ConflictError('User is already a board member');
    }
    throw err;
  }
};

const removeMember = async ({ userId, boardId, memberUserId }) => {
  const parsedBoardId = parsePositiveId(boardId, 'board ID');
  const parsedMemberUserId = parsePositiveId(memberUserId, 'member user ID');

  await requireOwner({ boardId: parsedBoardId, userId });

  const targetMembership = await membershipRepository.findByBoardAndUser({
    boardId: parsedBoardId,
    userId: parsedMemberUserId,
  });

  if (!targetMembership) {
    throw new NotFoundError('Board member not found');
  }

  if (targetMembership.role === 'OWNER') {
    throw new BadRequestError('Board owner cannot be removed');
  }

  const removed = await membershipRepository.remove({
    boardId: parsedBoardId,
    userId: parsedMemberUserId,
  });

  if (!removed) {
    throw new NotFoundError('Board member not found');
  }

  return removed;
};

module.exports = {
  createPersonalBoardForUser,
  createBoard,
  listBoards,
  listMembers,
  addMember,
  removeMember,
};
