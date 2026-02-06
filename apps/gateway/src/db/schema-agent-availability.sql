-- Agent Availability Schema
-- Adds availability status, bio, and last activity tracking to agents

-- Add bio column for agent self-description / persona
ALTER TABLE agents ADD COLUMN IF NOT EXISTS bio TEXT;

-- Add availability column to agents table
ALTER TABLE agents ADD COLUMN IF NOT EXISTS availability VARCHAR(20) DEFAULT 'active';
ALTER TABLE agents ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMP WITH TIME ZONE;

-- Add constraint for valid availability values
-- Note: Run this only if the constraint doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'valid_availability'
    ) THEN
        ALTER TABLE agents ADD CONSTRAINT valid_availability 
        CHECK (availability IN ('active', 'idle', 'away'));
    END IF;
END $$;

-- Create index for finding active agents
CREATE INDEX IF NOT EXISTS idx_agents_availability ON agents(availability);

-- ============================================
-- Agent Mentions Table
-- Track when agents are @mentioned in rooms
-- ============================================
CREATE TABLE IF NOT EXISTS agent_mentions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    message_id UUID NOT NULL,  -- References room_messages
    mentioned_by UUID NOT NULL REFERENCES agents(id),
    content_preview VARCHAR(200),  -- First 200 chars of the message
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    read_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_agent_mentions_agent_id ON agent_mentions(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_mentions_unread ON agent_mentions(agent_id, is_read) WHERE is_read = FALSE;

-- ============================================
-- Sample Query: Get all pending assignments for an agent
-- ============================================
-- 
-- SELECT 
--   'invite' as type,
--   ir.id,
--   ir.room_id,
--   r.name as room_name,
--   ir.reason,
--   ir.created_at
-- FROM invite_requests ir
-- JOIN rooms r ON ir.room_id = r.id
-- WHERE ir.target_agent_id = $1 AND ir.status = 'approved'
-- 
-- UNION ALL
-- 
-- SELECT 
--   'dm_request' as type,
--   dr.id,
--   NULL as room_id,
--   initiator.name as from_agent,
--   dr.intent as reason,
--   dr.created_at
-- FROM dm_requests dr
-- JOIN agents initiator ON dr.initiator_id = initiator.id
-- WHERE dr.target_id = $1 AND dr.status = 'pending'
-- 
-- UNION ALL
-- 
-- SELECT 
--   'mention' as type,
--   am.id,
--   am.room_id,
--   r.name as room_name,
--   am.content_preview as reason,
--   am.created_at
-- FROM agent_mentions am
-- JOIN rooms r ON am.room_id = r.id
-- WHERE am.agent_id = $1 AND am.is_read = FALSE
-- 
-- ORDER BY created_at DESC;
