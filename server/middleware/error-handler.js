const { 
  CustomAPIError
} = require('../errors');

const { StatusCodes } = require('http-status-codes')
const customErrorHandler = (err, req, res, next) => {
  if (err instanceof SyntaxError && 'body' in err) {
    return res.status(StatusCodes.BAD_REQUEST).json({ msg: 'Invalid JSON payload' });
  }

  if (err.type === 'entity.parse.failed') {
    return res.status(StatusCodes.BAD_REQUEST).json({ msg: 'Invalid JSON payload' });
  }

  if (err instanceof CustomAPIError) {
    return res.status(err.statusCode).json({ msg: err.message })
  }
  return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ msg: err.message })
}

module.exports = customErrorHandler
