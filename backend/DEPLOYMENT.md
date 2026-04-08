# Backend Deployment Guide (AWS EC2 + RDS)

## Overview

This backend is deployed on AWS using:

- EC2 for compute
- RDS PostgreSQL for database
- Docker for the application runtime

Deployment model:

- Single EC2 instance
- Single RDS PostgreSQL instance
- Backend is exposed on port 4000
- RDS is private and not publicly accessible

## Note

AWS infrastructure (EC2, RDS, security groups) was provisioned manually via the AWS Console and is not defined as Infrastructure-as-Code in this repository.

___

## Target Environment

### EC2

- OS: Amazon Linux 2023
- Instance type: t3.micro
- Docker installed directly on the instance

### RDS

- Engine: PostgreSQL
- Instance class: db.t3.micro
- Deployment option: Single DB instance
- Public access: No
- Database name: `jobtracker`
- Username: `jobtracker`

___

## Architecture

- EC2 runs the backend Docker container
- RDS PostgreSQL runs as a managed AWS database
- EC2 connects to RDS through AWS-managed VPC security group rules
- API access is allowed through the EC2 security group on port 4000
- During development validation, port 4000 was restricted to the developer IP

___

## Docker Installation on EC2

Connect to EC2 over SSH, then install and enable Docker:

```bash
sudo dnf update -y
sudo dnf install docker -y
sudo systemctl start docker
sudo systemctl enable docker
docker --version
```

___

## Build

From the repository root:

```bash
docker build -t job-tracker-api ./backend
```

Or from the `backend/` directory:

```bash
npm run docker:build
```

___

## Required Environment Variables

Create `backend/.env` on the EC2 instance:

```env
NODE_ENV=production

DB_HOST=<replace-with-rds-endpoint>
DB_PORT=5432
DB_USER=jobtracker
DB_PASSWORD=<replace-with-rds-password>
DB_NAME=jobtracker
DB_SSL=true
DB_SSL_REJECT_UNAUTHORIZED=true

JWT_SECRET=<replace-with-32-character-secret>

PORT=4000
```

### Notes

- `JWT_SECRET` must be at least 32 characters in production
- weak/default secrets are rejected in production
- Database credentials should be stored securely
- For this deployment, the DB password is stored in 1Password

___

## Run

```bash
docker run -d \
  -p 4000:4000 \
  --env-file ./backend/.env \
  --restart unless-stopped \
  --name job-tracker-api \
  job-tracker-api
```

___

## GitHub Actions CD

The backend can also be deployed through GitHub Actions using the existing EC2 host.

Trigger options:

- CI runs on push to `main` when `backend/**` or `.github/workflows/backend-ci.yml` changes
- CI runs on pull requests affected by `backend/**` or `.github/workflows/backend-ci.yml` changes
- Deployment runs only on manual `workflow_dispatch` from the Actions tab

Workflow behavior:

- Runs the backend CI job first
- Deploy job runs only for `workflow_dispatch`
- Connects to EC2 over SSH
- Runs `git fetch origin main`, `git checkout main` and `git pull --ff-only origin main` on the EC2 checkout
- Rebuilds the `job-tracker-api` Docker image
- Replaces the running `job-tracker-api` container
- Verifies `http://localhost:4000/health` on the instance

### Required GitHub configuration

GitHub Actions secrets:

- `EC2_HOST`
- `EC2_USERNAME`
- `EC2_SSH_KEY`
- `EC2_PORT` (optional defaults to 22)

GitHub Actions variable:

`EC2_DEPLOY_PATH` - absolute path to the repository checkout on EC2

### EC2 prerequisites for CD

The EC2 instance must already have:

- Docker installed and running
- This repository cloned at `EC2_DEPLOY_PATH`
- backend/.env created on the server
- The SSH user able to run Docker commands
- Git access configured so `git fetch origin main` and `git pull --ff-only origin main` succeed on the server

Application secrets are not copied from GitHub Actions during deploy. Production environment variables continue to live in backend/.env on EC2.

___

## Home Lab Deployment (Single VM with Docker Compose)

This repository also supports a separate self-hosted deployment target for a single VM.

Deployment model:

- One VM
- One Docker Compose stack
- API container and PostgreSQL container on the same host
- PostgreSQL data stored in a persistent Docker volume
- API exposed on port 4000
- PostgreSQL kept internal to the Compose network
- First boot initializes schema only, with no demo accounts or seed data

