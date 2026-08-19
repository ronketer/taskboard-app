const request = require('supertest');
const app = require('../app');
const db = require('../db/pool');

const auth = (token) => ({ Authorization: `Bearer ${token}` });

const registerUser = async ({ name, email }) => {
  const response = await request(app)
    .post('/api/v1/auth/register')
    .send({ name, email, password: 'Password123!' });

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

const createBoard = async ({ token, name = 'Shared Tasks' }) => {
  const response = await request(app)
    .post('/api/v1/boards')
    .set(auth(token))
    .send({ name });

  expect(response.status).toBe(201);
  return response.body;
};

const addMember = async ({ ownerToken, boardId, email }) => {
  const response = await request(app)
    .post(`/api/v1/boards/${boardId}/members`)
    .set(auth(ownerToken))
    .send({ email });

  expect(response.status).toBe(201);
};

describe('Board-scoped Todo API', () => {
  it('requires authentication for board-scoped todo routes', async () => {
    const response = await request(app).get('/api/v1/boards/1/todos');
    expect(response.status).toBe(401);
  });

  it('allows an OWNER to CRUD todos on a shared board', async () => {
    const owner = await registerUser({
      name: 'Owner',
      email: 'board-task-owner@example.com',
    });
    const board = await createBoard({ token: owner.token });

    const created = await request(app)
      .post(`/api/v1/boards/${board.id}/todos`)
      .set(auth(owner.token))
      .send({ title: 'Shared task', description: 'Owner created' });

    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({
      title: 'Shared task',
      description: 'Owner created',
      completed: false,
    });

    const listed = await request(app)
      .get(`/api/v1/boards/${board.id}/todos`)
      .set(auth(owner.token));

    expect(listed.status).toBe(200);
    expect(listed.body.totalTodos).toBe(1);
    expect(listed.body.data[0].id).toBe(created.body.id);

    const fetched = await request(app)
      .get(`/api/v1/boards/${board.id}/todos/${created.body.id}`)
      .set(auth(owner.token));

    expect(fetched.status).toBe(200);
    expect(fetched.body.todo.id).toBe(created.body.id);

    const updated = await request(app)
      .put(`/api/v1/boards/${board.id}/todos/${created.body.id}`)
      .set(auth(owner.token))
      .send({ completed: true });

    expect(updated.status).toBe(200);
    expect(updated.body.completed).toBe(true);

    const deleted = await request(app)
      .delete(`/api/v1/boards/${board.id}/todos/${created.body.id}`)
      .set(auth(owner.token));

    expect(deleted.status).toBe(204);

    const afterDelete = await request(app)
      .get(`/api/v1/boards/${board.id}/todos/${created.body.id}`)
      .set(auth(owner.token));

    expect(afterDelete.status).toBe(404);
  });

  it('allows a MEMBER to create, update, and delete board todos', async () => {
    const owner = await registerUser({
      name: 'Owner',
      email: 'member-task-owner@example.com',
    });
    const member = await registerUser({
      name: 'Member',
      email: 'member-task-member@example.com',
    });
    const board = await createBoard({ token: owner.token });

    await addMember({
      ownerToken: owner.token,
      boardId: board.id,
      email: member.email,
    });

    const created = await request(app)
      .post(`/api/v1/boards/${board.id}/todos`)
      .set(auth(member.token))
      .send({ title: 'Member task' });

    expect(created.status).toBe(201);

    const memberFetch = await request(app)
      .get(`/api/v1/boards/${board.id}/todos/${created.body.id}`)
      .set(auth(member.token));

    const ownerList = await request(app)
      .get(`/api/v1/boards/${board.id}/todos`)
      .set(auth(owner.token));

    expect(memberFetch.status).toBe(200);
    expect(memberFetch.body.todo.id).toBe(created.body.id);
    expect(ownerList.status).toBe(200);
    expect(ownerList.body.data).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: created.body.id })])
    );

    const updated = await request(app)
      .put(`/api/v1/boards/${board.id}/todos/${created.body.id}`)
      .set(auth(member.token))
      .send({ title: 'Member updated task' });

    expect(updated.status).toBe(200);
    expect(updated.body.title).toBe('Member updated task');

    const deleted = await request(app)
      .delete(`/api/v1/boards/${board.id}/todos/${created.body.id}`)
      .set(auth(member.token));

    expect(deleted.status).toBe(204);
  });

  it('hides board existence from non-members across board todo operations', async () => {
    const owner = await registerUser({
      name: 'Owner',
      email: 'hidden-task-owner@example.com',
    });
    const outsider = await registerUser({
      name: 'Outsider',
      email: 'hidden-task-outsider@example.com',
    });
    const board = await createBoard({ token: owner.token });

    const todo = await request(app)
      .post(`/api/v1/boards/${board.id}/todos`)
      .set(auth(owner.token))
      .send({ title: 'Private board task' });

    expect(todo.status).toBe(201);

    const attempts = await Promise.all([
      request(app)
        .get(`/api/v1/boards/${board.id}/todos`)
        .set(auth(outsider.token)),
      request(app)
        .post(`/api/v1/boards/${board.id}/todos`)
        .set(auth(outsider.token))
        .send({ title: 'Unauthorized create' }),
      request(app)
        .get(`/api/v1/boards/${board.id}/todos/${todo.body.id}`)
        .set(auth(outsider.token)),
      request(app)
        .put(`/api/v1/boards/${board.id}/todos/${todo.body.id}`)
        .set(auth(outsider.token))
        .send({ completed: true }),
      request(app)
        .delete(`/api/v1/boards/${board.id}/todos/${todo.body.id}`)
        .set(auth(outsider.token)),
    ]);

    for (const response of attempts) {
      expect(response.status).toBe(404);
      expect(response.body.msg).toMatch(/board not found/i);
    }
  });

  it('scopes todo IDs to the board even when the user belongs to both boards', async () => {
    const owner = await registerUser({
      name: 'Owner',
      email: 'cross-board-owner@example.com',
    });
    const boardA = await createBoard({ token: owner.token, name: 'Board A' });
    const boardB = await createBoard({ token: owner.token, name: 'Board B' });

    const todoA = await request(app)
      .post(`/api/v1/boards/${boardA.id}/todos`)
      .set(auth(owner.token))
      .send({ title: 'Only on board A' });

    expect(todoA.status).toBe(201);

    const fetchThroughB = await request(app)
      .get(`/api/v1/boards/${boardB.id}/todos/${todoA.body.id}`)
      .set(auth(owner.token));

    const updateThroughB = await request(app)
      .put(`/api/v1/boards/${boardB.id}/todos/${todoA.body.id}`)
      .set(auth(owner.token))
      .send({ title: 'Wrong board update' });

    const deleteThroughB = await request(app)
      .delete(`/api/v1/boards/${boardB.id}/todos/${todoA.body.id}`)
      .set(auth(owner.token));

    expect(fetchThroughB.status).toBe(404);
    expect(updateThroughB.status).toBe(404);
    expect(deleteThroughB.status).toBe(404);

    const intact = await request(app)
      .get(`/api/v1/boards/${boardA.id}/todos/${todoA.body.id}`)
      .set(auth(owner.token));

    expect(intact.status).toBe(200);
    expect(intact.body.todo.title).toBe('Only on board A');
  });

  it('keeps legacy /todos scoped to the Personal board', async () => {
    const owner = await registerUser({
      name: 'Owner',
      email: 'legacy-personal-owner@example.com',
    });
    const sharedBoard = await createBoard({ token: owner.token });

    const personalTodo = await request(app)
      .post('/api/v1/todos')
      .set(auth(owner.token))
      .send({ title: 'Personal only' });

    const sharedTodo = await request(app)
      .post(`/api/v1/boards/${sharedBoard.id}/todos`)
      .set(auth(owner.token))
      .send({ title: 'Shared only' });

    expect(personalTodo.status).toBe(201);
    expect(sharedTodo.status).toBe(201);

    const legacyList = await request(app)
      .get('/api/v1/todos')
      .set(auth(owner.token));

    expect(legacyList.status).toBe(200);
    expect(legacyList.body.totalTodos).toBe(1);
    expect(legacyList.body.data).toHaveLength(1);
    expect(legacyList.body.data[0].id).toBe(personalTodo.body.id);

    const legacyFetchShared = await request(app)
      .get(`/api/v1/todos/${sharedTodo.body.id}`)
      .set(auth(owner.token));

    expect(legacyFetchShared.status).toBe(404);
  });

  it('preserves todo validation and pagination behavior on board-scoped routes', async () => {
    const owner = await registerUser({
      name: 'Owner',
      email: 'board-validation-owner@example.com',
    });
    const board = await createBoard({ token: owner.token });

    const missingTitle = await request(app)
      .post(`/api/v1/boards/${board.id}/todos`)
      .set(auth(owner.token))
      .send({});

    const shortTitle = await request(app)
      .post(`/api/v1/boards/${board.id}/todos`)
      .set(auth(owner.token))
      .send({ title: 'ab' });

    expect(missingTitle.status).toBe(400);
    expect(shortTitle.status).toBe(400);

    for (let i = 1; i <= 11; i += 1) {
      const response = await request(app)
        .post(`/api/v1/boards/${board.id}/todos`)
        .set(auth(owner.token))
        .send({ title: `Task ${String(i).padStart(2, '0')}` });

      expect(response.status).toBe(201);
    }

    const pageTwo = await request(app)
      .get(`/api/v1/boards/${board.id}/todos?p=2`)
      .set(auth(owner.token));

    expect(pageTwo.status).toBe(200);
    expect(pageTwo.body.page).toBe(2);
    expect(pageTwo.body.pageCount).toBe(2);
    expect(pageTwo.body.totalTodos).toBe(11);
    expect(pageTwo.body.data).toHaveLength(1);
  });

  it('rejects invalid board IDs before querying tasks', async () => {
    const user = await registerUser({
      name: 'User',
      email: 'invalid-board-id@example.com',
    });

    const response = await request(app)
      .get('/api/v1/boards/not-a-number/todos')
      .set(auth(user.token));

    expect(response.status).toBe(400);
    expect(response.body.msg).toMatch(/invalid board id/i);
  });
});
