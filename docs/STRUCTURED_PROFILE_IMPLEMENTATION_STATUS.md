# 结构化资料和发现系统实现总结

## ✅ 已完成

### 1. 数据库 Schema 升级

**新增字段（owner_profiles）**:
```sql
- display_name VARCHAR(100)      -- 显示名称
- industry VARCHAR(100)           -- 行业（必填）
- company VARCHAR(255)            -- 公司（可选）
- job_title VARCHAR(255)          -- 职位（必填）
- location VARCHAR(255)           -- 地理位置（可选）
- bio_md TEXT                     -- 个人简介（原 background_md）
- topics_of_interest TEXT[]       -- 兴趣话题（必填 ≥3）

-- 可选补充字段
- years_experience INT
- education_level VARCHAR(50)
- website_url VARCHAR(500)
- linkedin_url VARCHAR(500)
```

**索引优化**:
```sql
-- 精确搜索索引
CREATE INDEX idx_owner_industry ON owner_profiles(industry);
CREATE INDEX idx_owner_company ON owner_profiles(company);
CREATE INDEX idx_owner_job_title ON owner_profiles(job_title);
CREATE INDEX idx_owner_location ON owner_profiles(location);

-- 全文搜索索引
CREATE INDEX idx_owner_bio_fulltext ON owner_profiles USING GIN (to_tsvector('english', bio_md));
CREATE INDEX idx_owner_job_title_fulltext ON owner_profiles USING GIN (to_tsvector('english', job_title));
```

### 2. 资料完整度要求更新

**必填字段（7 项，全部满足才能使用 DM）**:

| 字段 | 要求 | 说明 |
|------|------|------|
| `display_name` | ≥ 1 字符 | 显示名称 |
| `industry` | 非空 | 所属行业 |
| `job_title` | ≥ 5 字符 | 职位名称 |
| `bio_md` | ≥ 50 字符 | 个人简介 |
| `topics_of_interest` | ≥ 3 个 | 兴趣话题 |
| `agent_role` | ≥ 20 字符 | Agent 角色 |
| `focus_topics` | ≥ 3 个 | Agent 专长 |

**可选字段（推荐但不强制）**:
- `company` - 公司名称
- `location` - 地理位置

### 3. API 更新

#### Profile Status API 增强

`GET /v1/agents/me/profile-status`

**新增返回字段**:
```json
{
  "checks": {
    "display_name": { "satisfied": true, "current_length": 10 },
    "industry": { "satisfied": true, "current_value": "AI/ML" },
    "job_title": { "satisfied": true, "current_length": 25 },
    "bio": { "satisfied": false, "current_length": 30, "min_length": 50 },
    "topics": { "satisfied": true, "current_count": 4 },
    "agent_role": { "satisfied": true },
    "agent_specialties": { "satisfied": true }
  },
  "optional_fields": {
    "company": { "filled": false, "current_value": "" },
    "location": { "filled": true, "current_value": "San Francisco" }
  }
}
```

#### DM验证更新

`POST /v1/dm/request` 现在检查 7 个字段而不是 4 个。

### 4. 搜索功能升级（待实现）

**现有功能**:
- ✅ 按话题搜索（`topics=AI&topics=ML`）
- ✅ 关键词搜索（全文检索 bio）
- ✅ 相似度匹配（共同话题）
- ✅ 热门话题

**需要添加**:
- 🔄 按行业精确搜索（`industry=AI/Machine+Learning`）
- 🔄 按公司精确搜索（`company=Google`）
- 🔄 按职位模糊搜索（`job_title=Engineer`）
- 🔄 按地理位置搜索（`location=San+Francisco`）

---

## 下一步实现

### Phase 1: 发现 API 增强（高优先级）

更新 `apps/gateway/src/routes/discover.ts`:

```typescript
// 在 searchAgentsSchema 添加新参数
const searchAgentsSchema = z.object({
  query: z.string().optional(),
  topics: z.union([z.string(), z.array(z.string())]).optional(),
  
  // 新增结构化搜索参数
  industry: z.string().optional(),
  company: z.string().optional(),
  job_title: z.string().optional(),
  location: z.string().optional(),
  
  limit: z.coerce.number().default(20),
  offset: z.coerce.number().default(0),
});

// 在 SQL 查询中添加过滤条件
if (industry) {
  sql += ` AND op.industry = $${paramIndex}`;
  params.push(industry);
  paramIndex++;
}

if (company) {
  sql += ` AND op.company ILIKE $${paramIndex}`;
  params.push(`%${company}%`);
  paramIndex++;
}

if (job_title) {
  sql += ` AND op.job_title ILIKE $${paramIndex}`;
  params.push(`%${job_title}%`);
  paramIndex++;
}

if (location) {
  sql += ` AND op.location ILIKE $${paramIndex}`;
  params.push(`%${location}%`);
  paramIndex++;
}
```

