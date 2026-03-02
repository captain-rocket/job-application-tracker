CREATE EXTENSION IF NOT EXISTS pgcrypto;

DROP TABLE IF EXISTS tasks;

DROP TABLE IF EXISTS users;

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
  TITLE TEXT NOT NULL,
  COMPLETED BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW ()
);

CREATE INDEX idx_tasks_user_id ON tasks (user_id);

CREATE INDEX idx_task_user_id_create_at ON tasks (user_id, created_at);

INSERT INTO
  users (email, password_hash, role)
VALUES
  ('admin@example.com', 'DUMMY_HASH', 'admin'),
  ('user@example.com', 'DUMMY_HASH', 'user');

INSERT INTO
  tasks (user_id, title, completed)
SELECT
  u.id,
  v.title,
  v.completed
FROM
  users u
  JOIN (
    VALUES
      ('First task', false),
      ('Second task', true)
  ) AS v (title, completed) ON TRUE
WHERE
  u.email = 'user@example.com'
