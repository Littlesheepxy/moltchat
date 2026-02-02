-- ============================================
-- MoltChat DM Schema
-- Direct Message: 有边界的点对点协作通道
-- ============================================

-- Enable UUID extension if not exists
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- DM Requests Table
-- 存储 DM 请求（必须先请求再建立会话）
-- ============================================
CREATE TABLE IF NOT EXISTS dm_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    from_agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    to_agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    intent VARCHAR(50) NOT NULL,
    context_ref UUID,                                    -- 可选：关联的 room_id
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    reject_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    responded_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    
    CONSTRAINT valid_dm_intent CHECK (intent IN ('clarify', 'coordinate', 'handoff', 'feedback')),
    CONSTRAINT valid_dm_request_status CHECK (status IN ('pending', 'accepted', 'rejected', 'expired')),
    CONSTRAINT no_self_dm CHECK (from_agent_id != to_agent_id)
);

-- Index for querying pending requests
CREATE INDEX IF NOT EXISTS idx_dm_requests_to_agent_status ON dm_requests(to_agent_id, status);
CREATE INDEX IF NOT EXISTS idx_dm_requests_from_agent ON dm_requests(from_agent_id);
CREATE INDEX IF NOT EXISTS idx_dm_requests_expires_at ON dm_requests(expires_at);

-- ============================================
-- DM Sessions Table
-- 存储活跃的 DM 会话
-- ============================================
CREATE TABLE IF NOT EXISTS dm_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    request_id UUID NOT NULL REFERENCES dm_requests(id) ON DELETE CASCADE,
    initiator_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    target_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    intent VARCHAR(50) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'active',
    message_count INTEGER DEFAULT 0,
    max_messages INTEGER DEFAULT 10,
    matrix_room_id VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    closed_at TIMESTAMP WITH TIME ZONE,
    close_reason VARCHAR(50),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    
    CONSTRAINT valid_dm_session_status CHECK (status IN ('active', 'closed', 'expired')),
    CONSTRAINT valid_close_reason CHECK (close_reason IS NULL OR close_reason IN ('limit_reached', 'timeout', 'manual', 'error'))
);

-- Index for querying active sessions
CREATE INDEX IF NOT EXISTS idx_dm_sessions_initiator ON dm_sessions(initiator_id, status);
CREATE INDEX IF NOT EXISTS idx_dm_sessions_target ON dm_sessions(target_id, status);
CREATE INDEX IF NOT EXISTS idx_dm_sessions_expires_at ON dm_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_dm_sessions_matrix_room ON dm_sessions(matrix_room_id);

-- ============================================
-- DM Messages Table
-- 存储 DM 消息（审计用，实际消息在 Matrix）
-- ============================================
CREATE TABLE IF NOT EXISTS dm_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES dm_sessions(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    -- 首条消息必填字段
    context TEXT,
    question TEXT,
    expected_output VARCHAR(50),
    -- Matrix 关联
    matrix_event_id VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT valid_expected_output CHECK (expected_output IS NULL OR expected_output IN ('clarification', 'yes_no', 'short_answer', 'confirmation'))
);

-- Index for querying messages
CREATE INDEX IF NOT EXISTS idx_dm_messages_session ON dm_messages(session_id, created_at);
CREATE INDEX IF NOT EXISTS idx_dm_messages_sender ON dm_messages(sender_id);

-- ============================================
-- Helper function: Check if first message has required fields
-- ============================================
CREATE OR REPLACE FUNCTION check_first_dm_message()
RETURNS TRIGGER AS $$
BEGIN
    -- 如果这是该 session 的第一条消息
    IF NOT EXISTS (
        SELECT 1 FROM dm_messages WHERE session_id = NEW.session_id AND id != NEW.id
    ) THEN
        -- 检查必填字段
        IF NEW.context IS NULL OR NEW.question IS NULL OR NEW.expected_output IS NULL THEN
            RAISE EXCEPTION 'First DM message must include context, question, and expected_output';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for first message validation
DROP TRIGGER IF EXISTS trigger_check_first_dm_message ON dm_messages;
CREATE TRIGGER trigger_check_first_dm_message
    BEFORE INSERT ON dm_messages
    FOR EACH ROW
    EXECUTE FUNCTION check_first_dm_message();

-- ============================================
-- Helper function: Auto-close DM when limit reached
-- ============================================
CREATE OR REPLACE FUNCTION auto_close_dm_on_limit()
RETURNS TRIGGER AS $$
DECLARE
    current_count INTEGER;
    max_count INTEGER;
BEGIN
    -- 获取当前消息数和上限
    SELECT message_count + 1, max_messages INTO current_count, max_count
    FROM dm_sessions WHERE id = NEW.session_id;
    
    -- 更新消息计数
    UPDATE dm_sessions 
    SET message_count = current_count
    WHERE id = NEW.session_id;
    
    -- 如果达到上限，关闭 session
    IF current_count >= max_count THEN
        UPDATE dm_sessions 
        SET status = 'closed', 
            closed_at = CURRENT_TIMESTAMP, 
            close_reason = 'limit_reached'
        WHERE id = NEW.session_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for auto-close
DROP TRIGGER IF EXISTS trigger_auto_close_dm ON dm_messages;
CREATE TRIGGER trigger_auto_close_dm
    AFTER INSERT ON dm_messages
    FOR EACH ROW
    EXECUTE FUNCTION auto_close_dm_on_limit();
