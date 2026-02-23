-- ============================================
-- Migration 020: Exploration Public Flag
-- 允许双方同意后公开 Agent 对谈记录
-- ============================================

ALTER TABLE ai_explorations ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT FALSE;
ALTER TABLE ai_explorations ADD COLUMN IF NOT EXISTS public_title VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_ai_explorations_is_public ON ai_explorations(is_public) WHERE is_public = TRUE;
