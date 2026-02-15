-- ============================================
-- Migration 010: Protocol Rules & Transparency
-- ============================================
-- 规则透明化：版本化规则、AI Prompt 模板、社区反馈
-- ============================================

-- 1. Protocol Rules — 版本化协议规则
CREATE TABLE IF NOT EXISTS protocol_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_key VARCHAR(50) NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    title VARCHAR(200) NOT NULL,
    content_md TEXT NOT NULL,
    change_summary TEXT,
    changed_by UUID,
    is_current BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(rule_key, version)
);

CREATE INDEX IF NOT EXISTS idx_protocol_rules_current
    ON protocol_rules(rule_key) WHERE is_current = TRUE;

-- 2. AI Prompt Templates — 版本化 AI 提示词模板
CREATE TABLE IF NOT EXISTS ai_prompt_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prompt_key VARCHAR(50) NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    title VARCHAR(200) NOT NULL,
    template_md TEXT NOT NULL,
    variables JSONB DEFAULT '[]',
    change_summary TEXT,
    is_current BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(prompt_key, version)
);

CREATE INDEX IF NOT EXISTS idx_ai_prompt_templates_current
    ON ai_prompt_templates(prompt_key) WHERE is_current = TRUE;

-- 3. Rule Feedback — 社区反馈
CREATE TABLE IF NOT EXISTS rule_feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_id UUID NOT NULL REFERENCES protocol_rules(id),
    user_id UUID NOT NULL,
    feedback_type VARCHAR(20) NOT NULL DEFAULT 'suggestion',
    content TEXT NOT NULL,
    upvotes INTEGER NOT NULL DEFAULT 0,
    downvotes INTEGER NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'open',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT valid_feedback_type CHECK (feedback_type IN ('suggestion', 'question', 'concern')),
    CONSTRAINT valid_feedback_status CHECK (status IN ('open', 'acknowledged', 'implemented', 'declined'))
);

CREATE INDEX IF NOT EXISTS idx_rule_feedback_rule
    ON rule_feedback(rule_id, created_at DESC);

-- 4. Rule Feedback Votes — 每人每条反馈只能投一次
CREATE TABLE IF NOT EXISTS rule_feedback_votes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    feedback_id UUID NOT NULL REFERENCES rule_feedback(id),
    user_id UUID NOT NULL,
    vote SMALLINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    UNIQUE(feedback_id, user_id),
    CONSTRAINT valid_vote CHECK (vote IN (-1, 1))
);

-- 5. Seed initial protocol rules (inline for auto-migration)
INSERT INTO protocol_rules (rule_key, version, title, content_md, change_summary) VALUES
('attention_budget', 1, '注意力预算 / Attention Budget',
'## 注意力预算

每个用户每周有固定的触达额度：

| 参数 | 默认值 | 说明 |
|------|--------|------|
| 发送上限 (outbound_limit) | 5 | 每周最多发送 5 个 DM 请求 |
| 接收上限 (inbound_limit) | 5 | 每周最多接收 5 个 DM 请求 |

### 声誉加成

| 声誉分 | 额外额度 |
|--------|---------|
| >= 150 | +2 |
| >= 120 | +1 |
| < 120 | 无加成 |

超额自动拒绝，高声誉用户获得更多机会。',
'Initial version'),

('reputation_points', 1, '声誉积分规则 / Reputation Points',
'## 声誉积分

初始分数：**100 分**

| 事件 | 分数变动 |
|------|---------|
| 触达被接受 (outreach_accepted) | +5 |
| 触达被拒绝 (outreach_rejected) | -3 |
| 押金兑现 (stake_fulfilled) | +10 |
| 押金违约 (stake_forfeited) | -15 |
| 聊后正评 (rating >= 4) | +5 |
| 聊后差评 (rating <= 2) | -10 |

优质行为 → 分数上升 → 更多额度 → 更低门槛。
劣质行为 → 分数下降 → 冷却期。',
'Initial version'),

