const request = require('supertest');
const app = require('../app');
const db = require('../db/pool');
const { hashPassword } = require('../utils/auth.utils');

describe('POST /api/v1/auth/register', () => {
  it('should register a new user and return a token', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ name: 'Test User', email: 'newuser@example.com', password: 'TestPassword123!' });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('token');
  });

  it('should reject registration with missing fields', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ name: 'Test User' });

    expect(res.status).toBe(400);
  });

  it('should reject registration with blank fields', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ name: '  ', email: 'a@b.com', password: 'TestPassword123!' });

    expect(res.status).toBe(400);
  });

  it('should reject duplicate email (case-insensitive duplicate check)', async () => {
    const user = { name: 'Dup', email: 'dup@example.com', password: 'TestPassword123!' };
    await request(app).post('/api/v1/auth/register').send(user);
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ name: 'Dup 2', email: 'DUP@EXAMPLE.COM', password: 'TestPassword123!' });

    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.body.msg || res.body.message).toMatch(/already in use/i);
  });

  describe('Email Normalization & Format Validation', () => {
    it('should register successfully with mixed-case email and normalize it', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({ name: 'Mixed Case', email: 'Ron.Keter@Example.COM', password: 'Password123!' });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('token');
    });

    it('should register successfully with surrounding whitespace in email', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({ name: 'Spaced Email', email: '   user.spaces@example.com   ', password: 'Password123!' });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('token');
    });

    const invalidEmails = [
      'foo',
      'not-an-email',
      '@example.com',
      'ron@',
      'ron@example',
      'ron example@example.com',
    ];

    test.each(invalidEmails)('should reject registration with invalid email format: "%s"', async (email) => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({ name: 'Invalid User', email, password: 'Password123!' });

      expect(res.status).toBe(400);
      expect(res.body.msg || res.body.message).toMatch(/invalid email/i);
    });
  });

  describe('Password Length Validation', () => {
    it('should register successfully with a password of exactly 8 characters', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({ name: 'Exact Pass', email: 'exact8@example.com', password: '12345678' });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('token');
    });

    it('should reject registration with 1-character password', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({ name: 'Short Pass 1', email: 'short1@example.com', password: 'a' });

      expect(res.status).toBe(400);
      expect(res.body.msg || res.body.message).toMatch(/password.*8.*characters/i);
    });

    it('should reject registration with 7-character password', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({ name: 'Short Pass 7', email: 'short7@example.com', password: '1234567' });

      expect(res.status).toBe(400);
      expect(res.body.msg || res.body.message).toMatch(/password.*8.*characters/i);
    });
  });
});

describe('POST /api/v1/auth/login', () => {
  const creds = { name: 'Login User', email: 'login@example.com', password: 'TestPassword123!' };

  beforeEach(async () => {
    await request(app).post('/api/v1/auth/register').send(creds);
  });

  it('should return a token on valid credentials', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: creds.email, password: creds.password });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
  });

  it('should authenticate successfully with mixed-case and padded email (case-insensitive login)', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: '   LOGIN@EXAMPLE.COM   ', password: creds.password });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
  });

  it('should reject login with wrong password', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: creds.email, password: 'WrongPassword!' });

    expect(res.status).toBe(401);
  });

  it('should reject login with non-existent email', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'nobody@example.com', password: 'TestPassword123!' });

    expect(res.status).toBe(401);
  });

  it('should reject login with missing credentials', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({});

    expect(res.status).toBe(400);
  });
});

describe('Legacy Mixed-Case Stored Email Compatibility', () => {
  const legacyEmail = 'Ron.Keter@Example.COM';
  const legacyPassword = 'LegacyPassword123!';
  const legacyName = 'Legacy User';

  beforeEach(async () => {
    const hashed = await hashPassword(legacyPassword);
    await db.pool.query(
      `INSERT INTO users (name, email, password) VALUES ($1, $2, $3)`,
      [legacyName, legacyEmail, hashed]
    );
  });

  it('should allow login with lowercase equivalent of legacy mixed-case stored email', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'ron.keter@example.com', password: legacyPassword });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
  });

  it('should allow login with mixed-case and padded input matching legacy stored email', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: '   RON.KETER@EXAMPLE.COM   ', password: legacyPassword });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
  });

  it('should reject registration of lowercase equivalent of legacy mixed-case stored email', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ name: 'New User', email: 'ron.keter@example.com', password: 'NewPassword123!' });

    expect(res.status).toBe(400);
    expect(res.body.msg || res.body.message).toMatch(/already in use/i);
  });

  it('should ensure the legacy account is not duplicated in the database', async () => {
    // Attempt registration with exact same mixed-case
    const res1 = await request(app)
      .post('/api/v1/auth/register')
      .send({ name: 'Duplicate User', email: legacyEmail, password: 'NewPassword123!' });
    expect(res1.status).toBe(400);

    // Attempt registration with lowercase
    const res2 = await request(app)
      .post('/api/v1/auth/register')
      .send({ name: 'Duplicate User 2', email: 'ron.keter@example.com', password: 'NewPassword123!' });
    expect(res2.status).toBe(400);

    // Verify row count is still 1
    const { rows } = await db.pool.query(
      `SELECT * FROM users WHERE LOWER(email) = $1`,
      ['ron.keter@example.com']
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].email).toBe(legacyEmail);
  });
});
