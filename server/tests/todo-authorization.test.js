const request = require('supertest');
const app = require('../app');

describe('Todo Cross-User Authorization & Isolation', () => {
  let userAToken;
  let userBToken;
  let userATodo;
  let userBTodo;

  beforeEach(async () => {
    // Register User A
    const resA = await request(app)
      .post('/api/v1/auth/register')
      .send({ name: 'User A', email: 'userA@example.com', password: 'Password123!' });
    userAToken = resA.body.token;

    // Register User B
    const resB = await request(app)
      .post('/api/v1/auth/register')
      .send({ name: 'User B', email: 'userB@example.com', password: 'Password123!' });
    userBToken = resB.body.token;

    // User A creates a Todo
    const todoResA = await request(app)
      .post('/api/v1/todos')
      .set('Authorization', `Bearer ${userAToken}`)
      .send({
        title: 'User A Secret Task',
        description: 'Confidential details belonging to User A',
      });
    userATodo = todoResA.body;

    // User B creates a Todo
    const todoResB = await request(app)
      .post('/api/v1/todos')
      .set('Authorization', `Bearer ${userBToken}`)
      .send({
        title: 'User B Public Task',
        description: 'Details belonging to User B',
      });
    userBTodo = todoResB.body;
  });

  describe('Read Isolation (GET /api/v1/todos/:id)', () => {
    it("should return 404 when User B attempts to fetch User A's todo by ID", async () => {
      const res = await request(app)
        .get(`/api/v1/todos/${userATodo.id}`)
        .set('Authorization', `Bearer ${userBToken}`);

      expect(res.status).toBe(404);
      expect(res.body.msg).toMatch(new RegExp(`No Todo with id ${userATodo.id}`, 'i'));
      expect(res.body).not.toHaveProperty('todo');
    });

    it("should allow User A to fetch their own todo by ID", async () => {
      const res = await request(app)
        .get(`/api/v1/todos/${userATodo.id}`)
        .set('Authorization', `Bearer ${userAToken}`);

      expect(res.status).toBe(200);
      expect(res.body.todo).toBeDefined();
      expect(res.body.todo.id).toBe(userATodo.id);
      expect(res.body.todo.title).toBe('User A Secret Task');
    });
  });

  describe('Update Isolation (PUT /api/v1/todos/:id)', () => {
    it("should return 404 when User B attempts to update User A's todo title/description", async () => {
      const res = await request(app)
        .put(`/api/v1/todos/${userATodo.id}`)
        .set('Authorization', `Bearer ${userBToken}`)
        .send({
          title: 'Hacked by User B',
          description: 'Malicious modification',
        });

      expect(res.status).toBe(404);
      expect(res.body.msg).toMatch(new RegExp(`No Todo with id ${userATodo.id}`, 'i'));
    });

    it("should return 404 when User B attempts to toggle User A's todo completion status", async () => {
      const res = await request(app)
        .put(`/api/v1/todos/${userATodo.id}`)
        .set('Authorization', `Bearer ${userBToken}`)
        .send({ completed: true });

      expect(res.status).toBe(404);
      expect(res.body.msg).toMatch(new RegExp(`No Todo with id ${userATodo.id}`, 'i'));
    });

    it("should verify that User A's todo remains unmodified after User B's failed update attempt", async () => {
      // User B attempts to modify User A's todo
      await request(app)
        .put(`/api/v1/todos/${userATodo.id}`)
        .set('Authorization', `Bearer ${userBToken}`)
        .send({
          title: 'Attempted Overwrite',
          description: 'Attempted description overwrite',
          completed: true,
        });

      // User A fetches the todo to verify data integrity
      const fetchRes = await request(app)
        .get(`/api/v1/todos/${userATodo.id}`)
        .set('Authorization', `Bearer ${userAToken}`);

      expect(fetchRes.status).toBe(200);
      expect(fetchRes.body.todo.id).toBe(userATodo.id);
      expect(fetchRes.body.todo.title).toBe('User A Secret Task');
      expect(fetchRes.body.todo.description).toBe('Confidential details belonging to User A');
      expect(fetchRes.body.todo.completed).toBe(false);
    });
  });

  describe('Delete Isolation (DELETE /api/v1/todos/:id)', () => {
    it("should return 404 when User B attempts to delete User A's todo", async () => {
      const res = await request(app)
        .delete(`/api/v1/todos/${userATodo.id}`)
        .set('Authorization', `Bearer ${userBToken}`);

      expect(res.status).toBe(404);
      expect(res.body.msg).toMatch(new RegExp(`No Todo with id ${userATodo.id}`, 'i'));
    });

    it("should verify that User A's todo is NOT deleted after User B's failed delete attempt", async () => {
      // User B attempts to delete User A's todo
      await request(app)
        .delete(`/api/v1/todos/${userATodo.id}`)
        .set('Authorization', `Bearer ${userBToken}`);

      // User A fetches the todo to prove it still exists
      const fetchRes = await request(app)
        .get(`/api/v1/todos/${userATodo.id}`)
        .set('Authorization', `Bearer ${userAToken}`);

      expect(fetchRes.status).toBe(200);
      expect(fetchRes.body.todo.id).toBe(userATodo.id);
      expect(fetchRes.body.todo.title).toBe('User A Secret Task');
    });

    it("should allow User A to delete their own todo successfully", async () => {
      const deleteRes = await request(app)
        .delete(`/api/v1/todos/${userATodo.id}`)
        .set('Authorization', `Bearer ${userAToken}`);

      expect(deleteRes.status).toBe(204);

      // Verify it is now deleted for User A
      const fetchRes = await request(app)
        .get(`/api/v1/todos/${userATodo.id}`)
        .set('Authorization', `Bearer ${userAToken}`);

      expect(fetchRes.status).toBe(404);
    });
  });

  describe('List Isolation (GET /api/v1/todos)', () => {
    it("should only return User B's todos and exclude User A's todos in User B's list", async () => {
      const res = await request(app)
        .get('/api/v1/todos')
        .set('Authorization', `Bearer ${userBToken}`);

      expect(res.status).toBe(200);
      expect(res.body.totalTodos).toBe(1);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].id).toBe(userBTodo.id);
      expect(res.body.data[0].title).toBe('User B Public Task');

      // Verify User A's todo is not present in User B's list
      const containsUserATodo = res.body.data.some(
        (todo) => todo.id === userATodo.id || todo.title === 'User A Secret Task'
      );
      expect(containsUserATodo).toBe(false);
    });

    it("should only return User A's todos and exclude User B's todos in User A's list", async () => {
      const res = await request(app)
        .get('/api/v1/todos')
        .set('Authorization', `Bearer ${userAToken}`);

      expect(res.status).toBe(200);
      expect(res.body.totalTodos).toBe(1);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].id).toBe(userATodo.id);
      expect(res.body.data[0].title).toBe('User A Secret Task');

      // Verify User B's todo is not present in User A's list
      const containsUserBTodo = res.body.data.some(
        (todo) => todo.id === userBTodo.id || todo.title === 'User B Public Task'
      );
      expect(containsUserBTodo).toBe(false);
    });

    it('should return an empty list with totalTodos 0 for a newly registered user with no todos', async () => {
      // Register User C who has created 0 todos
      const resC = await request(app)
        .post('/api/v1/auth/register')
        .send({ name: 'User C', email: 'userC@example.com', password: 'Password123!' });
      const userCToken = resC.body.token;

      const res = await request(app)
        .get('/api/v1/todos')
        .set('Authorization', `Bearer ${userCToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
      expect(res.body.totalTodos).toBe(0);
      expect(res.body.pageCount).toBe(1);
      expect(res.body.page).toBe(1);
    });
  });
});