('alignment_scoring', 1, '对齐度评分 / Alignment Scoring',
'## 对齐度评分

阈值：**>= 0.65** 才能发起 DM 请求

### 评分维度

| 维度 | 权重 | 说明 |
|------|------|------|
| 意图匹配 (intent_match) | 30% | 角色互补度（如投资人-创业者） |
| 价值交换 (value_exchange) | 15% | 需求与供给的文本重叠 |
| 行业重叠 (industry_overlap) | 15% | 同行业加分 |
| 标签重叠 (tag_overlap) | 10% | 兴趣标签 Jaccard 相似度 |
| 行为历史 (behavior_history) | 30% | 声誉分转换为 0-1 分数 |

如果存在 AI 探索记录，直接使用 `match_score`（权重 70%）+ 行为历史（权重 30%）。',
'Initial version'),

('stake_types', 1, '触达押金 / Outreach Stake',
'## 触达押金

每次发起 DM 请求可附加押金（可选）：

### 三种类型

1. **承诺押金 (commitment)**
   - 承诺为对方做一件小事（如分析、Demo、引荐）
   - 需要描述承诺内容

2. **时间押金 (time)**
   - 愿意先回答对方的验证问题
   - 证明你的诚意

3. **声誉押金 (reputation)**
   - 质押 1-50 点声誉分
   - 对方评分高 → 返还；评分低 → 扣除

### 解析规则
- 聊后评分 >= 4 → 押金兑现（fulfilled），声誉 +10
- 聊后评分 <= 2 → 押金违约（forfeited），声誉 -15
- 评分 3 → 无操作（returned）',
'Initial version'),

('cooldown_rules', 1, '冷却期规则 / Cooldown Rules',
'## 冷却期

当声誉分降到 **50 以下** 时，自动触发 **7 天冷却期**。

冷却期内：
- 无法发起新的 DM 请求
- 无法参与 AI 探索
- 可以接收和响应已有的请求

冷却期结束后自动解除。',
'Initial version')

ON CONFLICT (rule_key, version) DO NOTHING;

-- 6. Seed initial AI prompt templates
INSERT INTO ai_prompt_templates (prompt_key, version, title, template_md, variables) VALUES
('exploration_system', 1, 'AI 探索系统提示词 / Exploration System Prompt',
'```
You are an AI networking agent representing a person
in a professional matchmaking conversation.

YOUR PERSON''S PROFILE:
- Industry: {industry}
- Role: {job_title}
- Looking for: {looking_for}
- Can offer: {can_offer}
- Interests: {tags}
- Bio: {bio}
- Agent personality: {persona}

THE OTHER PERSON''S VISIBLE PROFILE:
- Industry: {other_industry}
- Roles: {other_roles}
- Looking for: {other_looking_for}
- Interests: {other_tags}

INSTRUCTIONS:
- Represent your person authentically
- Explore mutual interests and collaboration opportunities
- Ask thoughtful questions
- Be professional but warm
- Keep responses concise (2-4 sentences)
- Focus on actionable synergies
```

所有用户字段经过防注入处理后插入，用 XML 标签隔离。',
'["industry", "job_title", "looking_for", "can_offer", "tags", "bio", "persona", "other_industry", "other_roles", "other_looking_for", "other_tags"]'::JSONB),

('exploration_summary', 1, 'AI 探索摘要提示词 / Exploration Summary Prompt',
'```
Analyze this networking exploration conversation
and generate a structured report.

PERSON A: {a_profile}
PERSON B: {b_profile}

CONVERSATION:
{conversation}

Return JSON with:
- summary_for_a: 2-3 句 A 视角的摘要
- summary_for_b: 2-3 句 B 视角的摘要
- match_score: 0.0-1.0
- match_highlights: 3 个关键互补点
- collaboration_potential: 1-2 句合作评估
```',
'["a_profile", "b_profile", "conversation"]'::JSONB)

ON CONFLICT (prompt_key, version) DO NOTHING;
