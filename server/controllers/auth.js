const { StatusCodes } = require('http-status-codes');
const db = require('../db/pool');
const { hashPassword, verifyPassword, createJWT } = require('../utils/auth.utils');
const { UnauthenticatedError, BadRequestError } = require('../errors');

const register = async (req, res) => {
  const { name, email, password } = req.body;
  const hasMissingField = [name, email, password].some(
    (value) => !value || `${value}`.trim() === ''
  );
  if (hasMissingField) {
    throw new BadRequestError('Name, email, and password are required.');
  }

  const hashed = await hashPassword(password);

  let rows;
  try {
    ({ rows } = await db.pool.query(
      `INSERT INTO users (name, email, password)
       VALUES ($1, $2, $3)
       RETURNING id`,
      [name.trim(), email.trim(), hashed]
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

  const { rows } = await db.pool.query(
    `SELECT id, password FROM users WHERE email = $1`,
    [email.trim()]
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
