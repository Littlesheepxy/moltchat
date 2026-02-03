-- Migration: Add Structured Profile Fields
-- Date: 2026-02-03
-- Description: Add structured fields (industry, company, job_title, location) to owner_profiles

-- ============================================
-- 1. Add New Columns
-- ============================================

ALTER TABLE owner_profiles 
  -- 重命名现有字段
  RENAME COLUMN background_md TO bio_md;

ALTER TABLE owner_profiles
  -- 基本结构化字段
  ADD COLUMN IF NOT EXISTS industry VARCHAR(100),
  ADD COLUMN IF NOT EXISTS company VARCHAR(255),
  ADD COLUMN IF NOT EXISTS job_title VARCHAR(255),
  ADD COLUMN IF NOT EXISTS location VARCHAR(255),
  
  -- 补充字段
  ADD COLUMN IF NOT EXISTS years_experience INT,
  ADD COLUMN IF NOT EXISTS education_level VARCHAR(50),
  ADD COLUMN IF NOT EXISTS website_url VARCHAR(500),
  ADD COLUMN IF NOT EXISTS linkedin_url VARCHAR(500);

-- ============================================
-- 2. Add Constraints
-- ============================================

ALTER TABLE owner_profiles
  ADD CONSTRAINT IF NOT EXISTS valid_education_level CHECK (
    education_level IS NULL OR 
    education_level IN ('High School', 'Associate', 'Bachelor', 'Master', 'PhD', 'Other')
  ),
  ADD CONSTRAINT IF NOT EXISTS valid_years_experience CHECK (
    years_experience IS NULL OR 
    (years_experience >= 0 AND years_experience <= 70)
  );

-- ============================================
-- 3. Add Indexes for Search Performance
-- ============================================

CREATE INDEX IF NOT EXISTS idx_owner_industry ON owner_profiles(industry);
CREATE INDEX IF NOT EXISTS idx_owner_company ON owner_profiles(company);
CREATE INDEX IF NOT EXISTS idx_owner_job_title ON owner_profiles(job_title);
CREATE INDEX IF NOT EXISTS idx_owner_location ON owner_profiles(location);

-- Full-text search indexes (PostgreSQL)
CREATE INDEX IF NOT EXISTS idx_owner_bio_fulltext 
  ON owner_profiles USING GIN (to_tsvector('english', COALESCE(bio_md, '')));
CREATE INDEX IF NOT EXISTS idx_owner_job_title_fulltext 
  ON owner_profiles USING GIN (to_tsvector('english', COALESCE(job_title, '')));

-- ============================================
-- 4. Data Migration (if needed)
-- ============================================

-- 这里不需要数据迁移，因为是新增字段
-- 现有数据的 background_md 已重命名为 bio_md

-- ============================================
-- 5. Update Timestamps
-- ============================================

-- 确保 updated_at 触发器存在
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_owner_profiles_updated_at ON owner_profiles;
CREATE TRIGGER update_owner_profiles_updated_at 
  BEFORE UPDATE ON owner_profiles 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 6. Verification
-- ============================================

-- 验证表结构
SELECT column_name, data_type, character_maximum_length 
FROM information_schema.columns 
WHERE table_name = 'owner_profiles'
ORDER BY ordinal_position;
