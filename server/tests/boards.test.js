const request = require('supertest');
const app = require('../app');
const db = require('../db/pool');
const boardService = require('../services/board.service');
const membershipRepository = require('../repositories/membership.repository');

const registerUser = async ({ name, email, password = 'Password123!' }) => {
  const response = await request(app)
    .post('/api/v1/auth/register')
    .send({ name, email, password });

  expect(response.status).toBe(201);

  const { rows } = await db.pool.query(
    `SELECT id FROM users WHERE LOWER(BTRIM(email)) = $1`,
    [email.trim().toLowerCase()]
  );

  return {
    token: response.body.token,
    userId: rows[0].id,
    email: email.trim().toLowerCase(),
  };
};

const auth = (token) => ({ Authorization: `Bearer ${token}` });

describe('Board and Membership API', () => {
  describe('authentication and personal board visibility', () => {
    it('requires authentication for board routes', async () => {
      const listResponse = await request(app).get('/api/v1/boards');
      const createResponse = await request(app)
        .post('/api/v1/boards')
        .send({ name: 'Project' });

      expect(listResponse.status).toBe(401);
      expect(createResponse.status).toBe(401);
    });

    it('lists the Personal board created during registration', async () => {
      const owner = await registerUser({
        name: 'Owner',
        email: 'owner@example.com',
      });

      const response = await request(app)
        .get('/api/v1/boards')
        .set(auth(owner.token));

      expect(response.status).toBe(200);
      expect(response.body.boards).toHaveLength(1);
      expect(response.body.boards[0]).toMatchObject({
        name: 'Personal',
        isPersonal: true,
        role: 'OWNER',
      });
    });
  });

  describe('board creation', () => {
    it('creates a shared board and OWNER membership atomically', async () => {
      const owner = await registerUser({
        name: 'Owner',
        email: 'create-owner@example.com',
      });

      const response = await request(app)
        .post('/api/v1/boards')
        .set(auth(owner.token))
        .send({ name: '  Interview Project  ' });

      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({
        name: 'Interview Project',
        isPersonal: false,
        role: 'OWNER',
      });

      const { rows: memberships } = await db.pool.query(
        `SELECT role
         FROM board_members
         WHERE board_id = $1 AND user_id = $2`,
        [response.body.id, owner.userId]
      );

      expect(memberships).toEqual([{ role: 'OWNER' }]);
    });

    it('rolls back board creation if OWNER membership creation fails', async () => {
      const owner = await registerUser({
        name: 'Owner',
        email: 'rollback-owner@example.com',
      });

      const spy = jest
        .spyOn(membershipRepository, 'add')
        .mockRejectedValueOnce(new Error('forced membership failure'));

      await expect(
        boardService.createBoard({
          userId: owner.userId,
          name: 'Must Roll Back',
        })
      ).rejects.toThrow('forced membership failure');

      spy.mockRestore();

      const { rows } = await db.pool.query(
        `SELECT id FROM boards WHERE name = $1 AND created_by = $2`,
        ['Must Roll Back', owner.userId]
      );

      expect(rows).toHaveLength(0);
    });

    it('rejects blank or oversized board names', async () => {
      const owner = await registerUser({
        name: 'Owner',
        email: 'validation-owner@example.com',
      });

      const blank = await request(app)
        .post('/api/v1/boards')
        .set(auth(owner.token))
        .send({ name: '   ' });

      const oversized = await request(app)
        .post('/api/v1/boards')
        .set(auth(owner.token))
        .send({ name: 'x'.repeat(81) });

      expect(blank.status).toBe(400);
      expect(oversized.status).toBe(400);
    });
  });

  describe('membership authorization', () => {
    it('allows OWNER to add a registered user by email and both members to list membership', async () => {
      const owner = await registerUser({
        name: 'Owner',
        email: 'membership-owner@example.com',
      });
      const member = await registerUser({
        name: 'Member',
        email: 'membership-member@example.com',
      });

      const boardResponse = await request(app)
        .post('/api/v1/boards')
        .set(auth(owner.token))
        .send({ name: 'Shared Board' });

      const boardId = boardResponse.body.id;

      const addResponse = await request(app)
        .post(`/api/v1/boards/${boardId}/members`)
        .set(auth(owner.token))
        .send({ email: '  MEMBERSHIP-MEMBER@EXAMPLE.COM ' });

      expect(addResponse.status).toBe(201);
      expect(addResponse.body).toMatchObject({
        boardId,
        userId: member.userId,
        role: 'MEMBER',
      });

      const ownerList = await request(app)
        .get(`/api/v1/boards/${boardId}/members`)
        .set(auth(owner.token));

      const memberList = await request(app)
        .get(`/api/v1/boards/${boardId}/members`)
        .set(auth(member.token));

      expect(ownerList.status).toBe(200);
      expect(memberList.status).toBe(200);
      expect(ownerList.body.members).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ userId: owner.userId, role: 'OWNER' }),
          expect.objectContaining({ userId: member.userId, role: 'MEMBER' }),
        ])
      );
    });

    it('returns 409 when adding an existing member again', async () => {
      const owner = await registerUser({
        name: 'Owner',
        email: 'duplicate-owner@example.com',
      });
      const member = await registerUser({
        name: 'Member',
        email: 'duplicate-member@example.com',
      });

      const board = await request(app)
        .post('/api/v1/boards')
        .set(auth(owner.token))
        .send({ name: 'Duplicate Test' });

      await request(app)
        .post(`/api/v1/boards/${board.body.id}/members`)
        .set(auth(owner.token))
        .send({ email: member.email })
        .expect(201);

      const duplicate = await request(app)
        .post(`/api/v1/boards/${board.body.id}/members`)
        .set(auth(owner.token))
        .send({ email: member.email });

      expect(duplicate.status).toBe(409);
      expect(duplicate.body.msg).toMatch(/already.*member/i);
    });

    it('forbids MEMBER from managing membership', async () => {
      const owner = await registerUser({
        name: 'Owner',
        email: 'permissions-owner@example.com',
      });
      const member = await registerUser({
        name: 'Member',
        email: 'permissions-member@example.com',
      });
      const candidate = await registerUser({
        name: 'Candidate',
        email: 'permissions-candidate@example.com',
      });

      const board = await request(app)
        .post('/api/v1/boards')
        .set(auth(owner.token))
        .send({ name: 'Permissions' });

      await request(app)
        .post(`/api/v1/boards/${board.body.id}/members`)
        .set(auth(owner.token))
        .send({ email: member.email })
        .expect(201);

      const addAttempt = await request(app)
        .post(`/api/v1/boards/${board.body.id}/members`)
        .set(auth(member.token))
        .send({ email: candidate.email });

      const removeAttempt = await request(app)
        .delete(`/api/v1/boards/${board.body.id}/members/${owner.userId}`)
        .set(auth(member.token));

      expect(addAttempt.status).toBe(403);
      expect(removeAttempt.status).toBe(403);
    });

    it('hides board existence from authenticated non-members', async () => {
      const owner = await registerUser({
        name: 'Owner',
        email: 'hidden-owner@example.com',
      });
      const outsider = await registerUser({
        name: 'Outsider',
        email: 'hidden-outsider@example.com',
      });

      const board = await request(app)
        .post('/api/v1/boards')
        .set(auth(owner.token))
        .send({ name: 'Private Board' });

      const listAttempt = await request(app)
        .get(`/api/v1/boards/${board.body.id}/members`)
        .set(auth(outsider.token));

      const addAttempt = await request(app)
        .post(`/api/v1/boards/${board.body.id}/members`)
        .set(auth(outsider.token))
        .send({ email: outsider.email });

      expect(listAttempt.status).toBe(404);
      expect(addAttempt.status).toBe(404);
    });

    it('allows OWNER to remove a MEMBER and removed user loses board access', async () => {
      const owner = await registerUser({
        name: 'Owner',
        email: 'remove-owner@example.com',
      });
      const member = await registerUser({
        name: 'Member',
        email: 'remove-member@example.com',
      });

      const board = await request(app)
        .post('/api/v1/boards')
        .set(auth(owner.token))
        .send({ name: 'Removal' });

      await request(app)
        .post(`/api/v1/boards/${board.body.id}/members`)
        .set(auth(owner.token))
        .send({ email: member.email })
        .expect(201);

      const removal = await request(app)
        .delete(`/api/v1/boards/${board.body.id}/members/${member.userId}`)
        .set(auth(owner.token));

      expect(removal.status).toBe(204);

      const removedUserAccess = await request(app)
        .get(`/api/v1/boards/${board.body.id}/members`)
        .set(auth(member.token));

      expect(removedUserAccess.status).toBe(404);
    });

    it('prevents removal of the board OWNER', async () => {
      const owner = await registerUser({
        name: 'Owner',
        email: 'owner-protection@example.com',
      });

      const board = await request(app)
        .post('/api/v1/boards')
        .set(auth(owner.token))
        .send({ name: 'Owner Protected' });

      const response = await request(app)
        .delete(`/api/v1/boards/${board.body.id}/members/${owner.userId}`)
        .set(auth(owner.token));

      expect(response.status).toBe(400);
      expect(response.body.msg).toMatch(/owner.*cannot.*removed/i);
    });
  });
});
