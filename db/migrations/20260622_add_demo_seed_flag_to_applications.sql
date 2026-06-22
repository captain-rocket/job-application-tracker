ALTER TABLE applications
  ADD COLUMN IF NOT EXISTS is_demo_seed BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_applications_demo_cleanup
  ON applications (user_id, is_demo_seed, created_at);
