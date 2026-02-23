-- ============================================
-- Migration 009: Market-Driven Protocol
-- ============================================
-- 市场驱动的透明连接协议
-- 1. attention_budgets: 注意力预算（每周额度）
-- 2. outreach_stakes: 触达押金（承诺/时间/声誉）
-- 3. reputation_ledger: 声誉账本（公开记录）
-- 4. reputation_events: 声誉事件日志
-- 5. 扩展 dm_requests: 对齐度评分 + 押金关联
-- ============================================

-- ============================================
-- 1. Attention Budgets — 注意力预算
-- ============================================
CREATE TABLE IF NOT EXISTS attention_budgets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    week_start DATE NOT NULL,
    inbound_limit INTEGER NOT NULL DEFAULT 5,
    outbound_limit INTEGER NOT NULL DEFAULT 5,
    inbound_used INTEGER NOT NULL DEFAULT 0,
    outbound_used INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(user_id, week_start)
);

CREATE INDEX IF NOT EXISTS idx_attention_budgets_user_week
    ON attention_budgets(user_id, week_start DESC);

-- ============================================
-- 2. Reputation Ledger — 声誉账本
-- ============================================
CREATE TABLE IF NOT EXISTS reputation_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE,
    reputation_score INTEGER NOT NULL DEFAULT 100,
    total_outbound INTEGER NOT NULL DEFAULT 0,
    total_accepted INTEGER NOT NULL DEFAULT 0,
    total_fulfilled INTEGER NOT NULL DEFAULT 0,
    total_forfeited INTEGER NOT NULL DEFAULT 0,
    avg_post_chat_rating REAL,
    cooldown_until TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reputation_ledger_score
    ON reputation_ledger(reputation_score);

-- ============================================
-- 3. Reputation Events — 声誉事件日志
-- ============================================
CREATE TABLE IF NOT EXISTS reputation_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    event_type VARCHAR(30) NOT NULL,
    points_delta INTEGER NOT NULL DEFAULT 0,
    reference_id UUID,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT valid_reputation_event_type CHECK (event_type IN (
        'outreach_sent', 'outreach_accepted', 'outreach_rejected',
        'stake_fulfilled', 'stake_forfeited',
        'post_chat_positive', 'post_chat_negative',
        'cooldown_triggered', 'cooldown_lifted'
    ))
);

CREATE INDEX IF NOT EXISTS idx_reputation_events_user
    ON reputation_events(user_id, created_at DESC);

-- ============================================
-- 4. Outreach Stakes — 触达押金
-- ============================================
CREATE TABLE IF NOT EXISTS outreach_stakes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dm_request_id UUID NOT NULL REFERENCES dm_requests(id),
    staker_user_id UUID NOT NULL,
    stake_type VARCHAR(20) NOT NULL,
    commitment_description TEXT,
    time_questions_answered INTEGER DEFAULT 0,
    reputation_points_staked INTEGER DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT valid_stake_type CHECK (stake_type IN ('commitment', 'time', 'reputation')),
    CONSTRAINT valid_stake_status CHECK (status IN ('active', 'fulfilled', 'forfeited', 'returned'))
);

CREATE INDEX IF NOT EXISTS idx_outreach_stakes_request
    ON outreach_stakes(dm_request_id);

CREATE INDEX IF NOT EXISTS idx_outreach_stakes_user
    ON outreach_stakes(staker_user_id, status);

-- ============================================
-- 5. Extend dm_requests — 对齐度 + 押金
-- ============================================
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'dm_requests' AND column_name = 'alignment_score'
    ) THEN
        ALTER TABLE dm_requests ADD COLUMN alignment_score REAL;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'dm_requests' AND column_name = 'alignment_details'
    ) THEN
        ALTER TABLE dm_requests ADD COLUMN alignment_details JSONB DEFAULT '{}';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'dm_requests' AND column_name = 'stake_id'
    ) THEN
        ALTER TABLE dm_requests ADD COLUMN stake_id UUID REFERENCES outreach_stakes(id);
    END IF;
END $$;
