# Job Application Tracker

A full-stack job application tracker with a deployed backend API, local React frontend, and home lab same-origin frontend deployment path.

Current status:

- Backend API is deployed on AWS EC2 with PostgreSQL on AWS RDS
- Backend can also run on a home lab VM with Docker Compose
- Frontend exists in `frontend/` and currently runs locally with Vite
- Home lab production serves the React build through Caddy with same-origin `/api` routing

Backend stack:

- Node.js + Express + TypeScript: typed REST API with small, conventional middleware and route layers
- PostgreSQL: relational storage for users, tasks and job applications
- Docker + Docker Compose: reproducible local environment and containerized runtime
- JWT authentication, RBAC and Zod route-boundary validation
- Jest + Supertest: API-level regression tests for auth, authorization, and CRUD flows
- GitHub Actions: CI on backend changes plus a manual production deployment workflow

Frontend stack:

- React + TypeScript
- Vite
- React Router
- Native `fetch`
- Vitest + React Testing Library + jsdom

Implemented features:

- Login and JWT-backed session storage
- Auth hydration from `localStorage`
- Protected `/applications` frontend route
- Application list, create, edit, delete and logout flows in the frontend
- Backend validation, authentication and admin-only RBAC route protection
- Backend and frontend automated tests

---

## Architecture Overview

The backend exposes authenticated REST routes for users, tasks and job applications. The React frontend consumes those routes through a same-origin `/api` prefix in local development and the home lab deployment.

```text
Frontend (React + TypeScript + Vite/Caddy)
        ↓ /api/*
Same-origin proxy (Vite dev server or Caddy)
        ↓ strips /api
Backend API (Express + TypeScript)
        ↓
PostgreSQL Database
Request flow:
Client
  |
  v
Express API (:4000)
  |- express.json()
  |- JWT auth / RBAC middleware
  |- Zod validation middleware
  |- Router handlers
  v
PostgreSQL
```

```text
Deployment Model
Local development
Client/browser
  |
  v
Vite dev server (:5173, outside Docker)
  |- serves React frontend
  |- proxies /api/* to Express after stripping /api
  v
Docker Compose
  | - api container (Node.js + Express)
  | - db container (PostgreSQL)

Production (home lab)
Internet
  |
  v
pfSense WAN 80/443
  |
  v
Home lab reverse proxy VM (Traefik)
  |
  v
http://192.168.91.12:8080
  |
  v
Job tracker app VM Docker Compose stack
  |- Caddy web container
  |  |- serves React static build
  |  \- proxies /api/* to api:4000 after stripping /api
  |- api container (Node.js + Express, internal port 4000)
  \- db container (PostgreSQL, internal only)

Production (AWS backend-only path)
Client
  |
  v
EC2 instance
  \- Docker container (Node.js Express API)
      |
      v
AWS RDS PostgreSQL (private)
```

Home lab production terminates public traffic at the reverse proxy VM, then forwards to the app VM Caddy upstream at `http://192.168.91.12:8080`. Browser routes such as `/`, `/login`, and `/applications` return the React app, while `/api/*` is proxied to Express after the `/api` prefix is stripped.

In local development, the frontend also calls `/api/*`. Vite proxies those requests to `http://localhost:4000` after stripping `/api`, so Express route mounting stays unchanged.

## Request Lifecycle

1. Incoming JSON is parsed by Express.
2. Protected routes use `requireAuth`; admin-only routes add `requireRole("admin")`.
3. Route-boundary Zod schemas validate `body`, `params`, and `query` before handler logic runs.
4. Route handlers execute parameterized queries through the shared PostgreSQL pool.
5. The centralized error handler turns validation failures, malformed JSON, and unexpected errors into consistent API responses.

On startup, the server validates required environment variables and verifies database connectivity before it starts listening for requests.

---

## Project Structure

High-level tree of the main project files:

```text
job-application-tracker/
├── .github/
│   └── workflows/
│       └── backend-ci.yml
├── backend
│   ├── DEPLOYMENT.md
│   ├── Dockerfile
│   ├── eslint.config.js
│   ├── jest.config.js
│   ├── package-lock.json
│   ├── package.json
│   ├── src
│   │   ├── __test__
│   │   ├── app.ts
│   │   ├── config
│   │   ├── middleware
│   │   ├── routes
│   │   ├── schemas
│   │   ├── scripts
│   │   ├── server.ts
│   │   ├── types
│   │   └── utils
│   ├── tsconfig.json
│   └── tsconfig.test.json
├── db
│   ├── init.homelab.sql
│   ├── init.sql
│   └── preflight.homelab.sh
├── deployment
│   └── Caddyfile.homelab
├── docker-compose.homelab.yml
├── docker-compose.yml
├── frontend
│   ├── Dockerfile.homelab
│   ├── index.html
│   ├── package-lock.json
│   ├── package.json
│   ├── src
│   │   ├── __test__
│   │   ├── api
│   │   ├── App.tsx
│   │   ├── auth
│   │   ├── main.tsx
│   │   ├── pages
│   │   ├── styles.css
│   │   ├── types
│   │   └── utils
│   ├── tsconfig.json
│   └── vite.config.ts
└── README.md
```

