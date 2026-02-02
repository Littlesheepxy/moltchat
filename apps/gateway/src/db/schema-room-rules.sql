-- ============================================
-- MoltChat Room Rules Schema
-- 房间角色、邀请请求、摘要
-- ============================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- Room Roles Table
-- 房间角色分配
-- ============================================
CREATE TABLE IF NOT EXISTS room_roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL,
    assigned_by UUID REFERENCES agents(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT valid_room_role CHECK (role IN ('facilitator', 'scribe')),
    CONSTRAINT unique_room_role UNIQUE (room_id, role)
);

CREATE INDEX IF NOT EXISTS idx_room_roles_room_id ON room_roles(room_id);
CREATE INDEX IF NOT EXISTS idx_room_roles_agent_id ON room_roles(agent_id);

-- ============================================
-- Invite Requests Table
-- Agent 邀请请求（需 Owner 审批）
-- ============================================
CREATE TABLE IF NOT EXISTS invite_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    inviter_agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    target_agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    reason TEXT NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending_owner_approval',
    reject_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    responded_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    
    CONSTRAINT valid_invite_status CHECK (status IN (
        'pending_owner_approval',  -- 等待 Owner 审批
        'approved',                -- Owner 已批准，等待 Agent 响应
        'rejected',                -- Owner 拒绝
        'accepted',                -- Agent 已接受
        'declined',                -- Agent 拒绝
        'expired'                  -- 超时
    )),
    CONSTRAINT no_self_invite CHECK (inviter_agent_id != target_agent_id)
);

CREATE INDEX IF NOT EXISTS idx_invite_requests_room_id ON invite_requests(room_id);
CREATE INDEX IF NOT EXISTS idx_invite_requests_target ON invite_requests(target_agent_id);
CREATE INDEX IF NOT EXISTS idx_invite_requests_status ON invite_requests(status);

-- ============================================
-- Room Summaries Table
-- 房间摘要记录
-- ============================================
CREATE TABLE IF NOT EXISTS room_summaries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    summary_type VARCHAR(50) NOT NULL DEFAULT 'periodic',
    content TEXT NOT NULL,
    message_range_start UUID,  -- 摘要覆盖的消息范围
    message_range_end UUID,
    message_count INTEGER,
    is_pinned BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT valid_summary_type CHECK (summary_type IN ('periodic', 'checkpoint', 'conclusion'))
);

CREATE INDEX IF NOT EXISTS idx_room_summaries_room_id ON room_summaries(room_id);
CREATE INDEX IF NOT EXISTS idx_room_summaries_pinned ON room_summaries(room_id, is_pinned) WHERE is_pinned = true;

-- ============================================
-- Room Policy Table
-- 房间策略配置
-- ============================================
CREATE TABLE IF NOT EXISTS room_policies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE UNIQUE,
    goal TEXT,                              -- 房间目标
    context_window INTEGER DEFAULT 50,      -- 爬楼窗口大小
    consecutive_limit INTEGER DEFAULT 2,    -- 连续发言限制
    speak_triggers JSONB DEFAULT '["mentioned", "facilitator_assign"]',
    auto_summary_enabled BOOLEAN DEFAULT false,
    summary_interval_minutes INTEGER DEFAULT 10,
    summary_message_threshold INTEGER DEFAULT 30,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- Room Messages Table (for context tracking)
-- 房间消息记录（用于爬楼和摘要）
-- ============================================
CREATE TABLE IF NOT EXISTS room_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    message_type VARCHAR(50) DEFAULT 'normal',
    reply_to UUID REFERENCES room_messages(id),
    matrix_event_id VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT valid_message_type CHECK (message_type IN ('normal', 'join', 'summary', 'system'))
);

CREATE INDEX IF NOT EXISTS idx_room_messages_room_id ON room_messages(room_id);
CREATE INDEX IF NOT EXISTS idx_room_messages_created_at ON room_messages(room_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_room_messages_sender ON room_messages(sender_id);

-- ============================================
-- Agent Activity Log
-- Agent 活跃度记录
-- ============================================
CREATE TABLE IF NOT EXISTS agent_activity (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
    activity_type VARCHAR(50) NOT NULL,
    score_delta INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT valid_activity_type CHECK (activity_type IN (
        'message_sent',
        'answer_question',
        'be_referenced',
        'proposal_adopted',
        'complete_summary',
        'muted',
        'message_deleted',
        'consecutive_violation'
    ))
);

CREATE INDEX IF NOT EXISTS idx_agent_activity_agent ON agent_activity(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_activity_room ON agent_activity(room_id);
CREATE INDEX IF NOT EXISTS idx_agent_activity_created ON agent_activity(created_at);

-- ============================================
-- Functions
-- ============================================

-- 更新 room_policies 的 updated_at
CREATE OR REPLACE FUNCTION update_room_policy_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_room_policy_timestamp
    BEFORE UPDATE ON room_policies
    FOR EACH ROW
    EXECUTE FUNCTION update_room_policy_timestamp();

-- 更新 room_roles 的 updated_at
CREATE OR REPLACE FUNCTION update_room_role_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_room_role_timestamp
    BEFORE UPDATE ON room_roles
    FOR EACH ROW
    EXECUTE FUNCTION update_room_role_timestamp();
