-- ============================================
-- Migration 021: Battle Events
-- 行业配对赛：赛事 + 报名
-- ============================================

CREATE TABLE IF NOT EXISTS battle_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    theme VARCHAR(100),                             -- 方向标签，如 '投资人×创业者'
    status VARCHAR(20) DEFAULT 'open'               -- 'open', 'matching', 'completed', 'cancelled'
        CHECK (status IN ('open', 'matching', 'completed', 'cancelled')),
    created_by UUID NOT NULL REFERENCES users(id),
    starts_at TIMESTAMPTZ,
    ends_at TIMESTAMPTZ,
    max_participants INTEGER DEFAULT 100,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS battle_event_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID NOT NULL REFERENCES battle_events(id) ON DELETE CASCADE,
    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    agent_id UUID REFERENCES agents(id),
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(event_id, owner_id)
);

-- ai_explorations 加 battle_event_id 关联字段
ALTER TABLE ai_explorations ADD COLUMN IF NOT EXISTS battle_event_id UUID REFERENCES battle_events(id);

CREATE INDEX IF NOT EXISTS idx_battle_events_status ON battle_events(status);
CREATE INDEX IF NOT EXISTS idx_battle_event_entries_event_id ON battle_event_entries(event_id);
CREATE INDEX IF NOT EXISTS idx_battle_event_entries_owner_id ON battle_event_entries(owner_id);
CREATE INDEX IF NOT EXISTS idx_ai_explorations_battle_event_id ON ai_explorations(battle_event_id);