This path does not replace the AWS deployment and does not change the existing GitHub Actions flow.

The home lab stack uses `db/init.homelab.sql` for schema-only initialization. The existing `db/init.sql` remains available for local development and seed/demo data.

### Required files

From the repository root:

```bash
cp backend/.env.homelab.example backend/.env.homelab
```

Update `backend/.env.homelab` before starting the stack. `DB_USER` and `DB_PASSWORD` are for the lower-privilege application role that the init script creates on first boot. `POSTGRES_USER` and `POSTGRES_PASSWORD` are for the bootstrap admin account created by the Postgres container. `DB_USER` must differ from `POSTGRES_USER`.

The example `JWT_SECRET=change-me`, `DB_PASSWORD=change-this-db-password`, and `POSTGRES_PASSWORD=change-this-db-password` values are intentionally invalid and must be replaced before the first boot:

```env
NODE_ENV=production

DB_HOST=db
DB_PORT=5432
DB_USER=jobtracker_app
DB_PASSWORD=change-this-db-password
DB_NAME=jobtracker
DB_SSL=false
DB_SSL_REJECT_UNAUTHORIZED=true

POSTGRES_USER=jobtracker_admin
POSTGRES_PASSWORD=change-this-db-password
POSTGRES_DB=jobtracker

JWT_SECRET=change-me

PORT=4000
```

The API uses `DB_USER` and `DB_PASSWORD` at runtime. During the first `docker compose up`, PostgreSQL uses `POSTGRES_USER` and `POSTGRES_PASSWORD` to initialize the database, and it also reads `DB_USER` and `DB_PASSWORD` once to create the lower-privilege application role. Changing any of those values later does not repair an already-initialized volume automatically.

The Postgres container fails before volume initialization if `DB_PASSWORD` or `POSTGRES_PASSWORD` still use a shipped placeholder, or if `DB_USER` matches `POSTGRES_USER`.

The homelab `docker compose` commands below use `--env-file backend/.env.homelab` so Compose can interpolate values from that file across `docker-compose.homelab.yml`. What each container actually receives is still controlled by its explicit `environment:` block: the `db` service gets the init credentials it needs, and the `api` service gets only its runtime app settings.

### Run

From the repository root:

```bash
docker compose --env-file backend/.env.homelab -f docker-compose.homelab.yml up -d --build
```

### Verify

Check container status:

```bash
docker compose --env-file backend/.env.homelab -f docker-compose.homelab.yml ps
```

Check API health from the VM:

```bash
curl http://localhost:4000/health
```

Expected response:

```json
{"status":true}
```

