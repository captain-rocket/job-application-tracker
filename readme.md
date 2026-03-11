# Job Application Tracker

Full-stack job application tracking system built with:

- React (frontend – upcoming)
- Node.js + Express (TypeScript)
- PostgreSQL
- Docker Compose
- Jest + Supertest (API testing)

The application runs in a containerized local development environment using Docker Compose, with a PostgreSQL database and an Express API implementing core backend functionality.

AWS deployment will be introduced in a later phase.

---

## Architecture Overview

Local development runs entirely in Docker:

Frontend (planned)
        ↓
Backend API (Express + TypeScript)
        ↓
PostgreSQL Database

Current backend implementation includes:

- Dockerized PostgreSQL container
- Dockerized Node/Express API
- JWT authentication
- Role-based route protection
- Seed script for development users
- REST API routes
- Jest + Supertest route tests
- CI pipeline via GitHub Actions

---

## Project Structure

    job-application-tracker/
      backend/
        src/
          routes/
            auth.routes.ts
            tasks.routes.ts
            admin.routes.ts
          middleware/
            requireAuth.ts
            errorHandler.ts
          scripts/
            seed.ts
          types/
            express.d.ts
          __test__/
          app.ts
          server.ts
        Dockerfile
        package.json
        tsconfig.json
        jest.config.js
      db/
        init.sql
      docker-compose.yml
      .github/
        workflows/
          backend-ci.yml
      .gitignore

---

## Database Schema

Current tables:

`users`

- id (UUID PRIMARY KEY DEFAULT gen_random_uuid ())
- email TEXT NOT NULL UNIQUE
- password_hash (TEXT NOT NULL)
- role (TEXT NOT NULL DEFAULT 'user'   CHECK (role IN ('user', 'admin')))
- created_at TIMESTAMPTZ NOT NULL DEFAULT NOW ()

`tasks`

- id (SERIAL PRIMARY KEY)
- user_id (UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE)
- title (TEXT NOT NULL)
- completed (BOOLEAN DEFAULT false)
- created_at (TIMESTAMPTZ DEFAULT NOW())

The database is initialized automatically via:

`db/init.sql`

---

## Running Locally

From the project root:

    docker compose up --build

API available at:

Health check  
http://localhost:4000/health

Tasks endpoint  
Note: Requires Authorization: `Bearer <token>`
http://localhost:4000/tasks

---

## Seed Script

Development users can be created from the backend directory:

    npm run seed

Default accounts created:

Admin user

    admin@example.com
    AdminPass123!

Standard user

    user@example.com
    UserPass123!

These accounts allow testing of authenticated and admin-protected routes.

---

## API Routes

### Public Routes

GET `/health`  
Returns service status.

POST `/auth/register`  
Create a new user account.

POST `/auth/login`  
Authenticate and receive a JWT token.

---

### Authenticated Routes

Require `Authorization: Bearer <token>` header.

GET `/tasks`  
Returns tasks.

POST `/tasks`  
Creates a task.

PATCH `/tasks/:id`  
Updates a task.

DELETE `/tasks/:id`  
Deletes a task.

GET `/auth/me`
Returns authenticated user record (id, email, role)

---

### Admin Routes

Accessible only to users with the `admin` role.

Example:

GET `/admin/users`

Returns users list from database.

---

## Running Tests

From the backend directory:

    npm test

Tests cover:

- Health endpoint
- Authentication flow
- Task CRUD routes
- Admin route protection

Tests use a mocked database layer for fast, deterministic execution.

---

## Continuous Integration

A GitHub Actions workflow runs automatically on:

- Push to `main`
- Pull requests affecting the backend

The pipeline performs:

1. Install dependencies
2. TypeScript build
3. Jest test execution

If build or tests fail, the pipeline fails.

Workflow file:

    .github/workflows/backend-ci.yml

---

## Development Roadmap

Planned next phases:

- Job application domain endpoints
- Input validation layer
- Pagination and filtering
- React frontend integration
- AWS EC2 + RDS deployment
- Production environment configuration
