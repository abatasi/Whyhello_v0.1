-- Migration: contact_meta_scores
-- Stores one aggregate (meta) relevance score per contact.
-- Upserted automatically after each /relevance/score run.

CREATE TABLE IF NOT EXISTS contact_meta_scores (
  id             SERIAL PRIMARY KEY,
  contact_id     INTEGER NOT NULL UNIQUE REFERENCES contacts(id),
  meta_score     INTEGER NOT NULL,        -- 0-100 aggregate
  personal_best  INTEGER NOT NULL,        -- best Personal signal score (0 if none)
  company_best   INTEGER NOT NULL,        -- best Company signal score (0 if none)
  industry_best  INTEGER NOT NULL,        -- best Industry signal score (0 if none)
  role_best      INTEGER NOT NULL,        -- best Role signal score (0 if none)
  signal_count   INTEGER NOT NULL,        -- total scored signals (all types)
  computed_at    TIMESTAMP NOT NULL DEFAULT NOW()
);
