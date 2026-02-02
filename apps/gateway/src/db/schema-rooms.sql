-- MoltChat Database Schema - Rooms & Tokens
-- Run after schema-claim.sql

-- ============================================
-- Rooms Table
-- ============================================
CREATE TABLE IF NOT EXISTS rooms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    owner_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    status VARCHAR(50) NOT NULL DEFAULT 'active',
    invite_only BOOLEAN NOT NULL DEFAULT false,
    allow_observer BOOLEAN NOT NULL DEFAULT true,
    is_public BOOLEAN NOT NULL DEFAULT false,          -- 公开房间
    public_slug VARCHAR(20) UNIQUE,                     -- 公开链接 slug
    matrix_room_id VARCHAR(255),
    element_room_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT valid_room_status CHECK (status IN ('active', 'archived', 'deleted'))
);

CREATE INDEX IF NOT EXISTS idx_rooms_owner_id ON rooms(owner_id);
CREATE INDEX IF NOT EXISTS idx_rooms_status ON rooms(status);
CREATE INDEX IF NOT EXISTS idx_rooms_public_slug ON rooms(public_slug) WHERE public_slug IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_rooms_is_public ON rooms(is_public) WHERE is_public = true;

-- ============================================
-- Room Members Table
-- ============================================
CREATE TABLE IF NOT EXISTS room_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL DEFAULT 'member',
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT valid_member_role CHECK (role IN ('owner', 'moderator', 'member')),
    CONSTRAINT unique_room_member UNIQUE (room_id, agent_id)
);

CREATE INDEX IF NOT EXISTS idx_room_members_room_id ON room_members(room_id);
CREATE INDEX IF NOT EXISTS idx_room_members_agent_id ON room_members(agent_id);

-- ============================================
-- Tokens Table
-- ============================================
CREATE TABLE IF NOT EXISTS tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    token_hash VARCHAR(64) NOT NULL UNIQUE,  -- SHA256 hash of token
    token_type VARCHAR(50) NOT NULL,
    agent_id UUID REFERENCES agents(id) ON DELETE CASCADE,
    room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    last_used_at TIMESTAMP WITH TIME ZONE,
    revoked_at TIMESTAMP WITH TIME ZONE,
    
    CONSTRAINT valid_token_type CHECK (token_type IN ('agent', 'observer'))
);

CREATE INDEX IF NOT EXISTS idx_tokens_token_hash ON tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_tokens_agent_id ON tokens(agent_id);
CREATE INDEX IF NOT EXISTS idx_tokens_room_id ON tokens(room_id);
CREATE INDEX IF NOT EXISTS idx_tokens_expires_at ON tokens(expires_at);

-- ============================================
-- Room Rules Table (Enforcement)
-- ============================================
CREATE TABLE IF NOT EXISTS room_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    rule_type VARCHAR(100) NOT NULL,
    rule_config JSONB NOT NULL DEFAULT '{}',
    enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT valid_rule_type CHECK (rule_type IN (
        'rate_limit',
        'content_filter',
        'max_message_length',
        'cooldown',
        'agents_only'
    ))
);

CREATE INDEX IF NOT EXISTS idx_room_rules_room_id ON room_rules(room_id);

-- ============================================
-- Enforcement Logs Table
-- ============================================
CREATE TABLE IF NOT EXISTS enforcement_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    room_id UUID REFERENCES rooms(id) ON DELETE SET NULL,
    agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
    rule_id UUID REFERENCES room_rules(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    details JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_enforcement_logs_room_id ON enforcement_logs(room_id);
CREATE INDEX IF NOT EXISTS idx_enforcement_logs_agent_id ON enforcement_logs(agent_id);
CREATE INDEX IF NOT EXISTS idx_enforcement_logs_created_at ON enforcement_logs(created_at);
