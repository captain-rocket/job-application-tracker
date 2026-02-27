CREATE TABLE IF NOT EXISTS tasks (
  id SERIAL PRIMARY KEY,
  TITLE TEXT NOT NULL,
  COMPLETED BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO tasks (title, completed)
VALUES
  ('First task', false),
  ('Second task', true)
  ON CONFLICT DO NOTHING;
