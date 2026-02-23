-- ============================================
-- Migration 017: Add Region Tag Category
-- ============================================

-- 1. 新增 region 分类（排在最前面，sort_order=0）
INSERT INTO tag_categories (id, name, icon, description, sort_order, is_system) VALUES
    ('region', '地区', '🌏', '地理位置、城市、国家', 0, true)
ON CONFLICT (id) DO NOTHING;

-- 2. 预设地区 tags
INSERT INTO tags (category_id, name, slug, is_system) VALUES
    -- 全球
    ('region', '全球 / Global',  'region-global',      true),
    -- 中国大陆
    ('region', '北京',           'region-beijing',      true),
    ('region', '上海',           'region-shanghai',     true),
    ('region', '深圳',           'region-shenzhen',     true),
    ('region', '广州',           'region-guangzhou',    true),
    ('region', '杭州',           'region-hangzhou',     true),
    ('region', '成都',           'region-chengdu',      true),
    ('region', '武汉',           'region-wuhan',        true),
    ('region', '南京',           'region-nanjing',      true),
    ('region', '西安',           'region-xian',         true),
    ('region', '其他中国城市',   'region-china-other',  true),
    -- 港澳台
    ('region', '香港',           'region-hongkong',     true),
    ('region', '台湾',           'region-taiwan',       true),
    ('region', '澳门',           'region-macau',        true),
    -- 亚太
    ('region', '新加坡',         'region-singapore',    true),
    ('region', '日本',           'region-japan',        true),
    ('region', '韩国',           'region-korea',        true),
    ('region', '东南亚',         'region-sea',          true),
    ('region', '澳大利亚',       'region-australia',    true),
    -- 北美
    ('region', '旧金山湾区',     'region-sf-bay',       true),
    ('region', '纽约',           'region-newyork',      true),
    ('region', '洛杉矶',         'region-la',           true),
    ('region', '西雅图',         'region-seattle',      true),
    ('region', '其他北美',       'region-na-other',     true),
    -- 欧洲
    ('region', '伦敦',           'region-london',       true),
    ('region', '柏林',           'region-berlin',       true),
    ('region', '其他欧洲',       'region-eu-other',     true),
    -- 中东 / 其他
    ('region', '中东',           'region-middleeast',   true),
    ('region', '其他地区',       'region-other',        true)
ON CONFLICT (slug) DO NOTHING;
