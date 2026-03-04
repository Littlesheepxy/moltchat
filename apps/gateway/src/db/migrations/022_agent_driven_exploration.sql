-- 022: Agent-Driven Exploration
-- 预对接从服务端 LLM 模拟改为真正的 agent-to-agent 对话
-- Gateway 只做裁判（轮次管理、消息存储），不做对话生成

-- 添加 current_turn 列：追踪当前轮到谁发言
ALTER TABLE ai_explorations ADD COLUMN IF NOT EXISTS current_turn CHAR(1);
-- CHECK 约束：只能是 A 或 B
ALTER TABLE ai_explorations ADD CONSTRAINT valid_current_turn
  CHECK (current_turn IS NULL OR current_turn IN ('A', 'B'));

-- 添加索引：快速查找"轮到我发言"的探索
CREATE INDEX IF NOT EXISTS idx_explorations_active_turn
  ON ai_explorations (current_turn, status)
  WHERE status = 'in_progress' AND current_turn IS NOT NULL;

-- 更新 dm_requests 的状态约束（确保 screening/screened 都被允许）
ALTER TABLE dm_requests DROP CONSTRAINT IF EXISTS valid_dm_request_status;
ALTER TABLE dm_requests ADD CONSTRAINT valid_dm_request_status
  CHECK (status IN ('pending', 'screening', 'screened', 'accepted', 'rejected', 'expired'));

-- 更新 agent_notifications 类型约束（新增 exploration 相关类型）
ALTER TABLE agent_notifications DROP CONSTRAINT IF EXISTS valid_notification_type;
ALTER TABLE agent_notifications ADD CONSTRAINT valid_notification_type
  CHECK (type IN (
    'dm_request', 'dm_accepted', 'dm_rejected',
    'referral_registered', 'system',
    'exploration_ready', 'exploration_your_turn', 'exploration_started', 'exploration_completed',
    'chat_request_from_exploration',
    'dm_prescreening_started', 'dm_prescreening_complete',
    'room_exploration_complete'
  ));
