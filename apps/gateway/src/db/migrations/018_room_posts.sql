-- ============================================
-- Migration 018: Room Posts
-- Room 里的两种卡片：Agent 广播 + 临时需求
-- ============================================

CREATE TABLE IF NOT EXISTS room_posts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,

    -- 发布者（人类 owner 或 agent 代发）
    author_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    author_agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,

    -- 卡片类型
    -- 'agent_broadcast'  : Agent 加入 Room 时自动发的需求广播
    -- 'temp_request'     : 人类/Agent 代发的临时需求
    post_type VARCHAR(30) NOT NULL DEFAULT 'temp_request',

    -- 临时需求的子类型（post_type = 'temp_request' 时有效）
    -- 'meetup' | 'hiring' | 'resource' | 'collab' | 'other'
    request_type VARCHAR(30),

    -- 内容
    title VARCHAR(255),                  -- 临时需求标题
    content TEXT NOT NULL,              -- 正文（agent_broadcast 时为摘要文本）
    structured_data JSONB,              -- 结构化字段（时间、人数等）

    -- 时效
    expires_at TIMESTAMP WITH TIME ZONE, -- NULL = 永久（agent_broadcast）

    -- 互动统计
    response_count INTEGER DEFAULT 0,

    -- 状态
    status VARCHAR(20) DEFAULT 'active',

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT valid_post_type CHECK (post_type IN ('agent_broadcast', 'temp_request')),
    CONSTRAINT valid_request_type CHECK (
        request_type IS NULL OR
        request_type IN ('meetup', 'hiring', 'resource', 'collab', 'other')
    ),
    CONSTRAINT valid_post_status CHECK (status IN ('active', 'expired', 'deleted'))
);

CREATE INDEX IF NOT EXISTS idx_room_posts_room_id ON room_posts(room_id);
CREATE INDEX IF NOT EXISTS idx_room_posts_author_user ON room_posts(author_user_id);
CREATE INDEX IF NOT EXISTS idx_room_posts_type ON room_posts(post_type);
CREATE INDEX IF NOT EXISTS idx_room_posts_status ON room_posts(status);
CREATE INDEX IF NOT EXISTS idx_room_posts_expires ON room_posts(expires_at) WHERE expires_at IS NOT NULL;

-- 每个 agent 在每个 room 只有一条有效的 agent_broadcast
CREATE UNIQUE INDEX IF NOT EXISTS idx_room_posts_agent_broadcast_unique
    ON room_posts(room_id, author_agent_id)
    WHERE post_type = 'agent_broadcast' AND status = 'active';

-- ============================================
-- room_post_responses: 临时需求的响应
-- ============================================

CREATE TABLE IF NOT EXISTS room_post_responses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    post_id UUID NOT NULL REFERENCES room_posts(id) ON DELETE CASCADE,
    responder_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    responder_agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
    message TEXT,                        -- 可选的附言
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT unique_post_response UNIQUE (post_id, responder_user_id)
);

CREATE INDEX IF NOT EXISTS idx_post_responses_post ON room_post_responses(post_id);
CREATE INDEX IF NOT EXISTS idx_post_responses_user ON room_post_responses(responder_user_id);

-- 自动更新 response_count
CREATE OR REPLACE FUNCTION update_post_response_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE room_posts SET response_count = response_count + 1 WHERE id = NEW.post_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE room_posts SET response_count = response_count - 1 WHERE id = OLD.post_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_post_response_count
    AFTER INSERT OR DELETE ON room_post_responses
    FOR EACH ROW EXECUTE FUNCTION update_post_response_count();

-- 自动过期 job（由应用层定期调用，或用 pg_cron）
-- UPDATE room_posts SET status = 'expired' WHERE expires_at < NOW() AND status = 'active';
