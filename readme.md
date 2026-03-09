# Job Application Tracker

Full-stack job application tracking system built with:

- React (frontend – upcoming)
- Node.js + Express (TypeScript)
- PostgreSQL
- Docker Compose
- Jest + Supertest (API testing)

The application runs in a containerized local development environment using Docker Compose, with a PostgreSQL database and an Express API implementing full CRUD functionality.

AWS deployment will be introduced in a later phase.

---

## Architecture Overview

Local development runs entirely in Docker:

Frontend (planned)
        ↓
Backend API (Express + TypeScript)
        ↓
PostgreSQL Database

Current implementation includes:

- Dockerized PostgreSQL container
- Dockerized Node/Express API
- One relational table (`tasks`)
- Full CRUD routes
- Jest route tests

---

## Project Structure

    job-application-tracker/
      backend/
        src/
          app.ts
          server.ts
          __tests__/
        Dockerfile
        package.json
      db/
        init.sql
      docker-compose.yml
      .gitignore

---

## Database Schema

Current table:

`tasks`

- id (SERIAL PRIMARY KEY)
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

Health check:  
http://localhost:4000/health

Get tasks:  
http://localhost:4000/tasks

---

## API Routes

### Public Routes

GET `/health`  
Returns service status.

GET `/tasks`  
Returns all tasks.

POST `/tasks`  
Creates a new task.

PATCH `/tasks/:id`  
Updates task title and/or completion state.

DELETE `/tasks/:id`  
Deletes a task.

---


## Running Tests

From the backend directory:

    npm test

Tests cover:

- Health route
- Task retrieval
- Task creation
- Task update behavior

Tests use a mocked database layer for fast, deterministic execution.

---

## Development Roadmap

Planned next phases:

- JWT authentication
- Role-based access
- React frontend integration
- Pagination and filtering
- CI pipeline (GitHub Actions)
- AWS EC2 + RDS deployment
- Production environment configuration