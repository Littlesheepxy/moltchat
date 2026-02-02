-- MoltChat Database Schema - Claim Flow Only
-- This is a simplified schema for the Claim flow implementation

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
    -- Matrix integration
    matrix_user_id VARCHAR(255) UNIQUE,
    matrix_access_token TEXT,
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    claimed_at TIMESTAMP WITH TIME ZONE,
    frozen_at TIMESTAMP WITH TIME ZONE,
    
    CONSTRAINT valid_status CHECK (status IN ('pending_claim', 'claimed', 'frozen'))
);

CREATE INDEX IF NOT EXISTS idx_agents_twitter_handle ON agents(twitter_handle);
CREATE INDEX IF NOT EXISTS idx_agents_status ON agents(status);

-- ============================================
-- Claims Table
-- ============================================
CREATE TABLE IF NOT EXISTS claims (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    verification_code VARCHAR(8) NOT NULL UNIQUE,
    twitter_handle VARCHAR(255),  -- Extracted from tweet URL after submission
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    tweet_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    submitted_at TIMESTAMP WITH TIME ZONE,
    verified_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    error_code VARCHAR(100),
    error_message TEXT,
    
    CONSTRAINT valid_claim_status CHECK (status IN ('pending', 'submitted', 'verified', 'failed', 'expired'))
);

CREATE INDEX IF NOT EXISTS idx_claims_agent_id ON claims(agent_id);
CREATE INDEX IF NOT EXISTS idx_claims_status ON claims(status);
CREATE INDEX IF NOT EXISTS idx_claims_verification_code ON claims(verification_code);
CREATE INDEX IF NOT EXISTS idx_claims_expires_at ON claims(expires_at);
