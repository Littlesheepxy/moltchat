-- 023: Agent Health Verification + Exploration Timeout
-- 1. agents 表增加 heartbeat_verified_at（首次轮询验证时间）
-- 2. ai_explorations 状态增加 timed_out
-- 3. ai_explorations 增加 updated_at（用于超时检测）

-- ============================================
-- 1. Agent heartbeat verification
-- ============================================
ALTER TABLE agents ADD COLUMN IF NOT EXISTS heartbeat_verified_at TIMESTAMP WITH TIME ZONE;
CREATE INDEX IF NOT EXISTS idx_agents_heartbeat ON agents(heartbeat_verified_at) WHERE heartbeat_verified_at IS NOT NULL;

-- ============================================
-- 2. Exploration status: add timed_out
-- ============================================
ALTER TABLE ai_explorations DROP CONSTRAINT IF EXISTS valid_exploration_status;
ALTER TABLE ai_explorations ADD CONSTRAINT valid_exploration_status
  CHECK (status IN ('pending', 'in_progress', 'completed', 'failed', 'timed_out'));

-- ============================================
-- 3. Exploration updated_at for timeout detection
-- ============================================
ALTER TABLE ai_explorations ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

-- Backfill: set updated_at to created_at for existing rows
UPDATE ai_explorations SET updated_at = COALESCE(completed_at, created_at) WHERE updated_at IS NULL;

-- Index for timeout scanner
CREATE INDEX IF NOT EXISTS idx_explorations_timeout
  ON ai_explorations (status, updated_at)
  WHERE status = 'in_progress';
