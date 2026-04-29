# Full-Stack Todo Application

[![CI Pipeline](https://github.com/ronketer/todo-list-api/actions/workflows/node.js.yml/badge.svg)](https://github.com/ronketer/todo-list-api/actions)
[![Coverage](https://img.shields.io/badge/Coverage-≥80%25-brightgreen)](#testing)
[![Node](https://img.shields.io/badge/Node.js-18%2B-339933?logo=node.js&logoColor=white)](https://nodejs.org)
[![React](https://img.shields.io/badge/React-18-61dafb?logo=react&logoColor=white)](https://react.dev)

A full-stack task management application built with a Node.js/Express REST API and a React + Vite frontend. Implements JWT authentication, user-scoped data access, paginated queries, and a GitHub Actions CI pipeline that enforces ≥80% backend test coverage on every push.

## Tech Stack

| Layer | Technologies |
|-------|-------------|
| Backend | Node.js 18, Express 4, Mongoose 8, MongoDB |
| Frontend | React 19, Vite 5, Mantine, Tailwind CSS, React Router v6 |
| Auth | JSON Web Tokens (jsonwebtoken), bcryptjs |
| Testing | Jest, Supertest, mongodb-memory-server |
| CI/CD | GitHub Actions (Node 18 & 20 matrix) |
| Security | Helmet, controller-level validation, user-scoped DB queries |

## Features

- **JWT Authentication** — stateless auth; register and login return a signed token stored client-side
- **Full CRUD** — create, read, update, and delete todos with title and description
- **Pagination** — server-side pagination (10 items/page) via `?p=N` query parameter
- **User-scoped data** — every query filters by `createdBy: userId`; cross-user access is impossible at the query level
- **Daily quotes** — public endpoint fetches a zen quote from ZenQuotes API and caches it server-side for 24 hours
- **CI/CD pipeline** — GitHub Actions runs the full test suite across Node 18 and 20, blocks merge on coverage drop below 80%

## Architecture

```
client request
      │
      ▼
app.js  (Helmet, CORS, JSON body parser)
      │
      ▼
routes/  (thin Express router wiring — no logic)
      │
      ▼
middleware/authentication.js  (verifies Bearer JWT → attaches req.user.userId)
      │
      ▼
controllers/  (all business logic and input validation)
      │
      ▼
models/  (Mongoose schemas, constraints, instance methods)
```

| Layer | Responsibility |
|-------|----------------|
| `routes/` | Maps HTTP methods and paths to controller functions only |
| `controllers/` | Validates input, enforces business rules, calls models |
| `models/` | Mongoose schemas with constraints; `User` has pre-save bcrypt hashing and `createJWT`/`verifyPassword` methods; `Todo` auto-increments a numeric `id` field used by all API routes |
| `middleware/authentication.js` | Verifies Bearer JWT and attaches `req.user.userId` to the request |
| `errors/` | Custom error class hierarchy; `error-handler.js` maps them to HTTP status codes |

Controllers throw custom errors directly — `express-async-errors` catches them without requiring `next(err)`.

## API Reference

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/v1/auth/register` | — | Create account; returns JWT |
| POST | `/api/v1/auth/login` | — | Login; returns JWT |
| GET | `/api/v1/todos` | Bearer JWT | List todos (paginated, `?p=N`) |
| POST | `/api/v1/todos` | Bearer JWT | Create todo |
| GET | `/api/v1/todos/:id` | Bearer JWT | Get single todo by numeric id |
| PUT | `/api/v1/todos/:id` | Bearer JWT | Update todo |
| DELETE | `/api/v1/todos/:id` | Bearer JWT | Delete todo |
| GET | `/api/v1/quotes/today` | — | Zen quote of the day (cached 24h) |

## Testing

Tests are **integration tests** — they exercise the full Express request/response cycle via Supertest with no mocking. Before the suite runs, `mongodb-memory-server` spins up an in-memory MongoDB instance so real Mongoose validation, pre-save hooks, and schema constraints are exercised on every test. Collections are wiped between each test for isolation.

Coverage is collected over `controllers/`, `middleware/`, `models/`, and `routes/`, and is gated at ≥80% — any PR that drops below that threshold fails CI.

```bash
# From the server/ directory:
npm test                        # run the full test suite
npm test -- --coverage          # with coverage report
npm test -- tests/auth.test.js  # single file
```

## Security

- **Stateless JWT auth** — tokens are signed with a secret and carry only `userId`; no server-side session state
- **bcrypt (10 rounds)** — passwords are hashed in a Mongoose pre-save hook and never stored in plaintext
- **Helmet** — sets security-relevant HTTP response headers (CSP, X-Frame-Options, etc.) on every request
- **Input validation** — length and type checks in controllers run before any database call; Mongoose schema constraints provide a second validation layer
- **User-scoped queries** — all todo operations include `createdBy: req.user.userId` in the filter, making cross-user data access structurally impossible

## Project Structure

```
todo-list-api/
├── server/                         # Node.js + Express backend
│   ├── app.js                      # Express app setup (middleware, routes)
│   ├── controllers/                # Business logic
│   ├── routes/                     # Express router wiring
│   ├── models/                     # Mongoose schemas
│   ├── middleware/                 # JWT auth, error handler
│   ├── errors/                     # Custom error hierarchy
│   ├── db/                         # MongoDB connection
│   ├── tests/                      # Integration test suite
│   ├── jest.config.js
│   └── package.json
│
├── client/                         # React + Vite frontend
│   ├── src/
│   │   ├── pages/                  # Login, Register, Dashboard
│   │   ├── components/             # TodoItem, TodoForm, ProtectedRoute
│   │   ├── context/                # AuthContext (JWT + localStorage)
│   │   ├── api/                    # Axios instance with auth interceptor
│   │   └── App.jsx
│   ├── vite.config.js              # Proxies /api → http://localhost:3000
│   └── package.json
│
├── .github/workflows/              # CI: test matrix + frontend build
├── .env.example                    # Required environment variables
└── package.json                    # Root scripts (dev, test, build, install)
```

## Getting Started

### Prerequisites

- Node.js v18+
- A MongoDB Atlas URI (only required to run the server — tests use an in-memory database)

### Installation

```bash
git clone https://github.com/ronketer/todo-list-api.git
cd todo-list-api

# Install all dependencies (server + client)
npm run install:all

# Configure environment
cp .env.example .env
```

Edit `.env` with your values:

| Variable | Description |
|----------|-------------|
| `MONGO_URI` | MongoDB Atlas connection string |
| `JWT_SECRET` | Random secret for signing tokens (`openssl rand -hex 32`) |
| `JWT_EXPIRATION` | Token lifetime (e.g. `30d`) |
| `PORT` | Backend port (default: `3000`) |

### Running Locally

Start the backend (http://localhost:3000):
```bash
npm run dev:server
```

Start the frontend (http://localhost:5173):
```bash
npm run dev:client
```

The frontend proxies all `/api` requests to the backend via Vite's proxy config — no CORS configuration needed in development.

Other root-level scripts:
```bash
npm test              # run backend test suite
npm run build:client  # production build of the frontend
```
