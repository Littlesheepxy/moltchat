-- ============================================
-- Migration 013: DM Pre-screening Queue
-- ============================================
-- 1. ai_explorations: activity_id 可空 + 新增 source / origin_dm_request_id
-- 2. exploration_queue: Agent 对话排队表
-- 3. agent_notifications: 新增 DM 预对接通知类型
-- ============================================

-- ============================================
-- 1. ai_explorations 扩展
-- ============================================

-- 1.1 activity_id 改为可空（DM 发起的探索没有 activity）
ALTER TABLE ai_explorations ALTER COLUMN activity_id DROP NOT NULL;

-- 1.2 区分来源：activity（运营活动）/ dm（DM 请求）
ALTER TABLE ai_explorations ADD COLUMN IF NOT EXISTS source VARCHAR(20) NOT NULL DEFAULT 'activity';

-- 1.3 DM 发起的探索关联回原始 dm_request
ALTER TABLE ai_explorations ADD COLUMN IF NOT EXISTS origin_dm_request_id UUID;

-- 索引
CREATE INDEX IF NOT EXISTS idx_explorations_source ON ai_explorations(source, status);
CREATE INDEX IF NOT EXISTS idx_explorations_origin_dm ON ai_explorations(origin_dm_request_id) WHERE origin_dm_request_id IS NOT NULL;

-- ============================================
-- 2. exploration_queue — Agent 对话排队
-- ============================================
-- 一个 Agent 同时只能进行一个对话
-- PostgreSQL 队列：SELECT FOR UPDATE SKIP LOCKED

CREATE TABLE IF NOT EXISTS exploration_queue (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    exploration_id UUID NOT NULL REFERENCES ai_explorations(id) ON DELETE CASCADE,

    -- 涉及的 Agent（用于检查是否忙碌）
    agent_a_id UUID,
    agent_b_id UUID,

    -- 队列状态
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    priority INTEGER NOT NULL DEFAULT 0,
    attempts INTEGER NOT NULL DEFAULT 0,
    max_attempts INTEGER NOT NULL DEFAULT 3,
    last_error TEXT,

    -- 锁：哪个 worker 在处理
    locked_by VARCHAR(100),
    locked_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,

    CONSTRAINT valid_queue_status CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled'))
);

CREATE INDEX IF NOT EXISTS idx_queue_status_priority ON exploration_queue(status, priority DESC, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_queue_agent_a ON exploration_queue(agent_a_id, status);
CREATE INDEX IF NOT EXISTS idx_queue_agent_b ON exploration_queue(agent_b_id, status);
CREATE INDEX IF NOT EXISTS idx_queue_exploration ON exploration_queue(exploration_id);

-- ============================================
-- 3. agent_notifications 类型扩展
-- ============================================
ALTER TABLE agent_notifications DROP CONSTRAINT IF EXISTS valid_notification_type;
ALTER TABLE agent_notifications ADD CONSTRAINT valid_notification_type CHECK (
    type IN (
        'dm_request', 'dm_accepted', 'dm_rejected',
        'referral_registered', 'system',
        'exploration_ready',
        'chat_request_from_exploration',
        'dm_prescreening_started',
        'dm_prescreening_complete'
    )
);
