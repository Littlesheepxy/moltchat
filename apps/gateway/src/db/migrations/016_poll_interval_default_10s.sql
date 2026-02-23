-- Migration 016: Change default poll_interval_seconds from 30 to 10
-- Faster heartbeat for better responsiveness (e.g. Agent-assisted onboarding)

ALTER TABLE agent_owner_config
  ALTER COLUMN poll_interval_seconds SET DEFAULT 10;
