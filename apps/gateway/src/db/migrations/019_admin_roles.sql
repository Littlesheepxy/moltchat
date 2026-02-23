-- ============================================
-- Migration 019: Admin Roles
-- 超级管理员 + 方向管理员授权系统
-- ============================================

-- users 表加 is_admin 字段
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE;

-- 方向管理员授权表
CREATE TABLE IF NOT EXISTS admin_grants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    granted_by UUID NOT NULL REFERENCES users(id),
    scope VARCHAR(50) NOT NULL DEFAULT 'battles',  -- 'battles', 'rooms', 'all'
    theme VARCHAR(100),                             -- NULL 表示该 scope 下所有方向
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, scope, theme)
);

CREATE INDEX IF NOT EXISTS idx_admin_grants_user_id ON admin_grants(user_id);
