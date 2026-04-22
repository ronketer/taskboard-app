const { StatusCodes } = require('http-status-codes');
const User = require('../models/User');
const { UnauthenticatedError, BadRequestError } = require('../errors');

//  handle user registration

const register = async (req, res) => {
  const { name, email, password } = req.body;
  const hasMissingField = [name, email, password].some(
    (value) => !value || `${value}`.trim() === ''
  );
  if (hasMissingField) {
    throw new BadRequestError('Name, email, and password are required.');
  }

  const user = await User.create({
    name: name.trim(),
    email: email.trim(),
    password,
  });
  
  const token = user.createJWT();
  
  res.status(StatusCodes.CREATED).json({ token });
};

//  handle user login
const login = async (req, res) => {
  const { email, password } = req.body; 
  const hasMissingField = [email, password].some(
    (value) => !value || `${value}`.trim() === ''
  );
  if (hasMissingField) {
    throw new BadRequestError('Email and password are required.');
  }
  
  const user = await User.findOne({ email });
  

  if (!user) {
    throw new UnauthenticatedError('Invalid email account');
  }
  

  // verify user password and throw an error if not matched
  const isPasswordCorrect = await user.verifyPassword(password);
  if (!isPasswordCorrect) {
    throw new UnauthenticatedError('Invalid email account');
  }
  
  
  const token = user.createJWT();
  
  res.status(StatusCodes.OK).json({ token });
};


module.exports = { login, register };