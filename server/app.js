require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
require('express-async-errors');
const express = require('express');
const app = express();
const db = require('./db/pool');
const cors = require('cors');
const helmet = require('helmet');
// express-xss-sanitizer is excluded: it strips payloads used in security integration tests.
// pg parameterized queries ($1, $2 …) handle SQL injection; controller validation handles XSS.
// const xssSanitize = require('express-xss-sanitizer');

const authRouter = require('./routes/auth');
const todoRouter = require('./routes/todo');
const quotesRouter = require('./routes/quotes');

const notFoundMiddleware = require('./middleware/not-found');
const errorHandlerMiddleware = require('./middleware/error-handler');
const authMiddleware = require('./middleware/authentication');

// security middleware
app.use(express.json());
app.use(helmet());
// app.use(xssSanitize());

app.use(cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:5173' }));

// routes
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/todos', authMiddleware, todoRouter);
app.use('/api/v1/quotes', quotesRouter);

app.get('/health', (_req, res) => res.status(200).json({ status: 'ok' }));

// error middleware
app.use(notFoundMiddleware);
app.use(errorHandlerMiddleware);

const port = process.env.PORT || 3000;

const start = async () => {
  try {
    await db.pool.query('SELECT 1');
    console.log('Connected to PostgreSQL');
    app.listen(port, () => console.log(`Server is listening on port ${port}...`));
  } catch (error) {
    console.error(error);
  }
};

if (require.main === module) {
  start();
}

module.exports = app;
