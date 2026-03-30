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
- GitHub Actions CI/CD

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
- CI/CD pipeline via GitHub Actions

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
└── README.md
```

---

## Database Schema

The database is initialized automatically via:

`db/init.sql`

Current tables:

### users

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW ()
);
```

### tasks

```sql
CREATE TABLE tasks (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  completed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW ()
);
```

### applications

```sql
CREATE TABLE applications (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  company TEXT NOT NULL,
  job_title TEXT NOT NULL,

  status TEXT NOT NULL DEFAULT 'saved'
  CHECK (status IN (
  'applied',
  'interviewing',
  'saved',
  'offer',
  'rejected',
  'withdrawn'
  )),

  job_url TEXT,
  location TEXT,
  notes TEXT,

  applied_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW (),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW ()
);
```

---

## Running Locally

From the project root:

1. Create a local environment file for the backend:

```bash
cp backend/.env.example backend/.env
```

1. Start the services:

```bash
docker compose up --build
```

The API will be available at:

<http://localhost:4000>

Health check endpoint:

GET <http://localhost:4000/health>

Example backend environment variables:

```env
NODE_ENV=development

DB_HOST=localhost
DB_PORT=5432
DB_USER=app
DB_PASSWORD=app
DB_NAME=app
DB_SSL=false
DB_SSL_REJECT_UNAUTHORIZED=true

JWT_SECRET=dev-secret

PORT=4000
```

Note: In production, `JWT_SECRET` must be at least 32 characters and must not use weak/default values.

For Docker Compose, the database connection values are supplied by `docker-compose.yml`, and `backend/.env` is primarily used to provide backend configuration such as `JWT_SECRET` when running outside Docker.

---

## Deployment

This backend is designed to run as a Docker container on AWS EC2, with PostgreSQL on AWS RDS.

### Build

From repo root:

```bash
docker build -t job-tracker-api ./backend
```

### Run

```bash
docker run -d \
   -p 4000:4000 \
   --env-file ./backend/.env \
   --restart unless-stopped \
   --name job-tracker-api \
   job-tracker-api
```

### Configuration

See:

- `backend/.env.example` for required environment variables
- `backend/DEPLOYMENT.md` for full deployment instructions
- In production, `JWT_SECRET` must be at least 32 characters and not be a weak/default secret.

### Notes

- Production uses external PostgreSQL (RDS)
- Docker Compose is not used in production
- Secrets must be provided via environment variables

---

## Seed Script

Development users can be created from the backend directory:

```bash
npm run seed
```

Default accounts:

Admin user

<admin@example.com>
AdminPass123!

Standard user

<user@example.com>
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

```bash
npm test
```

Tests cover:

- Health endpoint
- Authentication flow
- Task CRUD routes
- Application CRUD routes
- Authorization checks
- Admin route protection

Tests use a mocked database layer for fast and deterministic execution.

---

## Continuous Integration / Deployment

GitHub Actions runs the backend workflow on:

- push to `main`
- pull requests affecting backend code
- manual `workflow_dispatch` runs from the Actions tab

The workflow performs:

1. Install dependencies
2. TypeScript build
3. Jest test execution
4. Deploy the backend to EC2 only for successful `main` branch runs

Deployment uses the existing EC2 + Docker + RDS setup:

- Backend only
- SSH from GitHub Actions to EC2
- `git pull` on the server
- Docker rebuild + container restart on EC2
- Application environment variables stay in `backend/.env` on the server

If build or tests fail, deployment does not run

Workflow file:

`.github/workflows/backend-ci.yml`

Additional production setup details, required GitHub secrets, and server prerequisites are documented in `backend/DEPLOYMENT.md`.

---

## Development Roadmap

Completed recently:

- AWS EC2 + RDS deployment
- Production environment configuration
- Live backend health check validation on AWS

Upcoming phases:

- Input validation layer
- Pagination and filtering
- React frontend
