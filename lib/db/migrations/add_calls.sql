-- Migration: Add calls table for Twilio voice calling feature
CREATE TABLE IF NOT EXISTS calls (
  id SERIAL PRIMARY KEY,
  contact_id INTEGER NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  twilio_call_sid TEXT,
  direction VARCHAR(20) NOT NULL DEFAULT 'outbound',
  status VARCHAR(30) NOT NULL DEFAULT 'initiated',
  call_mode VARCHAR(20) NOT NULL DEFAULT 'browser',
  duration_seconds INTEGER,
  recording_url TEXT,
  recording_sid TEXT,
  transcription TEXT,
  ai_summary TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_calls_contact_id ON calls(contact_id);
CREATE INDEX IF NOT EXISTS idx_calls_user_id ON calls(user_id);
CREATE INDEX IF NOT EXISTS idx_calls_twilio_call_sid ON calls(twilio_call_sid) WHERE twilio_call_sid IS NOT NULL;
