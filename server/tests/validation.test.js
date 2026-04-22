const request = require('supertest');
const app = require('../app');
const Todo = require('../models/Todo');
const jwt = require('jsonwebtoken');

const getValidTestToken = (userId = '507f1f77bcf86cd799439011') => {
  return jwt.sign(
    { userId },
    process.env.JWT_SECRET || 'test-secret-key-for-jwt-signing',
    { expiresIn: '30d' }
  );
};

describe('Todo Input Validation - Integration Tests', () => {
  let authToken;

  beforeEach(async () => {
    authToken = getValidTestToken();
    
    try {
      await Todo.deleteMany({});
    } catch (error) {
      // Collection may not exist yet
    }
  });

  describe('POST /api/v1/todos - Title Length Validation', () => {
    it('should reject todo creation with title too short (< 3 chars)', async () => {
      const response = await request(app)
        .post('/api/v1/todos')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'ab',
          description: 'Test',
        });

      expect(response.status).toBe(400);
      expect(
        response.body.msg || 
        response.body.message || 
        response.body.error || 
        JSON.stringify(response.body)
      ).toMatch(/title|length|minimum|3|characters/i);
    });

    it('should reject todo creation with title too long (> 50 chars)', async () => {
      const longTitle = 'A'.repeat(51);
      const response = await request(app)
        .post('/api/v1/todos')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: longTitle,
          description: 'Test',
        });

      expect(response.status).toBe(400);
      expect(
        response.body.msg || 
        response.body.message || 
        response.body.error || 
        JSON.stringify(response.body)
      ).toMatch(/title|length|maximum|50|characters/i);
    });

    it('should reject todo with whitespace-only title', async () => {
      const response = await request(app)
        .post('/api/v1/todos')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: '   ',
          description: 'Test',
        });

      expect(response.status).toBe(400);
      expect(
        response.body.msg || 
        response.body.message || 
        response.body.error || 
        JSON.stringify(response.body)
      ).toMatch(/title|content|empty|whitespace/i);
    });

    it('should accept todo with valid title length (3-50 chars)', async () => {
      const response = await request(app)
        .post('/api/v1/todos')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Valid Todo Title',
          description: 'Test description',
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('title', 'Valid Todo Title');
    });

    it('should accept minimum valid title length (exactly 3 chars)', async () => {
      const response = await request(app)
        .post('/api/v1/todos')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'ABC',
          description: 'Test',
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('title', 'ABC');
    });

    it('should accept maximum valid title length (exactly 50 chars)', async () => {
      const response = await request(app)
        .post('/api/v1/todos')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'A'.repeat(50),
          description: 'Test',
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('title', 'A'.repeat(50));
    });
  });

  describe('POST /api/v1/todos - Required Field Validation', () => {
    it('should reject todo without title field', async () => {
      const response = await request(app)
        .post('/api/v1/todos')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          description: 'Test',
        });

      expect(response.status).toBe(400);
      expect(
        response.body.msg || 
        response.body.message || 
        response.body.error || 
        JSON.stringify(response.body)
      ).toMatch(/title|required/i);
    });

    it('should reject todo with null title', async () => {
      const response = await request(app)
        .post('/api/v1/todos')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: null,
          description: 'Test',
        });

      expect(response.status).toBe(400);
    });
  });
});
