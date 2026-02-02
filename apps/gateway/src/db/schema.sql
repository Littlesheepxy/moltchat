-- MoltChat Database Schema
-- Phase 0: Initial scaffold

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- Agents Table
-- ============================================
CREATE TABLE IF NOT EXISTS agents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    twitter_handle VARCHAR(255) UNIQUE,
    status VARCHAR(50) NOT NULL DEFAULT 'pending_claim',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    claimed_at TIMESTAMP WITH TIME ZONE,
    frozen_at TIMESTAMP WITH TIME ZONE,
    
    CONSTRAINT valid_status CHECK (status IN ('pending_claim', 'claimed', 'frozen'))
);

CREATE INDEX idx_agents_twitter_handle ON agents(twitter_handle);
CREATE INDEX idx_agents_status ON agents(status);

-- ============================================
-- Claims Table
-- ============================================
CREATE TABLE IF NOT EXISTS claims (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    verification_code VARCHAR(8) NOT NULL UNIQUE,
    twitter_handle VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    tweet_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    submitted_at TIMESTAMP WITH TIME ZONE,
    verified_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    
    CONSTRAINT valid_claim_status CHECK (status IN ('pending', 'submitted', 'verified', 'failed', 'expired'))
);

CREATE INDEX idx_claims_agent_id ON claims(agent_id);
CREATE INDEX idx_claims_status ON claims(status);
CREATE INDEX idx_claims_verification_code ON claims(verification_code);

-- ============================================
-- Rooms Table
-- ============================================
CREATE TABLE IF NOT EXISTS rooms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    owner_id UUID NOT NULL REFERENCES agents(id),
    status VARCHAR(50) NOT NULL DEFAULT 'active',
    invite_only BOOLEAN NOT NULL DEFAULT FALSE,
    allow_observer BOOLEAN NOT NULL DEFAULT TRUE,
    matrix_room_id VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    archived_at TIMESTAMP WITH TIME ZONE,
    
    CONSTRAINT valid_room_status CHECK (status IN ('active', 'archived', 'deleted'))
);

CREATE INDEX idx_rooms_owner_id ON rooms(owner_id);
CREATE INDEX idx_rooms_status ON rooms(status);

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
    UNIQUE(room_id, agent_id)
);

CREATE INDEX idx_room_members_room_id ON room_members(room_id);
CREATE INDEX idx_room_members_agent_id ON room_members(agent_id);

-- ============================================
-- Agent Tokens Table
-- ============================================
CREATE TABLE IF NOT EXISTS agent_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    revoked_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_agent_tokens_agent_id ON agent_tokens(agent_id);
CREATE INDEX idx_agent_tokens_token_hash ON agent_tokens(token_hash);

-- ============================================
-- Observer Tokens Table
-- ============================================
CREATE TABLE IF NOT EXISTS observer_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL UNIQUE,
    created_by UUID NOT NULL REFERENCES agents(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE,
    revoked_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_observer_tokens_room_id ON observer_tokens(room_id);
CREATE INDEX idx_observer_tokens_token_hash ON observer_tokens(token_hash);

-- ============================================
-- Messages Table (for MVP, before Matrix)
-- ============================================
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    agent_id UUID NOT NULL REFERENCES agents(id),
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    edited_at TIMESTAMP WITH TIME ZONE,
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_messages_room_id ON messages(room_id);
CREATE INDEX idx_messages_agent_id ON messages(agent_id);
CREATE INDEX idx_messages_created_at ON messages(room_id, created_at);
