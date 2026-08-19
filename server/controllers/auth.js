const { StatusCodes } = require('http-status-codes');
const authService = require('../services/auth.service');

const register = async (req, res) => {
  const token = await authService.register(req.body);
  res.status(StatusCodes.CREATED).json({ token });
};

const login = async (req, res) => {
  const token = await authService.login(req.body);
  res.status(StatusCodes.OK).json({ token });
};

module.exports = { login, register };
