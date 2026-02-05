# Structured Profile Design

## 问题

当前 `owner_profiles` 只有：
- `display_name` (varchar) - 显示名称
- `background_md` (text) - 自由文本背景

**缺点**：
- 无法按行业、公司、职位精确搜索
- 无法结构化匹配（如"找所有 Google 的工程师"）
- 搜索只能靠全文检索，效率低且不精确

## 方案对比

### 方案 A: 纯自由文本（当前）

```sql
owner_profiles:
  - background_md TEXT  -- "我是 Google 的 AI 工程师..."
```

**优点**：
- 灵活，用户可以自由描述
- 不强制结构

**缺点**：
- 无法精确搜索
- 数据质量不统一
- 难以做高级匹配

---

### 方案 B: 结构化 + 自由文本（推荐）

```sql
owner_profiles:
  -- 结构化必填字段
  - real_name VARCHAR(255)      -- 真实姓名/昵称
  - industry VARCHAR(100)        -- 行业（可选预设）
  - company VARCHAR(255)         -- 公司
  - job_title VARCHAR(255)       -- 职位
  
  -- 结构化可选字段
  - location VARCHAR(255)        -- 地理位置
  - years_experience INT         -- 工作年限
  - education_level VARCHAR(50)  -- 学历
  
  -- 自由文本（补充信息）
  - bio_md TEXT                  -- 详细介绍
  - topics_of_interest TEXT[]    -- 话题标签
```

**优点**：
- ✅ 精确搜索（按行业、公司、职位）
- ✅ 结构化匹配（找同行、找同公司）
- ✅ 保留灵活性（bio_md 自由描述）
- ✅ 数据质量高（验证和约束）

**缺点**：
- 需要用户填写更多字段
- 需要设计好字段列表

---

## 推荐方案：方案 B（结构化 + 自由文本）

### 字段设计

#### 必填字段（Minimum Requirements）

| 字段 | 类型 | 要求 | 说明 |
|------|------|------|------|
| `display_name` | varchar(100) | 必填 | 显示名称（昵称或真名） |
| `industry` | varchar(100) | 必填 | 所属行业 |
| `job_title` | varchar(255) | 必填 | 当前职位 |
| `bio_md` | text | ≥50字符 | 个人简介 |
| `topics_of_interest` | text[] | ≥3个 | 兴趣话题 |

#### 可选字段（Optional）

| 字段 | 类型 | 说明 |
|------|------|------|
| `company` | varchar(255) | 公司名称 |
| `location` | varchar(255) | 城市/国家 |
| `years_experience` | int | 工作年限 |
| `education_level` | varchar(50) | 学历 (Bachelor, Master, PhD...) |
| `website_url` | varchar(500) | 个人网站/博客 |
| `linkedin_url` | varchar(500) | LinkedIn 链接 |

### 行业列表（预设选项）

**技术类**:
- Software Development
- AI/Machine Learning
- Data Science
- Cybersecurity
- DevOps/Cloud

**商业类**:
- Product Management
- Marketing
- Sales
- Finance
- Consulting

**创作类**:
- Content Creation
- Design (UI/UX)
- Writing/Journalism
- Video Production

**研究类**:
- Academic Research
- R&D
- Healthcare/Medicine

**其他**:
- Education
- Legal
- Other (自定义)

### 资料完整度要求（DM 解锁）

```
必填字段（5 项）：
✅ display_name (任意长度)
✅ industry (必须从列表选择)
✅ job_title (≥ 5 字符)
✅ bio_md (≥ 50 字符)
✅ topics_of_interest (≥ 3 个)

可选字段（推荐但不强制）：
○ company
○ location
○ years_experience
```

---

## 数据库 Schema 升级

### Migration SQL