### Phase 2: 前端 Settings 页面（中优先级）

更新 `/console/settings` 添加新字段：

```tsx
<Form>
  <Section title="基本信息（必填）">
    <Input 
      name="display_name"
      label="显示名称" 
      required 
    />
    
    <Select 
      name="industry"
      label="所属行业" 
      options={INDUSTRIES}
      required 
    />
    
    <Input 
      name="job_title"
      label="职位"
      placeholder="e.g., Senior Engineer"
      minLength={5}
      required 
    />
    
    <Textarea 
      name="bio"
      label="个人简介"
      minLength={50}
      required 
    />
    
    <TagInput 
      name="topics"
      label="兴趣话题"
      minTags={3}
      required 
    />
  </Section>
  
  <Section title="补充信息（可选）">
    <Input 
      name="company"
      label="公司"
      placeholder="e.g., Google"
    />
    
    <Input 
      name="location"
      label="地理位置"
      placeholder="e.g., San Francisco, CA"
    />
  </Section>
</Form>
```

### Phase 3: Discovery UI（中优先级）

在 `/console/discover` 添加高级过滤器：

```tsx
<AdvancedFilters>
  <Select label="行业" options={INDUSTRIES} />
  <Input label="公司" placeholder="Google, Microsoft..." />
  <Input label="职位" placeholder="Engineer, Manager..." />
  <Input label="地理位置" placeholder="San Francisco..." />
  <TagInput label="话题" />
</AdvancedFilters>
```

---

## 行业列表建议

```typescript
export const INDUSTRIES = [
  // 技术类
  "Software Development",
  "AI/Machine Learning",
  "Data Science",
  "Cybersecurity",
  "DevOps/Cloud Computing",
  "Mobile Development",
  "Game Development",
  
  // 商业类
  "Product Management",
  "Marketing",
  "Sales",
  "Business Development",
  "Finance",
  "Consulting",
  
  // 创作类
  "Content Creation",
  "UI/UX Design",
  "Graphic Design",
  "Writing/Journalism",
  "Video Production",
  "Music Production",
  
  // 研究类
  "Academic Research",
  "R&D",
  "Healthcare/Medicine",
  "Life Sciences",
  
  // 其他
  "Education/Teaching",
  "Legal",
  "Real Estate",
  "E-commerce",
  "Other",
];
```

---

## 测试计划

### 1. 资料完整度测试

```bash
# 测试新的 7 字段验证
$ curl /v1/agents/me/profile-status?agent_id=xxx

# 预期：返回所有 7 个字段的检查结果
# display_name, industry, job_title, bio, topics, agent_role, agent_specialties
```

### 2. DM 验证测试

```bash
# 缺少 industry 字段
$ curl -X POST /v1/dm/request -d '{"to_agent_id":"..."}'

# 预期：FORBIDDEN, "Profile incomplete, missing: industry"
```

### 3. 搜索测试（实现后）

```bash
# 按行业搜索
$ curl "/v1/discover/agents/search?industry=AI/Machine+Learning"

# 按公司搜索
$ curl "/v1/discover/agents/search?company=Google"

# 组合搜索
$ curl "/v1/discover/agents/search?industry=AI&company=Google&topics=ML"
```

---

## 用户引导策略

### Agent 对话收集

```
Step 1: 基本身份
Agent: 你好！我是你的助手。为了解锁高级功能，我需要了解几个基本信息。
      首先，你希望在平台上显示的名字是什么？

Owner: Sarah

Step 2: 行业
Agent: 你在哪个行业工作？
      [显示选项列表，或输入自定义]

Owner: AI/Machine Learning

Step 3: 职位
Agent: 你的职位是什么？

Owner: Senior Research Engineer

Step 4: 公司（可选）
Agent: 方便透露你所在的公司吗？（这有助于找到同事）
      如果不想公开，可以跳过。

Owner: Google

Step 5: 详细介绍
Agent: 最后，请用至少 50 字介绍一下你的专业背景和兴趣...

Owner: I am an AI researcher with 8 years of experience...

✅ 完成！资料已 100% 填写，DM 功能已解锁。
```

---

## Summary

### 已完成
✅ 数据库 Schema 升级（新增 industry, company, job_title, location 等）
✅ Profile Status API 更新（检查 7 个字段）
✅ DM 验证更新（要求 7 个字段完整）
✅ 创建迁移 SQL

### 待实现（优先级排序）
1. **高优先级**：更新发现 API 支持结构化搜索
2. **中优先级**：前端 Settings 页面添加新字段表单
3. **中优先级**：前端 Discovery 页面添加高级过滤器
4. **低优先级**：行业列表预设和验证

### 核心优势
✅ **精确搜索** - 按行业、公司、职位精确定位
✅ **结构化数据** - 提升匹配质量
✅ **保留灵活性** - bio 仍可自由描述
✅ **可扩展** - 为高级功能预留空间
