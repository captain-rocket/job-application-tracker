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

High-level tree of the main project files:

```text
job-application-tracker/
├── .github/
│   └── workflows/
│       └── backend-ci.yml
├── backend/
│   ├── src/
│   │   ├── __test__/
│   │   │   ├── admin.test.ts
│   │   │   ├── applications.test.ts
│   │   │   ├── auth.test.ts
│   │   │   ├── db.test.ts
│   │   │   ├── env.test.ts
│   │   │   ├── setupEnv.ts
│   │   │   ├── tasks.test.ts
│   │   │   ├── testUtils.ts
│   │   │   └── tsconfig.json
│   │   ├── config/
│   │   │   ├── db.ts
│   │   │   └── env.ts
│   │   ├── middleware/
│   │   │   ├── errorHandler.ts
│   │   │   ├── index.ts
│   │   │   ├── requireAuth.ts
│   │   │   ├── requireRole.ts
│   │   │   └── validate.ts
│   │   ├── routes/
│   │   │   ├── admin.routes.ts
│   │   │   ├── applications.routes.ts
│   │   │   ├── auth.routes.ts
│   │   │   ├── health.routes.ts
│   │   │   ├── index.ts
│   │   │   └── tasks.routes.ts
│   │   ├── schemas/
│   │   │   ├── applications.schemas.ts
│   │   │   ├── auth.schemas.ts
│   │   │   └── task.schemas.ts
│   │   ├── scripts/
│   │   │   └── seed.ts
│   │   ├── types/
│   │   │   └── express.d.ts
│   │   ├── utils/
│   │   │   └── helpers.ts
│   │   ├── app.ts
│   │   └── server.ts
│   ├── .env.example
│   ├── .env.homelab.example
│   ├── DEPLOYMENT.md
│   ├── Dockerfile
│   ├── jest.config.js
│   ├── package.json
│   ├── tsconfig.json
│   └── tsconfig.test.json
├── db/
│   ├── init.homelab.sql
│   ├── init.sql
│   └── preflight.homelab.sh
├── docker-compose.homelab.yml
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

The Compose stack waits for PostgreSQL to report healthy before the API container starts, so the API's startup database probe does not race initial database boot.

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

## Deployment Targets

### AWS deployment

The production AWS deployment path remains:

- API container on EC2
- PostgreSQL on AWS RDS
- GitHub Actions manual deploy to EC2

See `backend/DEPLOYMENT.md` for the full AWS deployment instructions.

### Home lab deployment

An additional self-hosted deployment target is available for a single VM using Docker Compose:

- API container on the VM
- PostgreSQL container on the same VM
- Persistent PostgreSQL volume
- API exposed on port 4000
- First boot initializes schema only, with no demo accounts or seed data

Setup from the repository root:

```bash
cp backend/.env.homelab.example backend/.env.homelab
```

Update `backend/.env.homelab` with a strong `JWT_SECRET` and real database credentials before starting the stack. `DB_USER` and `DB_PASSWORD` are for the lower-privilege application role that the init script creates on first boot, while `POSTGRES_USER` and `POSTGRES_PASSWORD` are for the bootstrap admin account used by the Postgres container. `DB_USER` must differ from `POSTGRES_USER`.

The example `JWT_SECRET=change-me`, `DB_PASSWORD=change-this-db-password`, and `POSTGRES_PASSWORD=change-this-db-password` values are intentionally invalid and must be replaced before the first boot.

The application uses `DB_USER` and `DB_PASSWORD` at runtime. The Postgres container uses `POSTGRES_USER` and `POSTGRES_PASSWORD` during initialization, and it also reads `DB_USER` and `DB_PASSWORD` once to create the app role. Changing any of those values later does not update an already-initialized volume automatically.

The Postgres container now fails before volume initialization if `DB_PASSWORD` or `POSTGRES_PASSWORD` still use a shipped placeholder, or if `DB_USER` matches `POSTGRES_USER`.

The homelab `docker compose` commands below use `--env-file backend/.env.homelab` so Compose can interpolate values from that file across `docker-compose.homelab.yml`. What each container actually receives is still controlled by its explicit `environment:` block: the `db` service gets the init credentials it needs, and the `api` service gets only its runtime app settings.

```bash
docker compose --env-file backend/.env.homelab -f docker-compose.homelab.yml up -d --build
```

Verify:

```bash
curl http://localhost:4000/health
docker compose --env-file backend/.env.homelab -f docker-compose.homelab.yml ps
docker compose --env-file backend/.env.homelab -f docker-compose.homelab.yml exec db sh -c 'pg_isready -h 127.0.0.1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
```

Fresh home lab installs do not create an admin user automatically. See `backend/DEPLOYMENT.md` for the one-time admin bootstrap step after registering your first account.

See `backend/DEPLOYMENT.md` for the exact home lab deployment and verification commands.

---

## AWS Deployment

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

Returns paginated applications for the authenticated user. Supports optional `status`, `page`, and `limit` query params and includes pagination metadata in the response.

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

- push to `main` when backend code or `.github/workflows/backend-ci.yml` changes
- pull requests affecting backend code or `.github/workflows/backend-ci.yml`
- manual `workflow_dispatch` runs from the Actions tab

The workflow performs:

1. Install dependencies
2. TypeScript build
3. Jest test execution
4. Deploy the backend to EC2 only for manual `workflow_dispatch` runs after CI succeeds

Deployment uses the existing EC2 + Docker + RDS setup:

- Backend only
- SSH from GitHub Actions to EC2
- Runs `git fetch origin main`, `git checkout main` and `git pull --ff-only origin main`
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

- React frontend
