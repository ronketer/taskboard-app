# Full-Stack Taskboard

[![CI Pipeline](https://github.com/ronketer/taskboard-app/actions/workflows/node.js.yml/badge.svg)](https://github.com/ronketer/taskboard-app/actions)
[![Node](https://img.shields.io/badge/Node.js-18%2B-339933?logo=node.js&logoColor=white)](https://nodejs.org)
[![React](https://img.shields.io/badge/React-19-61dafb?logo=react&logoColor=white)](https://react.dev)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-17-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker&logoColor=white)](https://www.docker.com/)
[![Kubernetes](https://img.shields.io/badge/Kubernetes-Minikube-326CE5?logo=kubernetes&logoColor=white)](https://minikube.sigs.k8s.io/)

A multi-user task board built as a **modular monolith** with Node.js/Express, PostgreSQL, and React.

The project started as a user-scoped CRUD application and was evolved into a board-based system with explicit application and persistence boundaries, transactional board creation, role-based membership rules, versioned schema migrations, data backfills, and a dedicated real-PostgreSQL CI path.

## What This Project Demonstrates

- **Layered backend architecture** — routes → controllers → services → repositories → PostgreSQL
- **Board-scoped authorization** — access is derived from `board_members`, not from trusting client-supplied resource IDs
- **Transactional workflows** — board + OWNER membership and user + Personal board creation are atomic
- **Database-enforced invariants** — foreign keys, composite keys, partial unique indexes, CHECK constraints, and normalized-email uniqueness
- **Schema evolution** — forward-only versioned migrations backfill existing users/todos into Personal boards without discarding data
- **Defense in depth** — services authorize board membership and repository queries still scope task reads/writes by `board_id`
- **Fast + production-realistic testing** — `pg-mem` for the normal suite and a separate PostgreSQL 17 integration job in GitHub Actions
- **End-to-end delivery** — React frontend, Docker Compose, Docker images, Kubernetes manifests, and CI

## Tech Stack

| Layer | Technologies |
|---|---|
| Backend | Node.js, Express 4, `pg` / node-postgres |
| Database | PostgreSQL 17, plain parameterized SQL, versioned SQL migrations |
| Frontend | React 19, Vite 8, Mantine 9, Tailwind CSS 4, React Router 7, Axios |
| Auth | JWT (`jsonwebtoken`), `bcryptjs` |
| Testing | Jest 30, Supertest, `pg-mem`, real PostgreSQL integration tests |
| CI/CD | GitHub Actions, Node 18/20 test matrix, PostgreSQL 17 service container |
| Containers | Docker, Docker Compose, Nginx |
| Orchestration | Kubernetes / Minikube |

## Features

### Boards and tasks

- Every account receives a **Personal** board during registration
- Users can create additional shared boards
- A board has exactly one `OWNER`; additional users join as `MEMBER`
- `OWNER` can add registered users by email and remove members
- Both `OWNER` and `MEMBER` can create, read, update, and delete board tasks
- The React dashboard can switch between boards and create new boards
- Server-side task pagination uses 10 items per page with deterministic `created_at DESC, id DESC` ordering

### Authentication and authorization

- Stateless Bearer JWT authentication
- Passwords hashed with bcrypt
- Email addresses normalized with `LOWER(BTRIM(email))`
- Authenticated non-members receive `404` for inaccessible boards to avoid leaking resource existence
- Board membership is checked in the service layer before board task operations
- Task repository operations remain constrained by `board_id` after authorization

### Compatibility

The original `/api/v1/todos` API remains available and is intentionally scoped to the authenticated user's Personal board. The current React client uses the board-scoped API.

## Architecture

```mermaid
flowchart TD
    UI["React client"] -->|HTTP / JSON + Bearer JWT| R["Express routes"]
    R --> A["Authentication middleware"]
    A --> C["Controllers"]
    C --> S["Application services"]
    S --> Repo["Repositories"]
    Repo --> DB[("PostgreSQL")]

    S -->|"authorization"| BM["Board membership rules"]
    S -->|"transaction orchestration"| TX["withTransaction()"]
    TX --> Repo

    classDef db fill:#eef,stroke:#446;
    class DB db;
```

### Layer responsibilities

| Layer | Responsibility |
|---|---|
| `routes/` | Express route declarations and middleware wiring |
| `controllers/` | HTTP-only adapter: request extraction, service invocation, status/JSON response |
| `services/` | Validation, authorization, pagination rules, transaction orchestration, application workflows |
| `repositories/` | Parameterized SQL and database row mapping |
| `db/migrations/` | Forward-only schema/data migrations |
| `middleware/authentication.js` | Verifies Bearer JWT and attaches `req.user.userId` |
| `errors/` | Typed application errors translated by centralized error middleware |

This is intentionally a **modular monolith**. The application is small enough that microservices, a message broker, CQRS, or a dependency-injection framework would add operational complexity without solving a current problem.

## Domain Model

```mermaid
erDiagram
    USERS ||--o{ BOARD_MEMBERS : joins
    BOARDS ||--|{ BOARD_MEMBERS : has
    BOARDS ||--o{ TODOS : contains
    USERS ||--o{ TODOS : creates

    USERS {
        int id PK
        varchar name
        varchar email
        text password
        timestamptz created_at
    }

    BOARDS {
        int id PK
        varchar name
        int created_by FK
        boolean is_personal
        timestamptz created_at
        timestamptz updated_at
    }

    BOARD_MEMBERS {
        int board_id PK,FK
        int user_id PK,FK
        varchar role
        timestamptz joined_at
    }

    TODOS {
        int id PK
        int board_id FK
        int created_by FK
        varchar title
        text description
        boolean completed
        timestamptz created_at
        timestamptz updated_at
    }
```

Important database invariants include:

- `(board_id, user_id)` is the primary key of `board_members`
- `role` is restricted to `OWNER` or `MEMBER`
- a partial unique index allows at most one `OWNER` per board
- a partial unique index allows at most one Personal board per creator
- `todos.board_id` is required and references `boards(id)`
- `LOWER(BTRIM(email))` has a unique expression index
- task-list indexes match the current ownership/board pagination access paths

## Authorization Model

Authentication answers **who is making the request**. Application services answer **what that user may do**.

| Operation | OWNER | MEMBER | Non-member |
|---|---:|---:|---:|
| List/view board tasks | ✅ | ✅ | 404 |
| Create/update/delete board tasks | ✅ | ✅ | 404 |
| List board members | ✅ | ✅ | 404 |
| Add member | ✅ | ❌ (403) | 404 |
| Remove member | ✅ | ❌ (403) | 404 |
| Remove OWNER | ❌ | ❌ | — |

For task operations the service first verifies board membership, then the repository still includes `board_id` in the SQL predicate. Knowing a task ID is therefore insufficient to access a task through another board.

## Transaction Boundaries

### Registration

A user must never exist without the Personal board expected by the application:

```text
BEGIN
  create user
  create Personal board
  create OWNER membership
COMMIT
```

If any step fails, the transaction rolls back.

### Board creation

Shared board creation follows the same invariant:

```text
BEGIN
  create board
  create OWNER membership
COMMIT
```

All statements in a transaction use the same checked-out PostgreSQL client.

## Database Migrations

Migrations live in `server/db/migrations/` and are applied by the project's versioned migration runner.

Current evolution:

```text
001  users
002  todos
003  normalized case-insensitive email uniqueness
004  todo ownership/pagination index
005  boards + memberships + todo board backfill
```

Migration `005` preserves existing application data:

1. creates `boards` and `board_members`;
2. creates one Personal board per existing user;
3. assigns each user as that board's `OWNER`;
4. backfills existing todos to the matching Personal board;
5. makes `todos.board_id` non-null;
6. adds board/membership/task indexes and constraints.

Applied versions are tracked in `schema_migrations`. Each unapplied migration runs atomically and is recorded only after success.

Run migrations explicitly:

```bash
npm run migrate
```

Docker Compose runs migrations before starting the API.

## API Reference

All protected endpoints require:

```http
Authorization: Bearer <JWT>
```

### Authentication

| Method | Path | Description |
|---|---|---|
| POST | `/api/v1/auth/register` | Create account, Personal board, and return JWT |
| POST | `/api/v1/auth/login` | Authenticate and return JWT |

### Boards

| Method | Path | Description |
|---|---|---|
| GET | `/api/v1/boards` | List boards visible to the authenticated user |
| POST | `/api/v1/boards` | Create a shared board and OWNER membership |
| GET | `/api/v1/boards/:boardId/members` | List board membership |
| POST | `/api/v1/boards/:boardId/members` | OWNER: add an existing user by email |
| DELETE | `/api/v1/boards/:boardId/members/:userId` | OWNER: remove a MEMBER |

### Board tasks

| Method | Path | Description |
|---|---|---|
| GET | `/api/v1/boards/:boardId/todos?p=N` | Paginated board tasks |
| POST | `/api/v1/boards/:boardId/todos` | Create board task |
| GET | `/api/v1/boards/:boardId/todos/:id` | Get board task |
| PUT | `/api/v1/boards/:boardId/todos/:id` | Update board task |
| DELETE | `/api/v1/boards/:boardId/todos/:id` | Delete board task |

### Compatibility and utility endpoints

| Method | Path | Description |
|---|---|---|
| GET/POST | `/api/v1/todos` | Legacy Personal-board list/create API |
| GET/PUT/DELETE | `/api/v1/todos/:id` | Legacy Personal-board task operations |
| GET | `/api/v1/quotes/today` | Public daily ZenQuotes endpoint with 24h process-local cache |
| GET | `/health` | API health check |

Errors use a stable JSON envelope:

```json
{
  "msg": "..."
}
```

## Testing

The backend uses two complementary test paths.

### Fast integration suite

```bash
npm test --prefix server
```

The normal suite uses Jest + Supertest and an isolated `pg-mem` database. It applies the real migration SQL files rather than maintaining a second test-only schema.

The suite currently contains **120 automated tests** covering authentication, validation, migrations, authorization isolation, Board/Member rules, legacy Personal-board behavior, and board-scoped task CRUD.

`pg-mem` compatibility shims are kept test-only; production SQL is not weakened to match the in-memory emulator.

### Real PostgreSQL integration suite

Database-specific behavior is also exercised against PostgreSQL 17:

```bash
npm run test:postgres --prefix server
```

The dedicated suite verifies behavior that an emulator cannot authoritatively prove, including:

- migration execution and repeat/idempotent execution
- normalized-email expression uniqueness
- the partial unique single-OWNER index
- unique board membership
- foreign-key integrity
- board/member API workflows against real PostgreSQL
- board-task authorization/CRUD against real PostgreSQL

The normal Jest config excludes the PostgreSQL-only invariant test so the two environments stay intentionally separate.

## CI Pipeline

GitHub Actions runs on pushes and pull requests to `main` / `master`.

```text
Run Tests
├── Node 18
└── Node 20
    └── Jest + coverage

PostgreSQL Integration
└── PostgreSQL 17 service
    ├── npm run migrate
    ├── npm run migrate        # idempotency
    └── npm run test:postgres

Build React Frontend
├── lint
└── vite build

Build Docker Images
├── server
└── client
```

This split keeps the normal feedback loop fast while still testing PostgreSQL-specific constraints and transaction behavior in CI.

## Security

- **JWT authentication** — stateless server-side authentication; tokens carry the user ID
- **bcrypt password hashing** — plaintext passwords are never persisted
- **Normalized unique email identity** — application normalization plus a PostgreSQL unique expression index
- **Parameterized SQL** — user-controlled values are passed through PostgreSQL parameters
- **Board-scoped authorization** — membership checks occur in application services
- **Defense-in-depth predicates** — task reads/writes are still constrained by `board_id`
- **Resource hiding** — authenticated non-members receive 404 for inaccessible boards
- **Database constraints** — important invariants remain protected if an application code path is wrong or concurrent
- **Helmet + CORS** — HTTP security headers and configured browser origin policy

## Local Development

### Prerequisites

- Node.js 18+
- npm
- PostgreSQL, or Docker + Docker Compose

### Install

```bash
git clone https://github.com/ronketer/taskboard-app.git
cd taskboard-app

npm run install:all
cp .env.example .env
```

Configure at least:

```env
DATABASE_URL=postgresql://user:password@localhost:5432/taskboard
JWT_SECRET=replace-with-a-random-secret
JWT_EXPIRATION=30d
PORT=3000
NODE_ENV=development
```

Apply migrations:

```bash
npm run migrate
```

Run the backend:

```bash
npm run dev:server
```

Run the frontend in another terminal:

```bash
npm run dev:client
```

Development URLs:

```text
Frontend: http://localhost:5173
API:      http://localhost:3000
```

## Docker Compose

For a local production-style stack:

```bash
cp .env.example .env
# Set JWT_SECRET and JWT_EXPIRATION in .env

docker compose up --build
```

Compose starts:

```text
Browser
  │
  ▼ :80
Nginx / React
  │ /api/*
  ▼
Node / Express :3000
  │
  ▼
PostgreSQL 17 :5432
```

The server container runs `npm run migrate` before `node app.js`.

The frontend Dockerfile is multi-stage (`Vite build → Nginx`). The server uses a single-stage Node Alpine production image.

## Kubernetes / Minikube

The repository also contains Kubernetes manifests for local Minikube deployment.

```bash
minikube start

# Build images inside Minikube's Docker daemon:
minikube docker-env | Invoke-Expression   # PowerShell
# eval $(minikube docker-env)             # bash/zsh

docker build -t taskboard-server:latest ./server
docker build -t taskboard-client:latest ./client

# Configure the gitignored k8s/secret.yaml, then:
kubectl apply -f k8s/

minikube service client
```

The client container serves the SPA with Nginx and proxies `/api/*` to the internal server service.

## Project Structure

```text
taskboard-app/
├── .github/workflows/
│   └── node.js.yml
├── client/
│   ├── src/
│   │   ├── api/
│   │   ├── components/
│   │   ├── context/
│   │   └── pages/
│   ├── Dockerfile
│   └── nginx.conf
├── server/
│   ├── controllers/
│   ├── services/
│   ├── repositories/
│   ├── routes/
│   ├── middleware/
│   ├── errors/
│   ├── db/
│   │   ├── migrate.js
│   │   ├── transaction.js
│   │   └── migrations/
│   ├── tests/
│   ├── app.js
│   └── Dockerfile
├── k8s/
├── docker-compose.yml
├── .env.example
└── package.json
```

## Design Tradeoffs

### Modular monolith over microservices

Boards, memberships, auth, and tasks share one transactionally consistent PostgreSQL database and have modest scale requirements. A modular monolith keeps deployment and debugging simple while still enforcing clear code boundaries.

### Plain SQL over an ORM

The project intentionally uses `pg` and explicit SQL. This keeps database constraints, indexes, joins, and transaction behavior visible and makes the persistence layer easy to reason about during code review.

### Database invariants over check-then-insert logic

For example, the application can detect an existing membership for a friendly error, but `(board_id, user_id)` remains a database primary key so concurrent requests cannot create duplicates.

### 404 for inaccessible resources

Authenticated non-members receive `404` rather than `403` for boards they cannot access. This avoids confirming whether a guessed board ID exists. A known member without sufficient role receives `403` for OWNER-only operations.

### `pg-mem` plus real PostgreSQL

`pg-mem` keeps most tests fast, but it does not perfectly emulate PostgreSQL features such as partial indexes. The project therefore runs a dedicated PostgreSQL integration suite instead of treating the emulator as the final source of truth.

## Evolution From the Original CRUD App

The architecture was evolved incrementally rather than rewritten in one step:

1. added cross-user authorization regression tests;
2. hardened email normalization and validation;
3. introduced a versioned migration runner;
4. moved email identity and pagination invariants into PostgreSQL indexes;
5. extracted controllers → services → repositories;
6. introduced Boards and Memberships with a data-preserving backfill;
7. added transactional board creation and role-based membership APIs;
8. added board-scoped task operations while preserving the legacy Personal-board API;
9. moved the React dashboard to board-aware endpoints;
10. added a dedicated real-PostgreSQL CI path.

That sequence keeps each architectural change independently testable and preserves working behavior throughout the refactor.
