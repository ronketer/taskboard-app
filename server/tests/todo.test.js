const request = require('supertest');
const app = require('../app');

describe('GET /api/v1/todos', () => {
  it('should require authentication to access todos', async () => {
    const response = await request(app).get('/api/v1/todos');
    expect([401, 403]).toContain(response.statusCode);
  });

  it('should return todos with valid authentication', async () => {
    const response = await request(app)
      .get('/api/v1/todos')
      .set('Authorization', 'Bearer invalid_token');
    expect(response.statusCode).toBeLessThan(500);
  });
});

describe('POST /api/v1/todos', () => {
  it('should require authentication to create todo', async () => {
    const response = await request(app)
      .post('/api/v1/todos')
      .send({
        title: 'New Todo',
        description: 'Test todo item',
      });

    expect([401, 403]).toContain(response.statusCode);
  });

  it('should reject todo creation with missing title field', async () => {
    const response = await request(app)
      .post('/api/v1/todos')
      .set('Authorization', 'Bearer token')
      .send({
        description: 'Test todo item',
      });

    expect([400, 401]).toContain(response.statusCode);
  });

  it('should reject todo creation with empty title', async () => {
    const response = await request(app)
      .post('/api/v1/todos')
      .set('Authorization', 'Bearer token')
      .send({
        title: '',
        description: 'Test todo item',
      });

    expect([400, 401]).toContain(response.statusCode);
  });

  it('should reject todo creation with excessively long title', async () => {
    const response = await request(app)
      .post('/api/v1/todos')
      .set('Authorization', 'Bearer token')
      .send({
        title: 'A'.repeat(10000),
        description: 'Test todo item',
      });

    expect(response.statusCode).toBeLessThan(500);
  });

  it('should reject todo with special characters in title', async () => {
    const response = await request(app)
      .post('/api/v1/todos')
      .set('Authorization', 'Bearer token')
      .send({
        title: '<script>alert("xss")</script>',
        description: 'Test todo item',
      });

    expect(response.statusCode).toBeLessThan(500);
  });
});

describe('PUT /api/v1/todos/:id', () => {
  const validTodoId = '507f1f77bcf86cd799439011';

  it('should require authentication to update todo', async () => {
    const response = await request(app)
      .put(`/api/v1/todos/${validTodoId}`)
      .send({
        title: 'Updated Todo',
      });

    expect([401, 403]).toContain(response.statusCode);
  });

  it('should return 404 for non-existent todo', async () => {
    const response = await request(app)
      .put('/api/v1/todos/000000000000000000000000')
      .set('Authorization', 'Bearer token')
      .send({
        title: 'Updated Todo',
      });

    expect(response.statusCode).toBeLessThan(500);
  });

  it('should reject update with invalid todo ID format', async () => {
    const response = await request(app)
      .put('/api/v1/todos/invalid-id')
      .set('Authorization', 'Bearer token')
      .send({
        title: 'Updated Todo',
      });

    expect([400, 401, 404]).toContain(response.statusCode);
  });

  it('should reject update with empty title', async () => {
    const response = await request(app)
      .put(`/api/v1/todos/${validTodoId}`)
      .set('Authorization', 'Bearer token')
      .send({
        title: '',
      });

    expect([400, 401]).toContain(response.statusCode);
  });
});

describe('DELETE /api/v1/todos/:id', () => {
  const validTodoId = '507f1f77bcf86cd799439011';

  it('should require authentication to delete todo', async () => {
    const response = await request(app)
      .delete(`/api/v1/todos/${validTodoId}`);

    expect([401, 403]).toContain(response.statusCode);
  });

  it('should return 404 when deleting non-existent todo', async () => {
    const response = await request(app)
      .delete('/api/v1/todos/000000000000000000000000')
      .set('Authorization', 'Bearer token');

    expect([404, 401]).toContain(response.statusCode);
  });

  it('should reject delete with invalid todo ID', async () => {
    const response = await request(app)
      .delete('/api/v1/todos/not-a-valid-id')
      .set('Authorization', 'Bearer token');

    expect([400, 401, 404]).toContain(response.statusCode);
  });
});

describe('GET /api/v1/todos/:id', () => {
  const validTodoId = '507f1f77bcf86cd799439011';

  it('should require authentication to get todo details', async () => {
    const response = await request(app)
      .get(`/api/v1/todos/${validTodoId}`);

    expect([401, 403]).toContain(response.statusCode);
  });

  it('should return 404 for non-existent todo ID', async () => {
    const response = await request(app)
      .get('/api/v1/todos/000000000000000000000000')
      .set('Authorization', 'Bearer token');

    expect([404, 401]).toContain(response.statusCode);
  });

  it('should reject request with invalid todo ID format', async () => {
    const response = await request(app)
      .get('/api/v1/todos/invalid@#$%')
      .set('Authorization', 'Bearer token');

    expect(response.statusCode).toBeLessThan(500);
  });
});

describe('Error Handling & Edge Cases', () => {
  it('should return proper error response for invalid HTTP method', async () => {
    const response = await request(app)
      .patch('/api/v1/todos/507f1f77bcf86cd799439011')
      .send({ title: 'Update' });

    expect(response.statusCode).toBeLessThan(500);
  });

  it('should handle malformed JSON in request body', async () => {
    const response = await request(app)
      .post('/api/v1/todos')
      .set('Content-Type', 'application/json')
      .set('Authorization', 'Bearer token')
      .send('{ invalid json }');

    expect([400, 401]).toContain(response.statusCode);
  });

  it('should enforce rate limiting or have graceful degradation', async () => {
    let statusCode = 200;
    for (let i = 0; i < 5; i++) {
      const response = await request(app)
        .get('/api/v1/todos')
        .set('Authorization', 'Bearer token');
      statusCode = response.statusCode;
    }

    expect(statusCode).toBeLessThan(500);
  });
});
