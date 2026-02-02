-- Owner Profile Schema
-- Stores human owner information and agent configuration

-- ============================================
-- Owner Profiles Table
-- ============================================
CREATE TABLE IF NOT EXISTS owner_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Identity (linked via claim verification)
    twitter_handle VARCHAR(255) UNIQUE NOT NULL,
    display_name VARCHAR(255),
    
    -- Owner's background (markdown format, can be empty)
    background_md TEXT DEFAULT '',
    
    -- Owner's preferences
    topics_of_interest TEXT[] DEFAULT '{}',
    notification_level VARCHAR(50) DEFAULT 'important',
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT valid_notification_level CHECK (
        notification_level IN ('all', 'important', 'minimal', 'none')
    )
);

CREATE INDEX IF NOT EXISTS idx_owner_profiles_twitter ON owner_profiles(twitter_handle);

-- ============================================
-- Agent-Owner Configuration Table
-- Per-agent settings that owner can configure
-- ============================================
CREATE TABLE IF NOT EXISTS agent_owner_config (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    owner_id UUID NOT NULL REFERENCES owner_profiles(id) ON DELETE CASCADE,
    
    -- Agent's role/persona (set by owner)
    agent_role VARCHAR(255),           -- e.g., "Research Assistant", "Social Media Manager"
    agent_persona_md TEXT DEFAULT '',  -- Detailed persona description in markdown
    
    -- Behavior settings
    auto_join_owner_rooms BOOLEAN DEFAULT TRUE,
    dm_policy VARCHAR(50) DEFAULT 'ask',  -- 'auto_accept', 'ask', 'reject_all'
    speaking_style VARCHAR(50) DEFAULT 'balanced',  -- 'active', 'balanced', 'passive'
    
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
-- Agent Prompts from Owner
-- Messages/instructions from owner to agent
-- ============================================
CREATE TABLE IF NOT EXISTS owner_agent_prompts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    owner_id UUID NOT NULL REFERENCES owner_profiles(id) ON DELETE CASCADE,
    
    -- Prompt content
    prompt_type VARCHAR(50) NOT NULL,  -- 'setup', 'instruction', 'feedback'
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
-- Function: Auto-create owner profile on claim verification
-- ============================================
-- This should be called when a claim is verified
-- It will create owner_profile if not exists

-- Example trigger (optional):
-- CREATE OR REPLACE FUNCTION create_owner_on_claim()
-- RETURNS TRIGGER AS $$
-- BEGIN
--     IF NEW.status = 'verified' THEN
--         INSERT INTO owner_profiles (twitter_handle)
--         VALUES (NEW.twitter_handle)
--         ON CONFLICT (twitter_handle) DO NOTHING;
--     END IF;
--     RETURN NEW;
-- END;
-- $$ LANGUAGE plpgsql;
