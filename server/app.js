// imports
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
require('express-async-errors');
const express = require('express');
const app = express();
const connectDB = require('./db/connect');
const cors = require('cors'); 
const helmet = require('helmet');
// XSS Sanitization middleware - commented to focus on testing
// In production deployment, uncomment and configure appropriately
// const xssSanitize = require('express-xss-sanitizer');

const authRouter = require('./routes/auth');
const todoRouter = require('./routes/todo');
const quotesRouter = require('./routes/quotes');

const notFoundMiddleware = require('./middleware/not-found');
const errorHandlerMiddleware = require('./middleware/error-handler');
const authMiddleware = require('./middleware/authentication'); 

// security middleware
app.use(express.json());  // parses json to java object
app.use(helmet());// set security headers
// app.use(xssSanitize()); // enhance security against xss threats


app.use(cors({ origin: 'http://localhost:5173' }))

// routes
app.use('/api/v1/auth', authRouter); // public authentication route
app.use('/api/v1/todos', authMiddleware, todoRouter); // protected route
app.use('/api/v1/quotes', quotesRouter); // public quotes route


// error middleware
app.use(notFoundMiddleware); // 404 error
app.use(errorHandlerMiddleware); // any else error

const port = process.env.PORT || 3000;

const start = async () => {
  try {
    await connectDB(port);
    app.listen(port, () => console.log(`Server is listening on port ${port}...`));
  } catch (error) {
    console.error(error);
  }
};

// Only start the server if this file is run directly (not imported for testing)
if (require.main === module) {
  start();
}

module.exports = app;
