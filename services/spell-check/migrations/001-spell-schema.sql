-- Phase 5: Spell-Check Service Database Schema
-- Create tables for local dictionary ownership and identity projections

-- Create spell schema
CREATE SCHEMA IF NOT EXISTS spell;

-- Identity projection table for local user data
CREATE TABLE IF NOT EXISTS spell.identity_projection (
  tenant_id UUID NOT NULL,
  user_id UUID NOT NULL,
  email CITEXT,
  status TEXT NOT NULL CHECK (status IN ('active', 'disabled')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, user_id)
);

-- User dictionary storage with JSONB for efficient querying
CREATE TABLE IF NOT EXISTS spell.user_dict (
  tenant_id UUID NOT NULL,
  user_id UUID NOT NULL,
  words JSONB NOT NULL DEFAULT '[]'::jsonb,  -- Array of custom words
  version INT NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, user_id)
);

-- Event ledger for idempotency
CREATE TABLE IF NOT EXISTS spell.event_ledger (
  event_id UUID PRIMARY KEY,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Outbox table for event emission
CREATE TABLE IF NOT EXISTS spell.outbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL UNIQUE,
  event_type TEXT NOT NULL,
  topic TEXT NOT NULL,
  schema_version INT NOT NULL DEFAULT 1,
  tenant_id UUID NOT NULL,
  aggregate_id UUID NOT NULL,
  aggregate_type TEXT NOT NULL DEFAULT 'user_dict',
  payload JSONB NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ NULL,
  retry_count INT NOT NULL DEFAULT 0,
  max_retries INT NOT NULL DEFAULT 5,
  next_retry_at TIMESTAMPTZ NULL
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_identity_projection_status
  ON spell.identity_projection(status) WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_user_dict_updated_at
  ON spell.user_dict(updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_dict_words_gin
  ON spell.user_dict USING gin(words);

CREATE INDEX IF NOT EXISTS idx_outbox_processed_at
  ON spell.outbox(processed_at) WHERE processed_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_outbox_next_retry_at
  ON spell.outbox(next_retry_at) WHERE next_retry_at IS NOT NULL;

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION spell.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for automatic timestamp updates
DROP TRIGGER IF EXISTS update_identity_projection_updated_at ON spell.identity_projection;
CREATE TRIGGER update_identity_projection_updated_at
  BEFORE UPDATE ON spell.identity_projection
  FOR EACH ROW EXECUTE FUNCTION spell.update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_dict_updated_at ON spell.user_dict;
CREATE TRIGGER update_user_dict_updated_at
  BEFORE UPDATE ON spell.user_dict
  FOR EACH ROW EXECUTE FUNCTION spell.update_updated_at_column();

-- Grant permissions (adjust as needed for production)
-- GRANT USAGE ON SCHEMA spell TO spell_service_user;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA spell TO spell_service_user;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA spell TO spell_service_user;