---

## Database Schema

The database is initialized automatically via:

`db/init.sql`

Core tables:

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

PostgreSQL runs through Docker Compose. For day-to-day development, run the backend and frontend outside Docker so TypeScript changes reload quickly.

### Backend API and PostgreSQL

From the project root:

1. Create a local environment file for the backend:

```bash
cp backend/.env.example backend/.env
```

2. Start PostgreSQL:

```bash
docker compose up -d db
```

3. Seed local users and start the backend API:

```bash
cd backend
npm run seed
npm run dev
```

The API will be available at:

<http://localhost:4000>

Health check endpoint:

GET <http://localhost:4000/health>

For a full Docker smoke test of the local API and database, run this from the project root:

```bash
docker compose up --build
```

The Compose stack waits for PostgreSQL to report healthy before the API container starts, so the API's startup database probe does not race initial database boot.

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

PUBLIC_REGISTRATION_ENABLED=true
PUBLIC_DEMO_USER_EMAIL=
```

Note: In production, `JWT_SECRET` must be at least 32 characters and must not use weak/default values.

For Docker Compose, the API container database connection values are supplied by `docker-compose.yml`. Keep `DB_HOST=localhost` in `backend/.env` so host-run commands such as `npm run dev` and `npm run seed` can connect to the Compose database through the published local port.

---

### Frontend

From the project root:

```bash
cd frontend
npm install
npm run dev
```

The Vite development server will be available at:

<http://localhost:5173>

Useful front end commands from `frontend/`

```bash
npm run build
npm test
```

The frontend calls `/api/*` routes. During local development, `frontend/vite.config.ts` proxies `/api/*` to `http://localhost:4000` after stripping the `/api` prefix.

---

## Deployment Targets

### AWS deployment

The backend production AWS deployment path is implemented:

- API container on EC2
- PostgreSQL on AWS RDS
- GitHub Actions manual deploy to EC2

The AWS frontend deployment path is not implemented yet; the home lab target below serves the frontend through Caddy.

See `backend/DEPLOYMENT.md` for the full AWS deployment instructions.

### Home lab deployment

An additional self-hosted deployment target is available for the home lab app VM using Docker Compose and Caddy behind the home lab reverse proxy:

- Caddy web container serving the React static build
- `/api/*` reverse proxy to the internal API after stripping `/api`
- API container on the VM, exposed only to the Compose network
- PostgreSQL container on the same VM, kept internal to the Compose network
- Persistent PostgreSQL and Caddy data volumes
- Public traffic for `portfolio.fromstudiob.com` terminates at the Traefik reverse proxy VM
- Reverse proxy upstream: `http://192.168.91.12:8080`
- First boot initializes schema only, with no demo accounts or seed data

Setup from the repository root:

```bash
cp backend/.env.homelab.example backend/.env.homelab
```

Update `backend/.env.homelab` with a strong `JWT_SECRET` and real database credentials before starting the stack. `DB_USER` and `DB_PASSWORD` are for the lower-privilege application role that the init script creates on first boot, while `POSTGRES_USER` and `POSTGRES_PASSWORD` are for the bootstrap admin account used by the Postgres container. `DB_USER` must differ from `POSTGRES_USER`.

The example `JWT_SECRET=change-me`, `DB_PASSWORD=change-this-db-password`, and `POSTGRES_PASSWORD=change-this-db-password` values are intentionally invalid and must be replaced before the first boot.

The application uses `DB_USER` and `DB_PASSWORD` at runtime. The Postgres container uses `POSTGRES_USER` and `POSTGRES_PASSWORD` during initialization, and it also reads `DB_USER` and `DB_PASSWORD` once to create the app role. Changing any of those values later does not update an already-initialized volume automatically.

The Postgres container now fails before volume initialization if `DB_PASSWORD` or `POSTGRES_PASSWORD` still use a shipped placeholder, or if `DB_USER` matches `POSTGRES_USER`.

Do not set `APP_HOST` in `backend/.env.homelab` for the home lab deployment. The reverse proxy owns the public hostname and TLS; the app VM exposes Caddy as an internal HTTP upstream on `192.168.91.12:8080`. Caddy still serves the React frontend, strips `/api`, proxies internally to `api:4000`, and leaves the API and PostgreSQL services unexposed to the host network.

The homelab `docker compose` commands below use `--env-file backend/.env.homelab` so Compose can interpolate values from that file across `docker-compose.homelab.yml`. What each container actually receives is still controlled by its explicit `environment:` block: the `db` service gets the init credentials it needs, and the `api` service gets only its runtime app settings.

```bash
docker compose --env-file backend/.env.homelab -f docker-compose.homelab.yml up -d --build
```

Verify:

```bash
curl -i http://192.168.91.12:8080/api/health
docker compose --env-file backend/.env.homelab -f docker-compose.homelab.yml ps
docker compose --env-file backend/.env.homelab -f docker-compose.homelab.yml exec db sh -c 'pg_isready -h 127.0.0.1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
```

Fresh home lab installs do not create an admin user automatically. See `backend/DEPLOYMENT.md` for the one-time admin bootstrap step after registering your first account.

See `backend/DEPLOYMENT.md` for the exact home lab deployment and verification commands.

---

## AWS Deployment

The backend runs as a Docker container on AWS EC2, with PostgreSQL on AWS RDS.

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
- AWS frontend production hosting is not yet configured.

---

## Seed Script

Development users can be created after PostgreSQL is running. From the project root:

```bash
docker compose up -d db
cd backend
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

The standard user also gets 3 deterministic application rows for local frontend verification.
Rerunning the seed script refreshes those rows without changing the seeded credentials.

---

## API Routes

Backend routes are mounted without an `/api` prefix. In the homelab same-origin deployment, browser requests use `/api/*`, and Caddy strips `/api` before forwarding to Express.

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

## Security and Authentication

- Passwords are hashed with `bcryptjs` before they are stored
- `/auth/register` and `/auth/login` issue JWTs, and protected routes require `Authorization: Bearer <token>`
- `requireAuth` verifies the token and attaches authenticated user id and role to the request
- `requireRole("admin")` protects the admin route boundary
- Zod validation is applied at the route boundaries for request bodies, route params, and query params
- The frontend stores the JWT in `localStorage` and hydrates the session on page load
- The `/applications` frontend route is protected by client-side auth state
- Production configuration is environment-driven, and startup rejects weak/default JWT secrets and placeholder production database passwords
- Public homelab deployment disables open registration, supports a configured demo user, limits auth attempts, and caps demo-account application growth.

---

## Running Tests

Backend tests use Jest and SuperTest. From the backend directory:

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

Tests use a mocked database layer for fast and deterministic execution. Coverage reporting is available with `npm run test:coverage`.

Frontend tests use Vitest, React Testing Library and jsdom. From the frontend directory:

```bash
npm test
```

Current frontend coverage focuses on the applications CRUD page behavior, including update and delete flows.

---

## Continuous Integration / Deployment

The backend workflow is intentionally split into CI and manual deployment.


CI runs on:

- push to `main` when backend code or `.github/workflows/backend-ci.yml` changes
- pull requests affecting backend code or `.github/workflows/backend-ci.yml`
- manual `workflow_dispatch` runs when a human wants a deployable build and deploy run

CI steps:

1. Install dependencies with `npm ci`
2. Build the backend with `npm run build`
3. Run the test suite with `npm test`

Manual production deployment

- Runs only for `workflow_dispatch` after the CI job succeeds
- Does not auto-deploy on push or pull request events
- SSHs from GitHub Actions to EC2
- Updates the EC2 checkout to `origin/main`
- Rebuilds the backend to Docker image on the instance
- Replaces the running job-tracker-api container
- Verifies `http://localhost:4000/health` on instance
- Leaves production environment variables in the `backend/.env` on the server

Workflow file:

`.github/workflows/backend-ci.yml`

Additional production setup details, required GitHub secrets, and server prerequisites are documented in `backend/DEPLOYMENT.md`.

The frontend currently has local build and test scripts plus a home lab Caddy deployment path, but it is not part of the AWS production deployment path yet.

---

## Production Discipline

Intentionally focused, with emphasis on production-oriented backend practices:

- route-boundary validation with Zod
- JWT authentication plus admin-only role checks
- startup environment validation and database connectivity checks
- automated API tests with coverage reporting
- CI separated from manual production deployment
- environment-based runtime configuration for local and production deployment paths
- same-origin React frontend for authenticated application CRUD
- frontend regression tests for key CRUD interactions

## Development Roadmap

Completed recently:

- Backend API with authentication, authorization, validation, and application CRUD
- AWS EC2 + RDS deployment
- Production environment configuration
- Live backend health check validation on AWS
- Home lab same-origin frontend deployment path

Upcoming phases:

- Frontend polish
- Expanded frontend test coverage
- Pagination and filter UI
