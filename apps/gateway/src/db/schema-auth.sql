-- Better Auth Schema
-- Multi-provider OAuth authentication for human owners

-- ============================================
-- Users Table (Better Auth core)
-- ============================================
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255),
    email VARCHAR(255) UNIQUE,
    email_verified BOOLEAN DEFAULT FALSE,
    image TEXT,
    
    -- Extended profile fields from OAuth providers
    headline VARCHAR(500),          -- LinkedIn: job title
    company VARCHAR(255),           -- LinkedIn: company name
    location VARCHAR(255),          -- Geographic location
    bio TEXT,                       -- User bio/description
    primary_provider VARCHAR(50),   -- Primary login provider
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- ============================================
-- Accounts Table (OAuth provider links)
-- ============================================
CREATE TABLE IF NOT EXISTS accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Provider information
    account_id VARCHAR(255) NOT NULL,       -- Provider's user ID
    provider_id VARCHAR(50) NOT NULL,       -- 'twitter', 'google', 'linkedin', 'tiktok'
    
    -- Tokens (encrypted in production)
    access_token TEXT,
    refresh_token TEXT,
    access_token_expires_at TIMESTAMP WITH TIME ZONE,
    refresh_token_expires_at TIMESTAMP WITH TIME ZONE,
    
    -- OAuth scope granted
    scope TEXT,
    
    -- Additional provider-specific data
    id_token TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(provider_id, account_id)
);

CREATE INDEX IF NOT EXISTS idx_accounts_user_id ON accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_accounts_provider ON accounts(provider_id, account_id);

-- ============================================
-- Sessions Table
-- ============================================
CREATE TABLE IF NOT EXISTS sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    token VARCHAR(255) UNIQUE NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    
    -- Session metadata
    ip_address VARCHAR(45),
    user_agent TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);

-- ============================================
-- Verifications Table (email verification, password reset, etc.)
-- ============================================
CREATE TABLE IF NOT EXISTS verifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    identifier VARCHAR(255) NOT NULL,       -- email or other identifier
    value VARCHAR(255) NOT NULL,            -- verification code/token
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_verifications_identifier ON verifications(identifier);

-- ============================================
-- Modify owner_profiles: Link to users table
-- ============================================
-- Add user_id column (nullable initially for migration)
ALTER TABLE owner_profiles ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id);

-- Make twitter_handle nullable (for non-X OAuth users)
ALTER TABLE owner_profiles ALTER COLUMN twitter_handle DROP NOT NULL;

-- Add unique index on user_id
CREATE UNIQUE INDEX IF NOT EXISTS idx_owner_profiles_user_id ON owner_profiles(user_id) WHERE user_id IS NOT NULL;

-- ============================================
-- Modify agents: Link to users table
-- ============================================
-- Add owner_user_id column (the human owner)
ALTER TABLE agents ADD COLUMN IF NOT EXISTS owner_user_id UUID REFERENCES users(id);

-- Add index for owner lookup
CREATE INDEX IF NOT EXISTS idx_agents_owner_user_id ON agents(owner_user_id);

-- ============================================
-- Tweet Share Tracking (for activation verification)
-- ============================================
CREATE TABLE IF NOT EXISTS tweet_verifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
    
    -- Tweet info
    tweet_url TEXT NOT NULL,
    tweet_id VARCHAR(255),
    expected_content TEXT,                  -- What we expect in the tweet
    
    -- Verification status
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    verified_at TIMESTAMP WITH TIME ZONE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT valid_tweet_verification_status CHECK (
        status IN ('pending', 'verified', 'failed', 'expired')
    )
);

CREATE INDEX IF NOT EXISTS idx_tweet_verifications_user_id ON tweet_verifications(user_id);
CREATE INDEX IF NOT EXISTS idx_tweet_verifications_status ON tweet_verifications(status);
