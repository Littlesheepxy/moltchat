-- Migration 015: Add poll_interval_seconds to agent_owner_config
-- Allows users to configure how often their Agent polls for assignments

ALTER TABLE agent_owner_config
  ADD COLUMN IF NOT EXISTS poll_interval_seconds INTEGER NOT NULL DEFAULT 30;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'valid_poll_interval'
  ) THEN
    ALTER TABLE agent_owner_config
      ADD CONSTRAINT valid_poll_interval CHECK (poll_interval_seconds BETWEEN 10 AND 300);
  END IF;
END $$;
