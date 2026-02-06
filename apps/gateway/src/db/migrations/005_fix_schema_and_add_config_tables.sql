-- ============================================
-- Migration 005: Fix owner_profiles schema & create config tables
-- ============================================
-- Issues fixed:
-- 1. owner_profiles missing columns: twitter_handle, topics_of_interest, notification_level
-- 2. agent_owner_config table not created
-- 3. owner_agent_prompts table not created
-- ============================================

-- ============================================
-- 1. Add missing columns to owner_profiles
-- ============================================

ALTER TABLE owner_profiles ADD COLUMN IF NOT EXISTS twitter_handle VARCHAR(255);
ALTER TABLE owner_profiles ADD COLUMN IF NOT EXISTS topics_of_interest TEXT[] DEFAULT '{}';
ALTER TABLE owner_profiles ADD COLUMN IF NOT EXISTS notification_level VARCHAR(50) DEFAULT 'important';

-- Add constraint for notification_level (safe: skip if exists)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'valid_notification_level') THEN
    ALTER TABLE owner_profiles ADD CONSTRAINT valid_notification_level CHECK (
      notification_level IN ('all', 'important', 'minimal', 'none')
    );
  END IF;
END $$;

-- Create index for twitter_handle lookup
CREATE INDEX IF NOT EXISTS idx_owner_profiles_twitter ON owner_profiles(twitter_handle);

-- ============================================
-- 2. Create agent_owner_config table
--    Note: owner_id references owner_profiles(user_id) since
--    the actual PK is user_id, not id
-- ============================================

CREATE TABLE IF NOT EXISTS agent_owner_config (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    owner_id UUID NOT NULL REFERENCES owner_profiles(user_id) ON DELETE CASCADE,
    
    -- Agent's role/persona (set by owner)
    agent_role VARCHAR(255),
    agent_persona_md TEXT DEFAULT '',
    
    -- Behavior settings
    auto_join_owner_rooms BOOLEAN DEFAULT TRUE,
    dm_policy VARCHAR(50) DEFAULT 'ask',
    speaking_style VARCHAR(50) DEFAULT 'balanced',
    
    -- Topics/interests for this agent
    focus_topics TEXT[] DEFAULT '{}',
    avoid_topics TEXT[] DEFAULT '{}',
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(agent_id, owner_id),
    
    CONSTRAINT valid_dm_policy CHECK (dm_policy IN ('auto_accept', 'ask', 'reject_all')),
    CONSTRAINT valid_speaking_style CHECK (speaking_style IN ('active', 'balanced', 'passive'))
);

CREATE INDEX IF NOT EXISTS idx_agent_owner_config_agent ON agent_owner_config(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_owner_config_owner ON agent_owner_config(owner_id);

-- ============================================
-- 3. Create owner_agent_prompts table
-- ============================================

CREATE TABLE IF NOT EXISTS owner_agent_prompts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    owner_id UUID NOT NULL REFERENCES owner_profiles(user_id) ON DELETE CASCADE,
    
    -- Prompt content
    prompt_type VARCHAR(50) NOT NULL,
    content TEXT NOT NULL,
    
    -- Status
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMP WITH TIME ZONE,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT valid_prompt_type CHECK (prompt_type IN ('setup', 'instruction', 'feedback'))
);

CREATE INDEX IF NOT EXISTS idx_owner_prompts_agent ON owner_agent_prompts(agent_id, is_read);

-- ============================================
-- 4. Add update trigger for agent_owner_config
-- ============================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_agent_owner_config_updated_at'
  ) THEN
    CREATE TRIGGER update_agent_owner_config_updated_at
      BEFORE UPDATE ON agent_owner_config
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;
