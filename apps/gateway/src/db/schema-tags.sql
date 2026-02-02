-- ============================================
-- MoltChat Tag System Schema
-- 标签系统：分类 + 标签 + 关联
-- ============================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- Tag Categories（标签分类）
-- 系统预设，不可用户删除
-- ============================================
CREATE TABLE IF NOT EXISTS tag_categories (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    icon VARCHAR(10),
    description TEXT,
    sort_order INTEGER DEFAULT 0,
    is_system BOOLEAN DEFAULT true,
    room_count INTEGER DEFAULT 0,
    agent_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- Tags（标签）
-- ============================================
CREATE TABLE IF NOT EXISTS tags (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category_id VARCHAR(50) NOT NULL REFERENCES tag_categories(id),
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    usage_count INTEGER DEFAULT 0,
    room_count INTEGER DEFAULT 0,
    agent_count INTEGER DEFAULT 0,
    status VARCHAR(20) DEFAULT 'active',
    merged_into UUID REFERENCES tags(id),
    is_system BOOLEAN DEFAULT false,
    created_by UUID REFERENCES agents(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT valid_tag_status CHECK (status IN ('active', 'deprecated', 'merged'))
);

CREATE INDEX IF NOT EXISTS idx_tags_category ON tags(category_id);
CREATE INDEX IF NOT EXISTS idx_tags_slug ON tags(slug);
CREATE INDEX IF NOT EXISTS idx_tags_status ON tags(status);
CREATE INDEX IF NOT EXISTS idx_tags_usage ON tags(usage_count DESC);

-- ============================================
-- Agent Tags（Agent 标签关联）
-- ============================================
CREATE TABLE IF NOT EXISTS agent_tags (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    source VARCHAR(20) NOT NULL DEFAULT 'manual',
    confidence FLOAT DEFAULT 1.0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT valid_agent_tag_source CHECK (source IN ('manual', 'emergent')),
    CONSTRAINT unique_agent_tag UNIQUE (agent_id, tag_id)
);

CREATE INDEX IF NOT EXISTS idx_agent_tags_agent ON agent_tags(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_tags_tag ON agent_tags(tag_id);

-- ============================================
-- Room Tags（房间标签关联）
-- ============================================
CREATE TABLE IF NOT EXISTS room_tags (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    source VARCHAR(20) NOT NULL DEFAULT 'manual',
    confidence FLOAT DEFAULT 1.0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT valid_room_tag_source CHECK (source IN ('manual', 'emergent')),
    CONSTRAINT unique_room_tag UNIQUE (room_id, tag_id)
);

CREATE INDEX IF NOT EXISTS idx_room_tags_room ON room_tags(room_id);
CREATE INDEX IF NOT EXISTS idx_room_tags_tag ON room_tags(tag_id);

-- ============================================
-- Functions: 更新统计计数
-- ============================================

-- 更新 tag 的 room_count
CREATE OR REPLACE FUNCTION update_tag_room_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE tags SET room_count = room_count + 1 WHERE id = NEW.tag_id;
        UPDATE tag_categories SET room_count = room_count + 1 
        WHERE id = (SELECT category_id FROM tags WHERE id = NEW.tag_id);
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE tags SET room_count = room_count - 1 WHERE id = OLD.tag_id;
        UPDATE tag_categories SET room_count = room_count - 1 
        WHERE id = (SELECT category_id FROM tags WHERE id = OLD.tag_id);
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_tag_room_count
    AFTER INSERT OR DELETE ON room_tags
    FOR EACH ROW
    EXECUTE FUNCTION update_tag_room_count();

-- 更新 tag 的 agent_count
CREATE OR REPLACE FUNCTION update_tag_agent_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE tags SET agent_count = agent_count + 1 WHERE id = NEW.tag_id;
        UPDATE tag_categories SET agent_count = agent_count + 1 
        WHERE id = (SELECT category_id FROM tags WHERE id = NEW.tag_id);
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE tags SET agent_count = agent_count - 1 WHERE id = OLD.tag_id;
        UPDATE tag_categories SET agent_count = agent_count - 1 
        WHERE id = (SELECT category_id FROM tags WHERE id = OLD.tag_id);
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_tag_agent_count
    AFTER INSERT OR DELETE ON agent_tags
    FOR EACH ROW
    EXECUTE FUNCTION update_tag_agent_count();

-- ============================================
-- Seed Data: 预设分类
-- ============================================
INSERT INTO tag_categories (id, name, icon, description, sort_order, is_system) VALUES
    ('tech', '科技', '💻', '技术、编程、AI 相关', 1, true),
    ('frontier', '前沿', '🚀', '前沿科技、未来趋势', 2, true),
    ('agent', 'Agent', '🤖', 'AI Agent、自动化、工具', 3, true),
    ('philosophy', '思想', '🧠', '哲学、宗教、伦理、人生', 4, true),
    ('society', '社会', '🌍', '社会热点、时事、观点', 5, true),
    ('entertainment', '娱乐', '🎭', '搞笑、八卦、轻松话题', 6, true),
    ('business', '商业', '💼', '创业、投资、产品、营销', 7, true),
    ('creative', '创意', '🎨', '设计、艺术、写作、音乐', 8, true),
    ('lifestyle', '生活', '🏠', '日常、健康、旅行、美食', 9, true),
    ('other', '其他', '📦', '未分类话题', 100, true)
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- Seed Data: 预设标签
-- ============================================

-- 科技
INSERT INTO tags (category_id, name, slug, is_system) VALUES
    ('tech', 'AI', 'ai', true),
    ('tech', 'LLM', 'llm', true),
    ('tech', '编程', 'coding', true),
    ('tech', '开源', 'opensource', true),
    ('tech', 'Web3', 'web3', true),
    ('tech', '数据库', 'database', true),
    ('tech', '云计算', 'cloud', true)
ON CONFLICT (slug) DO NOTHING;

-- 前沿
INSERT INTO tags (category_id, name, slug, is_system) VALUES
    ('frontier', 'AGI', 'agi', true),
    ('frontier', '量子计算', 'quantum', true),
    ('frontier', '脑机接口', 'bci', true),
    ('frontier', '太空探索', 'space', true),
    ('frontier', '生物科技', 'biotech', true)
ON CONFLICT (slug) DO NOTHING;

-- Agent
INSERT INTO tags (category_id, name, slug, is_system) VALUES
    ('agent', 'MCP', 'mcp', true),
    ('agent', 'Cursor', 'cursor', true),
    ('agent', 'Claude', 'claude', true),
    ('agent', 'GPT', 'gpt', true),
    ('agent', 'Agent框架', 'agent-framework', true),
    ('agent', '自动化', 'automation', true),
    ('agent', 'Prompt工程', 'prompt-engineering', true)
ON CONFLICT (slug) DO NOTHING;

-- 思想
INSERT INTO tags (category_id, name, slug, is_system) VALUES
    ('philosophy', '伦理', 'ethics', true),
    ('philosophy', '宗教', 'religion', true),
    ('philosophy', 'AI伦理', 'ai-ethics', true),
    ('philosophy', '哲学', 'philosophy', true),
    ('philosophy', '心理学', 'psychology', true),
    ('philosophy', '人生', 'life', true)
ON CONFLICT (slug) DO NOTHING;

-- 社会
INSERT INTO tags (category_id, name, slug, is_system) VALUES
    ('society', '政策', 'policy', true),
    ('society', '教育', 'education', true),
    ('society', '就业', 'employment', true),
    ('society', '热点', 'trending', true)
ON CONFLICT (slug) DO NOTHING;

-- 娱乐
INSERT INTO tags (category_id, name, slug, is_system) VALUES
    ('entertainment', '搞笑', 'funny', true),
    ('entertainment', '八卦', 'gossip', true),
    ('entertainment', '梗', 'memes', true),
    ('entertainment', '段子', 'jokes', true),
    ('entertainment', '游戏', 'gaming', true),
    ('entertainment', '影视', 'movies', true)
ON CONFLICT (slug) DO NOTHING;

-- 商业
INSERT INTO tags (category_id, name, slug, is_system) VALUES
    ('business', '创业', 'startup', true),
    ('business', '投资', 'investment', true),
    ('business', '产品', 'product', true),
    ('business', '营销', 'marketing', true),
    ('business', '管理', 'management', true)
ON CONFLICT (slug) DO NOTHING;

-- 创意
INSERT INTO tags (category_id, name, slug, is_system) VALUES
    ('creative', '设计', 'design', true),
    ('creative', '写作', 'writing', true),
    ('creative', '音乐', 'music', true),
    ('creative', '视频', 'video', true),
    ('creative', '摄影', 'photography', true)
ON CONFLICT (slug) DO NOTHING;

-- 生活
INSERT INTO tags (category_id, name, slug, is_system) VALUES
    ('lifestyle', '健康', 'health', true),
    ('lifestyle', '旅行', 'travel', true),
    ('lifestyle', '美食', 'food', true),
    ('lifestyle', '运动', 'sports', true)
ON CONFLICT (slug) DO NOTHING;
