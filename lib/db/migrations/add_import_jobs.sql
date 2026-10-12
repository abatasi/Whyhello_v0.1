-- Persist per-user CSV import history and bounded row-level error details.
CREATE TABLE IF NOT EXISTS import_jobs (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  table_key VARCHAR(64) NOT NULL,
  table_label VARCHAR(120) NOT NULL,
  filename VARCHAR(300) NOT NULL,
  status VARCHAR(20) NOT NULL,
  total_rows INTEGER NOT NULL DEFAULT 0,
  inserted INTEGER NOT NULL DEFAULT 0,
  skipped INTEGER NOT NULL DEFAULT 0,
  error_count INTEGER NOT NULL DEFAULT 0,
  errors JSONB NOT NULL DEFAULT '[]'::jsonb,
  errors_truncated BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS import_jobs_user_created_idx
  ON import_jobs (user_id, created_at);
