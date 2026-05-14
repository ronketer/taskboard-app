# Full-Stack Taskboard

[![CI Pipeline](https://github.com/ronketer/taskboard-app/actions/workflows/node.js.yml/badge.svg)](https://github.com/ronketer/taskboard-app/actions)
[![Coverage](https://img.shields.io/badge/Coverage-≥80%25-brightgreen)](#testing)
[![Node](https://img.shields.io/badge/Node.js-18%2B-339933?logo=node.js&logoColor=white)](https://nodejs.org)
[![React](https://img.shields.io/badge/React-19-61dafb?logo=react&logoColor=white)](https://react.dev)
[![Docker](https://img.shields.io/badge/Docker-multi--stage-2496ED?logo=docker&logoColor=white)](https://www.docker.com)
[![Kubernetes](https://img.shields.io/badge/Kubernetes-Minikube-326CE5?logo=kubernetes&logoColor=white)](https://minikube.sigs.k8s.io)

A full-stack task management application built with a Node.js/Express REST API and a React + Vite frontend. Implements JWT authentication, user-scoped data access, paginated queries, and a GitHub Actions CI pipeline that enforces ≥80% backend test coverage on every push.

![](<todo_app_demo - frame at 0m16s.jpg>)

## Tech Stack

| Layer | Technologies |
|-------|-------------|
| Backend | Node.js 18, Express 4, PostgreSQL, pg (node-postgres) |
| Frontend | React 19, Vite 5, Mantine, Tailwind CSS, React Router v6 |
| Auth | JSON Web Tokens (jsonwebtoken), bcryptjs |
| Testing | Jest, Supertest, pg-mem (in-memory PostgreSQL) |
| CI/CD | GitHub Actions (Node 18 & 20 matrix) |
| Containers | Docker (multi-stage builds), Docker Compose |
| Orchestration | Kubernetes (Minikube), ConfigMap, Secret, NodePort, ClusterIP |
| Security | Helmet, controller-level validation, parameterized SQL queries, user-scoped DB queries |

## Features

- **JWT Authentication** — stateless auth; register and login return a signed token stored client-side
- **Full CRUD** — create, read, update, and delete todos with title and description
- **Pagination** — server-side pagination (10 items/page) via `?p=N` query parameter
- **User-scoped data** — every query filters by `createdBy: userId`; cross-user access is impossible at the query level
- **Daily quotes** — public endpoint fetches a zen quote from ZenQuotes API and caches it server-side for 24 hours
- **CI/CD pipeline** — GitHub Actions runs the full test suite across Node 18 and 20, blocks merge on coverage drop below 80%
- **Containerized & orchestrated** — multi-stage Docker builds for both services; docker-compose for local dev; Kubernetes manifests (Deployments, Services, ConfigMap, Secret) for Minikube deployment

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
controllers/  (all business logic, input validation, raw SQL queries)
      │
      ▼
db/pool.js  (pg connection pool → PostgreSQL)
```

| Layer | Responsibility |
|-------|----------------|
| `routes/` | Maps HTTP methods and paths to controller functions only |
| `controllers/` | Validates input, enforces business rules, executes parameterized SQL via `db.pool.query()` |
| `db/pool.js` | Exports a `pg.Pool` instance connected to `DATABASE_URL` |
| `db/migrations/` | Plain SQL `CREATE TABLE` files — applied once to set up the schema |
| `utils/auth.utils.js` | `hashPassword`, `verifyPassword`, `createJWT` — auth helpers used by the auth controller |
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

Tests are **integration tests** — they exercise the full Express request/response cycle via Supertest with no mocking. Before the suite runs, `pg-mem` creates an in-memory PostgreSQL instance and applies the full schema (same `CREATE TABLE` DDL as production), so real SQL constraints and foreign keys are exercised on every test. All rows are deleted between each test for isolation.

Coverage is collected over `controllers/`, `middleware/`, and `routes/`, and is gated at ≥80% — any PR that drops below that threshold fails CI.

```bash
# From the server/ directory:
npm test                        # run the full test suite
npm test -- --coverage          # with coverage report
npm test -- tests/auth.test.js  # single file
```

## Security

- **Stateless JWT auth** — tokens are signed with a secret and carry only `userId`; no server-side session state
- **bcrypt (10 rounds)** — passwords are hashed in the register controller via `utils/auth.utils.js` and never stored in plaintext
- **Helmet** — sets security-relevant HTTP response headers (CSP, X-Frame-Options, etc.) on every request
- **Parameterized SQL** — all queries use `$1`/`$2` placeholders via `pg`; string interpolation into SQL is never used, preventing SQL injection by construction
- **Input validation** — length and type checks in controllers run before any database call
- **User-scoped queries** — all todo operations include `AND created_by = $N` in the SQL, making cross-user data access structurally impossible

## Deployment

### Docker Compose

The simplest way to run the full stack locally in production mode:

```bash
cp .env.example .env   # fill in DATABASE_URL, JWT_SECRET, JWT_EXPIRATION
docker compose up --build
# app available at http://localhost
```

### Kubernetes (Minikube)

Runs the exact same containers orchestrated by Kubernetes. Requires [minikube](https://minikube.sigs.k8s.io/docs/start/) and [kubectl](https://kubernetes.io/docs/tasks/tools/).

```bash
# 1. Start the cluster
minikube start

# 2. Point Docker CLI at Minikube's internal daemon
#    (images built after this live inside Minikube, not on your host)
minikube docker-env | Invoke-Expression   # Windows PowerShell
eval $(minikube docker-env)               # Mac / Linux

# 3. Build both images inside that context
docker build -t taskboard-server:latest ./server
docker build -t taskboard-client:latest ./client

# 4. Fill in k8s/secret.yaml with your DATABASE_URL and JWT secret, then apply
kubectl apply -f k8s/

# 5. Open the app
minikube service client
```

> `imagePullPolicy: Never` is intentional — it forces Kubernetes to use the locally built images rather than pulling from Docker Hub.

**Kubernetes architecture:**

```
Browser
  │
  ▼  :30080 (NodePort)
client pod  (nginx)
  │
  │  /api/*  →  proxy_pass
  ▼
server pod  (Node.js)  ←── ClusterIP service "server:3000"
  │
  ▼
PostgreSQL  (local or hosted — Neon / Supabase / Railway)
```

The nginx container serves the React SPA and proxies all `/api` requests to the backend via Kubernetes internal DNS (`server:3000`). The browser only ever talks to one origin.

**Useful kubectl commands:**

```bash
kubectl get pods                    # both pods should show Running
kubectl logs deployment/server      # backend logs
kubectl logs deployment/client      # nginx logs
kubectl describe pod -l app=server  # events (useful for CrashLoopBackOff)
```

## Project Structure

```
taskboard-app/
├── server/                         # Node.js + Express backend
│   ├── Dockerfile                  # Single-stage Node.js Alpine image
│   ├── app.js                      # Express app setup (middleware, routes)
│   ├── controllers/                # Business logic
│   ├── routes/                     # Express router wiring
│   ├── db/                         # pg connection pool + SQL migration files
│   ├── utils/                      # auth helpers (hash, verify, createJWT)
│   ├── middleware/                 # JWT auth, error handler
│   ├── errors/                     # Custom error hierarchy
│   ├── tests/                      # Integration test suite
│   ├── jest.config.js
│   └── package.json
│
├── client/                         # React + Vite frontend
│   ├── Dockerfile                  # Multi-stage: Vite build → Nginx serve
│   ├── nginx.conf                  # SPA fallback + /api proxy to server:3000
│   ├── src/
│   │   ├── pages/                  # Login, Register, Dashboard
│   │   ├── components/             # TodoItem, TodoForm, ProtectedRoute
│   │   ├── context/                # AuthContext (JWT + localStorage)
│   │   ├── api/                    # Axios instance with auth interceptor
│   │   └── App.jsx
│   ├── vite.config.js              # Proxies /api → http://localhost:3000 (dev only)
│   └── package.json
│
├── k8s/                            # Kubernetes manifests (Minikube)
│   ├── server-deployment.yaml      # Backend pod
│   ├── server-service.yaml         # ClusterIP — internal DNS "server:3000"
│   ├── client-deployment.yaml      # Frontend pod
│   ├── client-service.yaml         # NodePort 30080 — external browser access
│   ├── configmap.yaml              # Non-sensitive env vars (PORT, NODE_ENV, …)
│   └── secret.yaml                 # DATABASE_URL, JWT_SECRET (gitignored)
│
├── docker-compose.yml              # Compose orchestration for local prod mode
├── .github/workflows/              # CI: test matrix + frontend build
├── .env.example                    # Required environment variables
└── package.json                    # Root scripts (dev, test, build, install)
```

## Getting Started

### Prerequisites

- Node.js v18+
- PostgreSQL (local install or a free hosted instance — [Neon](https://neon.tech), [Supabase](https://supabase.com), [Railway](https://railway.app))
- Tests use `pg-mem` (in-memory PostgreSQL) — no database connection required to run the test suite

### Installation

```bash
git clone https://github.com/ronketer/taskboard-app.git
cd taskboard-app

# Install all dependencies (server + client)
npm run install:all

# Configure environment
cp .env.example .env
```

Edit `.env` with your values:

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string — e.g. `postgresql://user:pass@localhost:5432/todo_app` |
| `JWT_SECRET` | Random secret for signing tokens (`openssl rand -hex 32`) |
| `JWT_EXPIRATION` | Token lifetime (e.g. `30d`) |
| `PORT` | Backend port (default: `3000`) |

After setting `DATABASE_URL`, apply the schema migrations once:

```bash
psql $DATABASE_URL -f server/db/migrations/001_create_users.sql
psql $DATABASE_URL -f server/db/migrations/002_create_todos.sql
```

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
