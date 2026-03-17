# Backend Deployment Plan

## Target Environment

- AWS EC2 (Linux)
- Docker runtime
- PostgreSQL via AWS RDS

## Build

From the repository root:

```bash
docker build -t job-tracker-api ./backend
```

Or from the `backend/` directory:

```bash
npm run docker:build
```

## Run

```bash
docker run -d \
  -p 4000:4000 \
  --env-file ./backend/.env \
  --name job-tracker-api \
  job-tracker-api
```

## Required Environment Variables

```env
NODE_ENV=production
DB_HOST=
DB_PORT=5432
DB_USER=
DB_PASSWORD=
DB_NAME=
DB_SSL=true
DB_SSL_REJECT_UNAUTHORIZED=true
JWT_SECRET=<at-least-32-character-secret>
PORT=4000
```

## Notes

Database is external (RDS), not a container
Container must not rely on docker-compose in production
Secrets must not be hardcoded
