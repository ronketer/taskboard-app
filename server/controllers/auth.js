const { StatusCodes } = require('http-status-codes');
const db = require('../db/pool');
const { hashPassword, verifyPassword, createJWT } = require('../utils/auth.utils');
const { UnauthenticatedError, BadRequestError } = require('../errors');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const isValidEmail = (email) => {
  return typeof email === 'string' && EMAIL_REGEX.test(email);
};

const register = async (req, res) => {
  const { name, email, password } = req.body;
  const hasMissingField = [name, email, password].some(
    (value) => !value || `${value}`.trim() === ''
  );
  if (hasMissingField) {
    throw new BadRequestError('Name, email, and password are required.');
  }

  const normalizedEmail = email.trim().toLowerCase();

  if (!isValidEmail(normalizedEmail)) {
    throw new BadRequestError('Invalid email');
  }

  if (typeof password !== 'string' || password.length < 8) {
    throw new BadRequestError('Password must be at least 8 characters');
  }

  // Check for existing account (including legacy mixed-case stored emails)
  const existingUser = await db.pool.query(
    `SELECT id FROM users WHERE LOWER(BTRIM(email)) = $1`,
    [normalizedEmail]
  );
  if (existingUser.rows.length > 0) {
    throw new BadRequestError('Email already in use.');
  }

  const hashed = await hashPassword(password);

  let rows;
  try {
    ({ rows } = await db.pool.query(
      `INSERT INTO users (name, email, password)
       VALUES ($1, $2, $3)
       RETURNING id`,
      [name.trim(), normalizedEmail, hashed]
    ));
  } catch (err) {
    if (err.code === '23505') {
      throw new BadRequestError('Email already in use.');
    }
    throw err;
  }

  const token = createJWT(rows[0].id);
  res.status(StatusCodes.CREATED).json({ token });
};

const login = async (req, res) => {
  const { email, password } = req.body;
  const hasMissingField = [email, password].some(
    (value) => !value || `${value}`.trim() === ''
  );
  if (hasMissingField) {
    throw new BadRequestError('Email and password are required.');
  }

  const normalizedEmail = email.trim().toLowerCase();

  const { rows } = await db.pool.query(
    `SELECT id, password FROM users WHERE LOWER(BTRIM(email)) = $1`,
    [normalizedEmail]
  );

  const user = rows[0];
  if (!user) {
    throw new UnauthenticatedError('Invalid email account');
  }

  const isPasswordCorrect = await verifyPassword(password, user.password);
  if (!isPasswordCorrect) {
    throw new UnauthenticatedError('Invalid email account');
  }

  const token = createJWT(user.id);
  res.status(StatusCodes.OK).json({ token });
};

module.exports = { login, register };
