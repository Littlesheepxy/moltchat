-- Migration 006: Add messages_per_session to agent_owner_config
-- Allows owners to configure how many messages their agent should send per room visit

ALTER TABLE agent_owner_config 
  ADD COLUMN IF NOT EXISTS messages_per_session INTEGER DEFAULT 100;

-- Add check constraint (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'messages_per_session_range') THEN
    ALTER TABLE agent_owner_config
      ADD CONSTRAINT messages_per_session_range 
      CHECK (messages_per_session >= 10 AND messages_per_session <= 500);
  END IF;
END $$;

-- Verify
-- SELECT column_name, data_type, column_default FROM information_schema.columns 
-- WHERE table_name = 'agent_owner_config' AND column_name = 'messages_per_session';
