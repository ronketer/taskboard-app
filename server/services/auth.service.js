const userRepository = require('../repositories/user.repository');
const { hashPassword, verifyPassword, createJWT } = require('../utils/auth.utils');
const { UnauthenticatedError, BadRequestError } = require('../errors');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const isValidEmail = (email) => {
  return typeof email === 'string' && EMAIL_REGEX.test(email);
};

const hasMissingField = (values) => {
  return values.some((value) => !value || `${value}`.trim() === '');
};

const normalizeEmail = (email) => email.trim().toLowerCase();

const register = async ({ name, email, password }) => {
  if (hasMissingField([name, email, password])) {
    throw new BadRequestError('Name, email, and password are required.');
  }

  const normalizedEmail = normalizeEmail(email);

  if (!isValidEmail(normalizedEmail)) {
    throw new BadRequestError('Invalid email');
  }

  if (typeof password !== 'string' || password.length < 8) {
    throw new BadRequestError('Password must be at least 8 characters');
  }

  const existingUser = await userRepository.findIdByNormalizedEmail(normalizedEmail);
  if (existingUser) {
    throw new BadRequestError('Email already in use.');
  }

  const passwordHash = await hashPassword(password);

  let user;
  try {
    user = await userRepository.create({
      name: name.trim(),
      email: normalizedEmail,
      passwordHash,
    });
  } catch (err) {
    if (err.code === '23505') {
      throw new BadRequestError('Email already in use.');
    }
    throw err;
  }

  return createJWT(user.id);
};

const login = async ({ email, password }) => {
  if (hasMissingField([email, password])) {
    throw new BadRequestError('Email and password are required.');
  }

  const normalizedEmail = normalizeEmail(email);
  const user = await userRepository.findCredentialsByNormalizedEmail(normalizedEmail);

  if (!user) {
    throw new UnauthenticatedError('Invalid email account');
  }

  const isPasswordCorrect = await verifyPassword(password, user.password);
  if (!isPasswordCorrect) {
    throw new UnauthenticatedError('Invalid email account');
  }

  return createJWT(user.id);
};

module.exports = { login, register };
