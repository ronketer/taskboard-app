# Todo List API

![CI Pipeline](https://github.com/ronketer/secure-rest-api-cicd/actions/workflows/node.js.yml/badge.svg)
![Coverage Threshold](https://img.shields.io/badge/Coverage_Threshold-≥80%25-brightgreen)
![Security](https://img.shields.io/badge/Security-JWT_Auth-blue)
![Node](https://img.shields.io/badge/Node.js-v18%2B-339933?logo=node.js&logoColor=white)

A user-scoped RESTful Todo API built with Node.js and Express, featuring JWT authentication, integration testing against an in-memory MongoDB instance, and a GitHub Actions CI pipeline enforcing ≥80% test coverage.

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/v1/auth/register` | No | Create account, returns JWT |
| POST | `/api/v1/auth/login` | No | Login, returns JWT |
| GET | `/api/v1/todos` | Bearer JWT | List todos (paginated, `?p=N`, 10/page) |
| POST | `/api/v1/todos` | Bearer JWT | Create todo |
| GET | `/api/v1/todos/:id` | Bearer JWT | Get single todo by numeric id |
| PUT | `/api/v1/todos/:id` | Bearer JWT | Update todo |
| DELETE | `/api/v1/todos/:id` | Bearer JWT | Delete todo |

Todos are user-scoped — all queries filter by the authenticated user's ID.

## Architecture

```
Request → app.js → routes/ → middleware/authentication.js → controllers/ → models/
```

| Layer | Responsibility |
|-------|---------------|
| `routes/` | Thin Express router wiring only — no logic |
| `controllers/` | All business logic and input validation |
| `models/` | Mongoose schemas, constraints, and instance methods |
| `middleware/authentication.js` | Verifies Bearer JWT, attaches `req.user.userId` |
| `errors/` | Custom error hierarchy; `error-handler.js` maps them to HTTP status codes |

Controllers throw errors directly — `express-async-errors` catches them automatically without needing `next(err)`.

## Security

- **JWT Bearer tokens** — stateless auth; token payload carries `userId` only
- **bcrypt (10 salt rounds)** — passwords hashed via pre-save hook before hitting the database
- **Helmet** — sets security-related HTTP response headers on every request
- **Controller-level input validation** — length and type checks run before any DB call; Mongoose schema constraints act as a second layer
- **User-scoped queries** — every todo operation filters by `createdBy: req.user.userId`, preventing cross-user data access

## Testing

Tests are integration tests — they exercise the full Express app via `supertest` with no mocking. An in-memory MongoDB instance (via `mongodb-memory-server`) spins up automatically before the suite runs, ensuring real Mongoose validation is exercised. Collections are wiped between every test for isolation.

Coverage is measured over `controllers/`, `middleware/`, `models/`, and `routes/` and gated at ≥80% — enforced on every CI run.

```bash
npm test                           # run all tests
npm test -- --coverage             # with coverage report
npm test -- tests/auth.test.js     # single file
```

## Getting Started

### Prerequisites

- Node.js v18+
- npm
- MongoDB Atlas URI *(only needed to run the server — tests use an in-memory DB)*

### Installation

```bash
git clone https://github.com/ronketer/secure-rest-api-cicd.git
cd secure-rest-api-cicd
npm install
cp .env.example .env
```

Edit `.env` and fill in:

| Variable | Description |
|----------|-------------|
| `MONGO_URI` | MongoDB Atlas connection string |
| `JWT_SECRET` | Random secret for signing tokens (e.g. `openssl rand -hex 32`) |
| `JWT_EXPIRATION` | Token lifetime (e.g. `30d`) |
| `PORT` | Server port (defaults to `3000`) |

### Run

```bash
npm start        # start dev server (nodemon)
npm test         # run test suite (no MongoDB needed)
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js 18+ |
| Framework | Express 4 |
| ODM | Mongoose 8 |
| Database | MongoDB Atlas / in-memory (tests) |
| Auth | jsonwebtoken, bcryptjs |
| Security headers | Helmet |
| Testing | Jest, Supertest, mongodb-memory-server |
| CI | GitHub Actions |
