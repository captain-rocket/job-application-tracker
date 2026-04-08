\set ON_ERROR_STOP on
\getenv app_user DB_USER
\getenv app_password DB_PASSWORD
\getenv bootstrap_user POSTGRES_USER

SELECT CASE
  WHEN :'app_user' = :'bootstrap_user' THEN 'true'
  ELSE 'false'
END AS app_user_matches_bootstrap_user
\gset

\if :app_user_matches_bootstrap_user
  \echo 'DB_USER must differ from POSTGRES_USER in the homelab deployment'
  \quit 1
\endif

SELECT format(
  'CREATE ROLE %I LOGIN PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE INHERIT',
  :'app_user',
  :'app_password'
)
WHERE NOT EXISTS (
  SELECT 1
  FROM pg_roles
  WHERE rolname = :'app_user'
)\gexec

SELECT format(
  'ALTER ROLE %I WITH LOGIN PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE INHERIT',
  :'app_user',
  :'app_password'
)\gexec

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW ()
);

CREATE TABLE tasks (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  completed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW ()
);

CREATE INDEX idx_tasks_user_id ON tasks (user_id);
CREATE INDEX idx_tasks_user_id_created_at ON tasks (user_id, created_at DESC);

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

CREATE INDEX idx_applications_user_id_created_at ON applications (user_id, created_at DESC);
CREATE INDEX idx_applications_user_id_status ON applications (user_id, status);

SELECT format('GRANT CONNECT ON DATABASE %I TO %I', current_database(), :'app_user')\gexec
SELECT format('GRANT USAGE ON SCHEMA public TO %I', :'app_user')\gexec
SELECT format(
  'GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO %I',
  :'app_user'
)\gexec
SELECT format(
  'GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO %I',
  :'app_user'
)\gexec
SELECT format(
  'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO %I',
  :'app_user'
)\gexec
SELECT format(
  'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO %I',
  :'app_user'
)\gexec