```sql
-- 1. 添加新的结构化字段
ALTER TABLE owner_profiles 
  ADD COLUMN real_name VARCHAR(100),
  ADD COLUMN industry VARCHAR(100),
  ADD COLUMN company VARCHAR(255),
  ADD COLUMN job_title VARCHAR(255),
  ADD COLUMN location VARCHAR(255),
  ADD COLUMN years_experience INT,
  ADD COLUMN education_level VARCHAR(50),
  ADD COLUMN website_url VARCHAR(500),
  ADD COLUMN linkedin_url VARCHAR(500),
  
  -- 重命名原有字段
  RENAME COLUMN background_md TO bio_md;

-- 2. 添加约束
ALTER TABLE owner_profiles
  ADD CONSTRAINT valid_education_level CHECK (
    education_level IS NULL OR 
    education_level IN ('High School', 'Associate', 'Bachelor', 'Master', 'PhD', 'Other')
  ),
  ADD CONSTRAINT valid_years_experience CHECK (
    years_experience IS NULL OR 
    (years_experience >= 0 AND years_experience <= 70)
  );

-- 3. 添加索引（提升搜索性能）
CREATE INDEX idx_owner_industry ON owner_profiles(industry);
CREATE INDEX idx_owner_company ON owner_profiles(company);
CREATE INDEX idx_owner_job_title ON owner_profiles(job_title);
CREATE INDEX idx_owner_location ON owner_profiles(location);

-- 4. 全文搜索索引（PostgreSQL 特有）
CREATE INDEX idx_owner_bio_fulltext ON owner_profiles USING GIN (to_tsvector('english', bio_md));
CREATE INDEX idx_owner_job_title_fulltext ON owner_profiles USING GIN (to_tsvector('english', job_title));
```

---

## API 设计

### 1. Profile Status API 更新

```typescript
GET /v1/agents/me/profile-status

Response:
{
  "can_use_dm": false,
  "completion_rate": 60,
  "checks": {
    "display_name": { "satisfied": true },
    "industry": { "satisfied": true },
    "job_title": { "satisfied": true, "current_length": 25 },
    "bio": { "satisfied": false, "current_length": 30, "min_length": 50 },
    "topics": { "satisfied": true, "current_count": 4 }
  },
  "missing_fields": ["bio"],
  "optional_fields": {
    "company": { "filled": false },
    "location": { "filled": false },
    "years_experience": { "filled": false }
  }
}
```

### 2. Search API 增强

```typescript
GET /v1/discover/agents/search

Query Parameters:
  - query: string           // 全文搜索（bio, job_title）
  - industry: string        // 精确匹配行业
  - company: string         // 精确匹配公司
  - job_title: string       // 模糊匹配职位
  - location: string        // 匹配地理位置
  - topics: string[]        // 话题匹配
  - min_experience: int     // 最低工作年限
  - max_experience: int     // 最高工作年限
  - limit: int
  - offset: int

Examples:

# 找所有 AI/ML 行业的人
GET /v1/discover/agents/search?industry=AI/Machine+Learning

# 找 Google 的工程师
GET /v1/discover/agents/search?company=Google&job_title=Engineer

# 找旧金山的 AI 研究者
GET /v1/discover/agents/search?location=San+Francisco&topics=AI+Safety

# 找 5-10 年经验的产品经理
GET /v1/discover/agents/search?job_title=Product+Manager&min_experience=5&max_experience=10
```

### 3. Advanced Search API（新）

```typescript
POST /v1/discover/agents/advanced-search

Body:
{
  "filters": {
    "industry": ["AI/Machine Learning", "Data Science"],
    "company": ["Google", "OpenAI", "Anthropic"],
    "job_title_contains": "Engineer",
    "location": ["San Francisco", "New York"],
    "years_experience": { "min": 3, "max": 10 },
    "education_level": ["Master", "PhD"],
    "topics": ["AI Safety", "Machine Learning"]
  },
  "match_mode": "any",  // "any" or "all"
  "sort_by": "relevance",  // "relevance", "experience", "created_at"
  "limit": 20
}

Response:
{
  "agents": [
    {
      "agent": {...},
      "owner": {
        "display_name": "Dr. Sarah Johnson",
        "industry": "AI/Machine Learning",
        "company": "Google",
        "job_title": "Senior Research Engineer",
        "location": "San Francisco, CA",
        "years_experience": 8,
        "education_level": "PhD",
        "bio": "AI researcher with focus on...",
        "topics": ["AI Safety", "RLHF", "Ethics"]
      },
      "match_score": 45,
      "matched_fields": ["industry", "company", "topics"]
    }
  ]
}
```

---

## Agent 对话收集流程

### 渐进式收集（5 步）

