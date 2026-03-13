# Job Application Tracker

A backend-first full-stack project for tracking job applications.

The project is currently focused on building a production-style backend API with authentication, authorization, and domain-specific CRUD operations.

Frontend development will be introduced in a later phase.

Tech stack:

- Node.js
- Express (TypeScript)
- PostgreSQL
- Docker Compose
- Jest + Supertest
- GitHub Actions CI

The backend provides authenticated REST endpoints for managing tasks and job applications.

---

## Architecture Overview

Local development runs fully in Docker.

Frontend (planned)
        ↓
Backend API (Express + TypeScript)
        ↓
PostgreSQL Database

Current backend features:

- Dockerized PostgreSQL
- Dockerized Node/Express API
- JWT authentication
- Role-based route protection
- Task CRUD endpoints
- Job application CRUD endpoints
- Development seed script
- Jest + Supertest API tests
- CI pipeline via GitHub Actions

---

## Project Structure

```text
job-application-tracker/
├── backend/
│   ├── src/
│   │   ├── __test__/
│   │   ├── config/
│   │   │   └── env.ts
│   │   ├── middleware/
│   │   │   ├── errorHandler.ts
│   │   │   ├── requireAuth.ts
│   │   │   └── requireRole.ts
│   │   ├── routes/
│   │   │   ├── admin.routes.ts
│   │   │   ├── applications.routes.ts
│   │   │   ├── auth.routes.ts
│   │   │   ├── health.routes.ts
│   │   │   └── tasks.routes.ts
│   │   ├── scripts/
│   │   │   └── seed.ts
│   │   ├── types/
│   │   │   └── express.d.ts
│   │   ├── utils/
│   │   │   └── helpers.ts
│   │   ├── app.ts
│   │   └── server.ts
│   ├── Dockerfile
│   ├── jest.config.js
│   ├── package.json
│   ├── tsconfig.json
│   └── tsconfig.test.json
├── db/
│   └── init.sql
├── .github/
│   └── workflows/
│       └── backend-ci.yml
├── docker-compose.yml
└── readme.md
```

---

## Database Schema

The database is initialized automatically via:

db/init.sql

Current tables:

users

id UUID PRIMARY KEY DEFAULT gen_random_uuid()
email TEXT NOT NULL UNIQUE
password_hash TEXT NOT NULL
role TEXT NOT NULL DEFAULT 'user'
CHECK (role IN ('user','admin'))
created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()

tasks

id SERIAL PRIMARY KEY
user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE
title TEXT NOT NULL
completed BOOLEAN NOT NULL DEFAULT false
created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()

applications

id SERIAL PRIMARY KEY
user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE
company TEXT NOT NULL
job_title TEXT NOT NULL
status TEXT NOT NULL
CHECK (status IN ('saved','applied','interviewing','offer','rejected','withdrawn'))
job_url TEXT
location TEXT
notes TEXT
applied_at TIMESTAMPTZ
created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()

---

## Running Locally

From the project root:

1. Create a local environment file for the backend:

      cp backend/.env.example backend/.env

2. Start the services:

docker compose up --build

The API will be available at:

http://localhost:4000

Health check endpoint:

GET http://localhost:4000/health

Example backend environment variables:

```env
DB_HOST=localhost
DB_PORT=5432
DB_USER=app
DB_PASSWORD=app
DB_NAME=app
JWT_SECRET=dev-secret
PORT=4000
```

For Docker Compose, the database connection values are supplied by `docker-compose.yml`, and `backend/.env` is primarily used to provide backend configuration such as `JWT_SECRET` when running outside Docker.

---

## Seed Script

Development users can be created from the backend directory:

npm run seed

Default accounts:

Admin user

admin@example.com
AdminPass123!

Standard user

user@example.com
UserPass123!

These accounts allow testing authenticated and admin routes.

---

## API Routes

Public routes

GET /health

Returns service health status.

POST /auth/register

Creates a new user account.

POST /auth/login

Authenticates a user and returns a JWT token.

---

Authenticated routes

Require header:

Authorization: Bearer <token>

GET /auth/me

Returns authenticated user information.

---

Tasks

GET /tasks

Returns all tasks for the authenticated user.

POST /tasks

Creates a task.

PATCH /tasks/:id

Updates a task title and/or completion state.

DELETE /tasks/:id

Deletes a task.

---

Job Applications

GET /applications

Returns all applications for the authenticated user.

GET /applications/:id

Returns a specific application.

POST /applications

Creates a new job application.

PATCH /applications/:id

Updates fields on an application.

DELETE /applications/:id

Deletes an application.

---

Admin Routes

Accessible only to users with role = admin.

Example:

GET /admin/users

Returns a list of users.

---

## Running Tests

From the backend directory:

npm test

Tests cover:

- Health endpoint
- Authentication flow
- Task CRUD routes
- Application CRUD routes
- Authorization checks
- Admin route protection

Tests use a mocked database layer for fast and deterministic execution.

---

## Continuous Integration

GitHub Actions runs automatically on:

- push to main
- pull requests affecting backend code

The pipeline performs:

1. Install dependencies
2. TypeScript build
3. Jest test execution

If build or tests fail the pipeline fails.

Workflow file:

.github/workflows/backend-ci.yml

---

## Development Roadmap

Upcoming phases:

- Input validation layer
- Pagination and filtering
- React frontend
- AWS EC2 + RDS deployment
- Production environment configuration
