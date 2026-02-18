-- ============================================
-- Migration 014: Room Auto-Explore
-- ============================================
-- Merge Room + Activity: joining a room = joining the matching pool
-- Rooms auto-explore periodically, feeding the existing exploration_queue
-- ============================================

-- ============================================
-- 1. Rooms: Add explore config columns
-- ============================================
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS explore_enabled BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS explore_rounds INTEGER NOT NULL DEFAULT 10;
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS explore_model VARCHAR(50) NOT NULL DEFAULT 'gpt-4o-mini';
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS explore_interval_minutes INTEGER NOT NULL DEFAULT 60;
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS last_explored_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_rooms_explore
  ON rooms(explore_enabled, last_explored_at)
  WHERE explore_enabled = true AND status = 'active';

-- ============================================
-- 2. owner_profiles: Add looking_for / can_offer
-- ============================================
-- These columns are already referenced by dm-exploration.ts and dm.ts
-- but do not actually exist on the table. Add them now.
ALTER TABLE owner_profiles ADD COLUMN IF NOT EXISTS looking_for TEXT;
ALTER TABLE owner_profiles ADD COLUMN IF NOT EXISTS can_offer TEXT;

-- ============================================
-- 3. ai_explorations: Add room_id, extend source
-- ============================================
ALTER TABLE ai_explorations ADD COLUMN IF NOT EXISTS room_id UUID REFERENCES rooms(id) ON DELETE SET NULL;

-- Extend source constraint to include 'room'
ALTER TABLE ai_explorations DROP CONSTRAINT IF EXISTS ai_explorations_source_check;
ALTER TABLE ai_explorations ADD CONSTRAINT ai_explorations_source_check
  CHECK (source IN ('activity', 'dm', 'room'));

CREATE INDEX IF NOT EXISTS idx_explorations_room
  ON ai_explorations(room_id, status)
  WHERE room_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_explorations_room_pair
  ON ai_explorations(room_id, user_a_id, user_b_id)
  WHERE room_id IS NOT NULL;

-- ============================================
-- 4. agent_notifications: extend type constraint
-- ============================================
ALTER TABLE agent_notifications DROP CONSTRAINT IF EXISTS valid_notification_type;
ALTER TABLE agent_notifications ADD CONSTRAINT valid_notification_type CHECK (
  type IN (
    'dm_request', 'dm_accepted', 'dm_rejected',
    'referral_registered', 'system',
    'exploration_ready',
    'chat_request_from_exploration',
    'dm_prescreening_started',
    'dm_prescreening_complete',
    'room_exploration_complete'
  )
);