This confirms the API process is running. The API now verifies its `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, and `DB_NAME` settings before it starts listening, so a successful response also means those credentials worked during startup. It does not continuously re-check database connectivity after startup.

Check PostgreSQL readiness from inside the database container:

```bash
docker compose --env-file backend/.env.homelab -f docker-compose.homelab.yml exec db sh -c 'pg_isready -h 127.0.0.1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
```

Expected response:

```text
127.0.0.1:5432 - accepting connections
```

Check recent API logs:

```bash
docker compose --env-file backend/.env.homelab -f docker-compose.homelab.yml logs api --tail 100
```

Check recent PostgreSQL logs:

```bash
docker compose --env-file backend/.env.homelab -f docker-compose.homelab.yml logs db --tail 100
```

### Bootstrap first admin user

Fresh home lab installs start with no users and no admin account. To enable admin routes, first register a normal user through the API:

```bash
curl -X POST http://localhost:4000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"<your-admin-email>","password":"<your-strong-password>"}'
```

Then promote that user to `admin` directly in PostgreSQL:

```bash
docker compose --env-file backend/.env.homelab -f docker-compose.homelab.yml exec db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "UPDATE users SET role = '\''admin'\'' WHERE email = '\''<your-admin-email>'\'';"'
```

After the SQL update, authenticate again to get a new JWT with the `admin` role claim. Tokens issued by `/auth/register` before the promotion still contain the original role and will continue to fail admin authorization checks:

```bash
curl -X POST http://localhost:4000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"<your-admin-email>","password":"<your-strong-password>"}'
```

Verify the promotion:

```bash
docker compose --env-file backend/.env.homelab -f docker-compose.homelab.yml exec db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "SELECT email, role FROM users;"'
```

Confirm PostgreSQL persistence volume:

```bash
docker volume ls | grep homelab-pgdata
```

Stop the stack without removing the database volume:

```bash
docker compose --env-file backend/.env.homelab -f docker-compose.homelab.yml down
```

Restart:

```bash
docker compose --env-file backend/.env.homelab -f docker-compose.homelab.yml up -d
```

Re-check health:

```bash
curl http://localhost:4000/health
```

Re-check PostgreSQL readiness after restart:

```bash
docker compose --env-file backend/.env.homelab -f docker-compose.homelab.yml exec db sh -c 'pg_isready -h 127.0.0.1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
```

The `/health` endpoint confirms the API process is running and that the API successfully opened its configured database connection during startup. The `pg_isready` check only confirms PostgreSQL is reachable inside the database container with `POSTGRES_*`; it does not validate the API's `DB_*` credentials, but it does confirm the database container came back cleanly with the persisted volume attached.

___

## Verify

### From EC2

```bash
curl http://localhost:4000/health
```

Expected response:

```json
{"status":true}
```

### From local machine

```bash
curl http://<ec2-public-ip>:4000/health
```

Expected response:

```json
{"status":true}
```

### Verify container state

```bash
docker ps
docker logs job-tracker-api --tail 100
```

## Database Connectivity Verification

The RDS connection was verified directly from EC2 using `psql`.

Install client:

```bash
sudo dnf install postgresql15 -y
```

Connect:

```bash
psql \
-h <rds-endpoint> \
-U jobtracker \
-d jobtracker \
-p 5432
```

This should open a PostgreSQL prompt:

```text
jobtracker=>
```

___

## Security Notes

### EC2 inbound access

For deployment validation:

- SSH (22) allowed from developer IP
- Custom TCP 4000 allowed from developer IP

### RDS access

- RDS is not publicly accessible
- EC2-to-RDS connection is allowed through AWS-managed security group linkage

___

## Operational Notes

### EC2 public IP changes after stop/start

If the EC2 instance is stopped and started again, the public IPv4 address changes unless an Elastic IP is attached.

That means:

- Old health check URLs may stop working after restart
- The current public IP must be rechecked after instance restart

### RDS stop behavior

RDS can be stopped temporarily, but only for up to 7 days.

Important:

- Stopping RDS pauses DB instance billing
- Storage and backup charges still remain
- After 7 days, AWS automatically starts the DB instance again.

Stopping RDS is a temporary cost control, not a permanent shutdown.

### Snapshot does not remove the 7-day restart behavior

Choosing to save a snapshot while stopping the DB does not make the stop permanent.

For a long-term pause:

1. create a snapshot
2. delete the DB instance

Later, restore from snapshot when needed.

___

## Cost Control Procedure

### Stop EC2

From AWS Console or CLI:

```bash
aws ec2 stop-instances --instance-ids <instance-id>
```

### Start EC2

```bash
aws ec2 start-instances --instance-ids <instance-id>
```

### Stop RDS temporarily

```bash
aws rds stop-db-instance --db-instance-identifier <db-identifier>
```

### Start RDS

```bash
aws rds start-db-instance --db-instance-identifier <db-identifier>
```

### After restart

After stopping and starting both services:

1. Verify RDS status is `Available`
2. Verify EC2 is `Running`
3. Retrieve the current EC2 public IP
4. Rerun health check

___

## Budget Alerts

AWS budget alerts were configured for:

- 25%
- 50%
- 100%

Important:

- Budget alerts notify only
- They do not stop EC2 or RDS automatically

___

## Troubleshooting

### Health check fails externally

Check:

- EC2 is running
- Current public IPv4 address is correct
- Security group still allows port 4000 from your IP
- Container is running

Commands:

```bash
docker ps
docker logs job-tracker-api --tail 100
curl http://localhost:4000/health
```

### Database connection fails

Check:

- RDS status is `Available`
- `.env` values are correct
- EC2-to-RDS security group connection still exists
- DB password is correct

### App does not restart after reboot

Check that the container was run with:

```text
--restart unless-stopped
```

___

## Production Limitations of Current Setup

This deployment is sufficient for roadmap validation, but it is not a full production hardening setup.

Not yet included:

- domain name
- HTTPS / reverse proxy
- Elastic IP
- secret manager integration
- process manager outside Docker
- load balancer
