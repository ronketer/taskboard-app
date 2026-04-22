# Todo List App

![CI Pipeline](https://github.com/ronketer/secure-rest-api-cicd/actions/workflows/node.js.yml/badge.svg)
![Coverage Threshold](https://img.shields.io/badge/Coverage_Threshold-≥80%25-brightgreen)
![Security](https://img.shields.io/badge/Security-JWT_Auth-blue)
![Node](https://img.shields.io/badge/Node.js-v18%2B-339933?logo=node.js&logoColor=white)
![React](https://img.shields.io/badge/React-18-61dafb?logo=react&logoColor=white)

A fullstack todo application with a Node.js/Express backend and React frontend. Features JWT authentication, pagination, real-time UI updates, and a GitHub Actions CI pipeline enforcing ≥80% test coverage.

**Structure:** Monorepo with backend at root and React frontend in `client/`.

## Features

- 🔐 **JWT Authentication** — secure stateless auth with token persistence
- 📝 **CRUD Todos** — create, read, update (title + description), delete with confirmation
- 📄 **Pagination** — 10 todos per page with prev/next navigation
- 🎨 **Modern UI** — React with Tailwind CSS, responsive design
- ⚡ **Hot reload** — Vite dev server for instant feedback
- 🧪 **Comprehensive testing** — 80%+ coverage on backend; integration tests with real MongoDB
- 🚀 **CI/CD** — GitHub Actions pipeline runs tests and builds both backend and frontend
- 🔒 **User-scoped data** — todos are isolated per user; no cross-user access

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

## Project Structure

```
todo_list_api/
├── app.js                    # Express entry point
├── routes/ models/ controllers/ middleware/  # Backend
├── tests/                    # Backend integration tests
├── .github/workflows/        # CI/CD (test + frontend build)
├── .env.example
├── package.json             # Backend dependencies
│
└── client/                   # React + Vite frontend
    ├── src/
    │   ├── pages/           # Login, Register, Dashboard
    │   ├── components/      # TodoItem, TodoForm, ProtectedRoute
    │   ├── context/         # AuthContext (JWT + localStorage)
    │   ├── api/             # Axios instance with auth interceptor
    │   └── App.jsx
    ├── vite.config.js       # Proxy: /api → http://localhost:3000
    ├── tailwind.config.js
    └── package.json         # Frontend dependencies
```

## Getting Started

### Prerequisites

- Node.js v18+
- npm
- MongoDB Atlas URI *(only needed to run the server — tests use an in-memory DB)*

### Installation

```bash
git clone https://github.com/ronketer/todo-list-app.git
cd todo-list-app
npm install

# Install frontend dependencies
cd client
npm install
cd ..

# Set up environment
cp .env.example .env
```

Edit `.env` and fill in:

| Variable | Description |
|----------|-------------|
| `MONGO_URI` | MongoDB Atlas connection string |
| `JWT_SECRET` | Random secret for signing tokens (e.g. `openssl rand -hex 32`) |
| `JWT_EXPIRATION` | Token lifetime (e.g. `30d`) |
| `PORT` | Backend port (defaults to `3000`) |

### Run Locally

**Backend** (http://localhost:3000):
```bash
npm start        # dev server with nodemon
npm test         # test suite (no MongoDB needed)
```

**Frontend** (http://localhost:5173):
```bash
cd client
npm run dev      # dev server with hot-reload
npm run build    # production build
```

Both can run in parallel. The frontend proxies API calls to the backend via Vite's proxy config.

## Tech Stack

### Backend
| Layer | Technology |
|-------|-----------|
| Runtime | Node.js 18+ |
| Framework | Express 4 |
| ODM | Mongoose 8 |
| Database | MongoDB Atlas / in-memory (tests) |
| Auth | jsonwebtoken, bcryptjs |
| Security headers | Helmet |
| Testing | Jest, Supertest, mongodb-memory-server |

### Frontend
| Layer | Technology |
|-------|-----------|
| Runtime | Node.js 18+ |
| Framework | React 18 |
| Build tool | Vite 5 |
| Styling | Tailwind CSS |
| Routing | React Router v6 |
| HTTP client | Axios (with JWT interceptor) |
| State management | React Context + localStorage (auth) |

### CI/CD
| Tool | Purpose |
|------|---------|
| GitHub Actions | Run tests (Node 18 & 20), build frontend |
| Jest | Backend unit + integration tests (≥80% coverage) |
