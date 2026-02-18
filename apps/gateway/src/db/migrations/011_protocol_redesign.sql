-- ============================================
-- Migration 011: Protocol Redesign
-- ============================================
-- 协议重新设计：
-- 1. 信誉冷启动：初始分 60（之前 100）
-- 2. 去掉押金机制（outreach_stakes 表保留但不再使用）
-- 3. 注意力预算重构：去掉出站限制，入站用户可配置
-- 4. 新增 user_budget_preferences 表
-- 5. 新增 profile_completed 事件类型
-- 6. 去掉 fulfillment_rate（押金相关）
-- ============================================

-- ============================================
-- 1. User Budget Preferences — 用户预算偏好
-- ============================================
CREATE TABLE IF NOT EXISTS user_budget_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE,
    inbound_limit INTEGER NOT NULL DEFAULT 10,    -- -1 = unlimited
    overflow_policy VARCHAR(10) NOT NULL DEFAULT 'queue'
        CHECK (overflow_policy IN ('queue', 'reject')),
    priority_by_reputation BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- 2. Update reputation_events constraint to add profile_completed
-- ============================================
ALTER TABLE reputation_events DROP CONSTRAINT IF EXISTS valid_reputation_event_type;
ALTER TABLE reputation_events ADD CONSTRAINT valid_reputation_event_type CHECK (event_type IN (
    'profile_completed',
    'outreach_sent', 'outreach_accepted', 'outreach_rejected',
    'stake_fulfilled', 'stake_forfeited',
    'post_chat_positive', 'post_chat_negative',
    'cooldown_triggered', 'cooldown_lifted'
));

-- ============================================
-- 3. Update reputation_ledger default score to 60
-- ============================================
ALTER TABLE reputation_ledger ALTER COLUMN reputation_score SET DEFAULT 60;

-- ============================================
-- 4. Update attention_budgets — drop outbound columns if exist
-- ============================================
-- Keep outbound columns for backward compatibility but they're no longer used
-- ALTER TABLE attention_budgets DROP COLUMN IF EXISTS outbound_limit;
-- ALTER TABLE attention_budgets DROP COLUMN IF EXISTS outbound_used;

-- Update default inbound limit to 10
ALTER TABLE attention_budgets ALTER COLUMN inbound_limit SET DEFAULT 10;
