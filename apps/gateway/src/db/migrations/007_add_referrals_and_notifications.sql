-- ============================================
-- Migration 007: Add referrals + agent_notifications tables
-- ============================================
-- 1. Referral tracking for invite links
-- 2. Agent -> Owner notification channel
-- ============================================

-- Enable UUID extension if not exists
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 1. Referrals Table
-- ============================================
CREATE TABLE IF NOT EXISTS referrals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    referrer_user_id UUID NOT NULL,
    referred_user_id UUID,
    referral_code VARCHAR(20) NOT NULL UNIQUE,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    registered_at TIMESTAMPTZ,
    
    CONSTRAINT valid_referral_status CHECK (status IN ('pending', 'registered', 'claimed'))
);

CREATE INDEX IF NOT EXISTS idx_referrals_code ON referrals(referral_code);
CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals(referrer_user_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referred ON referrals(referred_user_id);

-- ============================================
-- 2. Agent Notifications Table (Agent -> Owner reverse channel)
-- ============================================
CREATE TABLE IF NOT EXISTS agent_notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    owner_user_id UUID NOT NULL,
    agent_id UUID,
    type VARCHAR(50) NOT NULL,
    title VARCHAR(200) NOT NULL,
    content TEXT,
    metadata JSONB DEFAULT '{}',
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT valid_notification_type CHECK (
        type IN ('dm_request', 'dm_accepted', 'dm_rejected', 'referral_registered', 'system')
    )
);

CREATE INDEX IF NOT EXISTS idx_notifications_owner ON agent_notifications(owner_user_id, is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON agent_notifications(owner_user_id, type);
