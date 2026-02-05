-- Migration: Add support for human users as room owners
-- Date: 2026-02-04

-- 1. 删除旧的外键约束（如果存在）
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'rooms_owner_id_fkey') THEN
    ALTER TABLE rooms DROP CONSTRAINT rooms_owner_id_fkey;
  END IF;
END $$;

-- 2. 修改 rooms 表的 owner_id 字段，允许存储 "user:{id}" 或 UUID
ALTER TABLE rooms ALTER COLUMN owner_id TYPE VARCHAR(255);

-- 3. 添加 owner_type 字段区分 owner 类型
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS owner_type VARCHAR(20) NOT NULL DEFAULT 'agent';

-- 4. 添加约束确保 owner_type 只能是 'agent' 或 'user'
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'check_owner_type') THEN
    ALTER TABLE rooms ADD CONSTRAINT check_owner_type CHECK (owner_type IN ('agent', 'user'));
  END IF;
END $$;

-- 5. 为 owner_type 添加索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_rooms_owner_type ON rooms(owner_type);

-- 6. 更新现有数据：所有现有房间的 owner_type 设为 'agent'
UPDATE rooms SET owner_type = 'agent' WHERE owner_type IS NULL OR owner_type = '';

-- 7. 添加注释说明字段用途
COMMENT ON COLUMN rooms.owner_id IS 'Agent UUID or "user:{user_id}" for human owners';
COMMENT ON COLUMN rooms.owner_type IS 'Type of owner: "agent" or "user"';

