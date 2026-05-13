const request = require('supertest');
const app = require('../app');

describe('Todo Core Logic - Happy Paths and Branches', () => {
  let authToken;
  let createdTodoId;

  beforeEach(async () => {
    // Register a fresh user each test (setup.js deletes all rows after each test)
    const regRes = await request(app)
      .post('/api/v1/auth/register')
      .send({ name: 'Core User', email: 'core@example.com', password: 'Password123!' });
    authToken = regRes.body.token;

    // Seed one todo so the DB is never empty when tests run
    const todoRes = await request(app)
      .post('/api/v1/todos')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        title: 'Seeded CI/CD Todo',
        description: 'This guarantees the DB is ready for our tests',
      });
    createdTodoId = todoRes.body.id;
  });

  it('should successfully create a todo', async () => {
    const response = await request(app)
      .post('/api/v1/todos')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ title: 'Complete CI/CD Pipeline', description: 'Hit the 80% coverage mark' });
    expect(response.status).toBe(201);
  });

  it('should successfully fetch all todos', async () => {
    const response = await request(app)
      .get('/api/v1/todos')
      .set('Authorization', `Bearer ${authToken}`);
    expect(response.status).toBe(200);
  });

  it('should successfully fetch a single todo by ID', async () => {
    const response = await request(app)
      .get(`/api/v1/todos/${createdTodoId}`)
      .set('Authorization', `Bearer ${authToken}`);
    expect(response.status).toBe(200);
  });

  it('should successfully update a todo', async () => {
    const response = await request(app)
      .put(`/api/v1/todos/${createdTodoId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ title: 'Updated CI/CD Pipeline' });
    expect(response.status).toBe(200);
  });

  it('should successfully delete a todo', async () => {
    const response = await request(app)
      .delete(`/api/v1/todos/${createdTodoId}`)
      .set('Authorization', `Bearer ${authToken}`);
    expect(response.status).toBe(204);
  });

  it('should trigger pagination branch for page < 1', async () => {
    const response = await request(app)
      .get('/api/v1/todos?p=-5')
      .set('Authorization', `Bearer ${authToken}`);
    expect(response.status).toBe(200);
  });

  it('should trigger pagination branch for page > pageCount', async () => {
    const response = await request(app)
      .get('/api/v1/todos?p=9999')
      .set('Authorization', `Bearer ${authToken}`);
    expect(response.status).toBe(200);
  });

  it('should trigger validation branch for non-string title', async () => {
    const response = await request(app)
      .post('/api/v1/todos')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ title: 12345, description: 'Testing non-string branch' });
    expect(response.status).toBe(400);
  });

  it('should trigger update branch when only updating description', async () => {
    const response = await request(app)
      .put(`/api/v1/todos/${createdTodoId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ description: 'Updating description only triggers a specific branch' });
    expect(response.status).toBe(200);
  });

  it('should trigger error branch for empty update body', async () => {
    const response = await request(app)
      .put(`/api/v1/todos/${createdTodoId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({});
    expect(response.status).toBe(400);
  });

  it('should return 404 when getting a non-existent todo', async () => {
    const response = await request(app)
      .get('/api/v1/todos/99999')
      .set('Authorization', `Bearer ${authToken}`);
    expect(response.status).toBe(404);
  });

  it('should return 404 when updating a non-existent todo', async () => {
    const response = await request(app)
      .put('/api/v1/todos/99999')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ title: 'Updated' });
    expect(response.status).toBe(404);
  });

  it('should return 404 when deleting a non-existent todo', async () => {
    const response = await request(app)
      .delete('/api/v1/todos/99999')
      .set('Authorization', `Bearer ${authToken}`);
    expect(response.status).toBe(404);
  });
});
