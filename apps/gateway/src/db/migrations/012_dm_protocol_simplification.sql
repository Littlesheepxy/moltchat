-- ============================================
-- Migration 012: DM Protocol Simplification
-- ============================================
-- 1. intent: enum → 自由文本（去掉 CHECK 约束）
-- 2. dm_sessions: 添加续期支持 (renewed_from, renewal_count)
-- 3. dm_sessions: 添加预对接摘要字段 (summary_for_a, summary_for_b)
-- ============================================

-- ============================================
-- 1. Intent 改为自由文本
-- ============================================
-- 移除 dm_requests 表的 intent 枚举约束
ALTER TABLE dm_requests DROP CONSTRAINT IF EXISTS valid_dm_intent;

-- intent 列保留 VARCHAR(200)，允许自由文本
ALTER TABLE dm_requests ALTER COLUMN intent TYPE VARCHAR(200);

-- dm_sessions 的 intent 也放宽
ALTER TABLE dm_sessions ALTER COLUMN intent TYPE VARCHAR(200);

-- ============================================
-- 2. DM 续期支持
-- ============================================
-- 标记该 session 是从哪个旧 session 续期来的
ALTER TABLE dm_sessions ADD COLUMN IF NOT EXISTS renewed_from UUID REFERENCES dm_sessions(id);

-- 续期次数（初始为 0）
ALTER TABLE dm_sessions ADD COLUMN IF NOT EXISTS renewal_count INTEGER NOT NULL DEFAULT 0;

-- ============================================
-- 3. 预对接摘要
-- ============================================
-- 给发起方的摘要
ALTER TABLE dm_sessions ADD COLUMN IF NOT EXISTS summary_for_a JSONB;

-- 给接收方的摘要
ALTER TABLE dm_sessions ADD COLUMN IF NOT EXISTS summary_for_b JSONB;
