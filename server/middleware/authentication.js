const jwt = require('jsonwebtoken');
const { UnauthenticatedError } = require('../errors');

const auth = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new UnauthenticatedError('Authentication failed');
  }
  
  const token = authHeader.split(' ')[1];
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    // add user id to request object
    req.user = { userId: payload.userId };
    next();
  } catch (error) {
    throw new UnauthenticatedError('Authentication failed');
    // return next(new UnauthenticatedError('Authentication failed'));

  }
};

module.exports = auth;
