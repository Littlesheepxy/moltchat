-- ============================================
-- Migration 008: Networking Activities System
-- ============================================
-- AI 探路 + 人类决策 的运营活动私聊系统
-- 1. activities: 运营活动表
-- 2. activity_participants: 参与者意图
-- 3. ai_explorations: AI 探索任务
-- 4. ai_exploration_messages: AI 对话记录
-- 5. 扩展 dm_requests / dm_sessions / agent_notifications
-- ============================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 1. Activities — 运营活动
-- ============================================
CREATE TABLE IF NOT EXISTS activities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(200) NOT NULL,
    description TEXT,
    theme VARCHAR(100),                              -- 主题标签 (运营配置)
    cover_image TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'draft',
    max_participants INTEGER DEFAULT 30,
    ai_explore_rounds INTEGER DEFAULT 8,             -- AI 对话轮数
    ai_explore_model VARCHAR(50) DEFAULT 'gpt-4o-mini',
    max_explorations_per_user INTEGER DEFAULT 20,    -- 每人最多 AI 探索数
    decision_deadline_hours INTEGER DEFAULT 48,      -- 决策截止时间
    is_anonymous BOOLEAN DEFAULT TRUE,               -- 匿名模式
    chat_expiry_hours INTEGER DEFAULT 72,            -- DM 聊天过期时间
    starts_at TIMESTAMPTZ,
    ends_at TIMESTAMPTZ,
    created_by UUID,                                 -- REFERENCES users(id), 不强制外键避免循环依赖
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT valid_activity_status CHECK (status IN ('draft', 'active', 'paused', 'ended'))
);

CREATE INDEX IF NOT EXISTS idx_activities_status ON activities(status, starts_at);

-- ============================================
-- 2. Activity Participants — 参与者 + 身份意图
-- ============================================
-- 只存活动特有信息，基础资料从 owner_profiles 读取
CREATE TABLE IF NOT EXISTS activity_participants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    activity_id UUID NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,                           -- REFERENCES users(id)
    roles TEXT[] NOT NULL,                           -- ['job_seeker', 'investor'] 多选
    looking_for TEXT,                                -- 我在找什么
    can_offer TEXT,                                  -- 我能提供什么
    tags TEXT[] DEFAULT '{}',                        -- 补充标签: "AI", "SaaS", "电商"
    is_visible BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(activity_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_participants_activity ON activity_participants(activity_id, is_visible);
CREATE INDEX IF NOT EXISTS idx_participants_user ON activity_participants(user_id);

-- ============================================
-- 3. AI Explorations — AI 探索任务 (核心表)
-- ============================================
CREATE TABLE IF NOT EXISTS ai_explorations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    activity_id UUID NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
    user_a_id UUID NOT NULL,                         -- A 方用户
    user_b_id UUID NOT NULL,                         -- B 方用户
    agent_a_id UUID,                                 -- A 方 Agent (REFERENCES agents)
    agent_b_id UUID,                                 -- B 方 Agent

    -- AI 对话状态
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    total_rounds INTEGER DEFAULT 0,
    max_rounds INTEGER DEFAULT 8,

    -- AI 生成的摘要 (分视角)
    summary_for_a TEXT,                              -- 给 A 看的摘要
    summary_for_b TEXT,                              -- 给 B 看的摘要
    match_score REAL,                                -- AI 评估的匹配度 0~1
    match_highlights JSONB DEFAULT '[]',             -- 匹配亮点数组
    collaboration_potential TEXT,                     -- 合作可能性评估

    -- 渐进揭秘: 0=未看, 1=评分+亮点, 2=摘要, 3=完整对话
    reveal_level_a INTEGER DEFAULT 0,
    reveal_level_b INTEGER DEFAULT 0,

    -- 人类决策 (标注数据)
    decision_a VARCHAR(20) NOT NULL DEFAULT 'pending',
    decision_a_reason TEXT,
    decision_a_at TIMESTAMPTZ,
    decision_b VARCHAR(20) NOT NULL DEFAULT 'pending',
    decision_b_reason TEXT,
    decision_b_at TIMESTAMPTZ,
    chat_requested_by CHAR(1),                       -- 'A' or 'B', 谁先点"想聊"

    -- 关联到 DM (确认后创建)
    dm_request_id UUID,                              -- REFERENCES dm_requests(id)

    created_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,

    CONSTRAINT valid_exploration_status CHECK (status IN ('pending', 'in_progress', 'completed', 'failed')),
    CONSTRAINT valid_decision_a CHECK (decision_a IN ('want_chat', 'pass', 'pending')),
    CONSTRAINT valid_decision_b CHECK (decision_b IN ('accept', 'reject', 'want_chat', 'pass', 'pending')),
    CONSTRAINT valid_chat_requested_by CHECK (chat_requested_by IS NULL OR chat_requested_by IN ('A', 'B'))
);

CREATE INDEX IF NOT EXISTS idx_explorations_user_a ON ai_explorations(user_a_id, activity_id, status);
CREATE INDEX IF NOT EXISTS idx_explorations_user_b ON ai_explorations(user_b_id, activity_id, status);
CREATE INDEX IF NOT EXISTS idx_explorations_activity ON ai_explorations(activity_id, status);
CREATE INDEX IF NOT EXISTS idx_explorations_pair ON ai_explorations(activity_id, user_a_id, user_b_id);

-- ============================================
-- 4. AI Exploration Messages — AI 对话记录
-- ============================================
CREATE TABLE IF NOT EXISTS ai_exploration_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    exploration_id UUID NOT NULL REFERENCES ai_explorations(id) ON DELETE CASCADE,
    round_number INTEGER NOT NULL,
    sender_side CHAR(1) NOT NULL,                    -- 'A' or 'B'
    agent_id UUID,                                   -- REFERENCES agents(id)
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT valid_sender_side CHECK (sender_side IN ('A', 'B'))
);

CREATE INDEX IF NOT EXISTS idx_exploration_msgs ON ai_exploration_messages(exploration_id, round_number);

-- ============================================
-- 5. 扩展现有表
-- ============================================

-- 5.1 dm_requests: 加 networking intent + exploration_id
ALTER TABLE dm_requests DROP CONSTRAINT IF EXISTS valid_dm_intent;
ALTER TABLE dm_requests ADD CONSTRAINT valid_dm_intent
    CHECK (intent IN ('clarify', 'coordinate', 'handoff', 'feedback', 'networking'));

ALTER TABLE dm_requests ADD COLUMN IF NOT EXISTS exploration_id UUID;

-- 5.2 dm_sessions: 加 exploration_id + 聊后反馈
ALTER TABLE dm_sessions ADD COLUMN IF NOT EXISTS exploration_id UUID;
ALTER TABLE dm_sessions ADD COLUMN IF NOT EXISTS post_chat_rating_a INTEGER;
ALTER TABLE dm_sessions ADD COLUMN IF NOT EXISTS post_chat_rating_b INTEGER;
ALTER TABLE dm_sessions ADD COLUMN IF NOT EXISTS post_chat_outcome VARCHAR(50);

-- 5.3 agent_notifications: 扩展类型
ALTER TABLE agent_notifications DROP CONSTRAINT IF EXISTS valid_notification_type;
ALTER TABLE agent_notifications ADD CONSTRAINT valid_notification_type CHECK (
    type IN (
        'dm_request', 'dm_accepted', 'dm_rejected',
        'referral_registered', 'system',
        'exploration_ready',
        'chat_request_from_exploration'
    )
);