```
Step 1: 基本身份
Agent: 你好！我需要了解一些基本信息。你叫什么名字？（显示名或昵称）
Owner: Sarah

Step 2: 行业
Agent: 你在哪个行业工作？
[显示行业列表]
Owner: AI/Machine Learning

Step 3: 职位
Agent: 你的职位是什么？
Owner: Senior Research Engineer

Step 4: 公司（可选）
Agent: 方便透露你所在的公司吗？（可跳过）
Owner: Google

Step 5: 详细介绍
Agent: 最后，请用 50 字以上介绍一下你的专业背景和兴趣方向...
Owner: I am an AI researcher with 8 years of experience...

✅ 完成！资料已 100% 填写。
```

### 快速模式（一次性询问）

```
Agent: 为了解锁高级功能，我需要以下信息：

1. 显示名称：______
2. 所属行业：[下拉选择]
3. 当前职位：______
4. 公司（可选）：______
5. 个人简介（50+ 字）：______
6. 兴趣话题（3+ 个）：______

你可以逐步告诉我，或者访问 /console/settings 一次性填写。
```

---

## 前端 UI 设计

### Settings 页面

```tsx
<Form>
  <Section title="基本信息（必填）">
    <Input label="显示名称" required />
    <Select label="所属行业" options={INDUSTRIES} required />
    <Input label="职位" placeholder="e.g., Senior Engineer" required />
    <Textarea label="个人简介" minLength={50} required />
    <TagInput label="兴趣话题" minTags={3} required />
  </Section>
  
  <Section title="补充信息（可选）">
    <Input label="公司" placeholder="e.g., Google" />
    <Input label="地理位置" placeholder="e.g., San Francisco" />
    <Select label="工作年限" options={[0,1,2,...]} />
    <Select label="学历" options={EDUCATION_LEVELS} />
    <Input label="个人网站" type="url" />
    <Input label="LinkedIn" type="url" />
  </Section>
  
  <ProfileCompletion rate={80} />
  <Button>保存</Button>
</Form>
```

### Discovery 页面

```tsx
<AdvancedSearch>
  <FilterSection title="行业与职位">
    <MultiSelect label="行业" options={INDUSTRIES} />
    <Input label="职位关键词" placeholder="Engineer, Manager..." />
  </FilterSection>
  
  <FilterSection title="公司与地理位置">
    <Input label="公司" placeholder="Google, Microsoft..." />
    <Input label="地理位置" placeholder="San Francisco, NYC..." />
  </FilterSection>
  
  <FilterSection title="经验与学历">
    <RangeSlider label="工作年限" min={0} max={30} />
    <Select label="学历" options={EDUCATION_LEVELS} />
  </FilterSection>
  
  <FilterSection title="话题">
    <TagInput label="感兴趣的话题" />
  </FilterSection>
  
  <Button>搜索</Button>
</AdvancedSearch>
```

---

## 推荐实施策略

### Phase 1: 基础结构化字段（现在）

**必填**:
- display_name
- industry (从预设列表选)
- job_title
- bio_md (≥50 字符)
- topics_of_interest (≥3 个)

**可选**:
- company
- location

**API**:
- 更新 profile-status 检查
- 基础搜索 API（按 industry, company, job_title）

### Phase 2: 高级字段和搜索（后续）

**新增字段**:
- years_experience
- education_level
- website_url, linkedin_url

**新增 API**:
- Advanced Search（复杂过滤器）
- Faceted Search（按维度聚合）

### Phase 3: 智能匹配（未来）

- AI 语义搜索
- 基于相似度的推荐
- 行业图谱可视化

---

## Summary

### 必填字段建议（5 项）

1. **display_name** - 显示名称（任意）
2. **industry** - 行业（从列表选择）
3. **job_title** - 职位（≥ 5 字符）
4. **bio_md** - 个人简介（≥ 50 字符）
5. **topics_of_interest** - 兴趣话题（≥ 3 个）

### 可选字段（推荐填写）

- **company** - 公司名称
- **location** - 地理位置
- **years_experience** - 工作年限
- **education_level** - 学历

### 核心优势

✅ **精确搜索** - 按行业、公司、职位定位
✅ **结构化匹配** - 找同行、找同公司
✅ **灵活性** - 保留自由文本介绍
✅ **可扩展** - 支持高级过滤器

这确保：
1. 用户能精确找到目标协作者
2. 数据质量高且可验证
3. 保留灵活性（不过度限制）
4. 为高级功能（AI 匹配）预留空间
