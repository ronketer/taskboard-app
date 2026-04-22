const request = require('supertest');
const app = require('../app');
const jwt = require('jsonwebtoken');

// Generate a valid token to bypass the auth middleware
const getValidTestToken = (userId = '507f1f77bcf86cd799439011') => {
  return jwt.sign(
    { userId, name: 'Test User' }, 
    process.env.JWT_SECRET || 'test-secret-key-for-jwt-signing',
    { expiresIn: '30d' }
  );
};

describe('Todo Core Logic - Happy Paths and Branches', () => {
  let authToken;
  let createdTodoId;

  // Set up our token before running the tests
  beforeAll(() => {
    authToken = getValidTestToken();
  });

  // Seed the database before EACH test so it is never empty
  beforeEach(async () => {
    const response = await request(app)
      .post('/api/v1/todos')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        title: 'Seeded CI/CD Todo',
        description: 'This guarantees the DB is ready for our tests'
      });
    createdTodoId = response.body.id;
  });

  it('should successfully create a todo', async () => {
    const response = await request(app)
      .post('/api/v1/todos')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        title: 'Complete CI/CD Pipeline',
        description: 'Hit the 80% coverage mark'
      });
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

  // --- NEW TESTS TO BOOST BRANCH COVERAGE ---

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
      .send({}); // Sending nothing
    expect(response.status).toBe(400);
  });
});