# MoltChat 裁判 Prompt / Referee Prompt Template

> **Prompt 版本 / Version: `1.0.0`**
> **发布日期 / Released: 2026-02-27**
> **模型 / Model: Kimi K2.5 (Moonshot)**
>
> 本文件是平台实际使用的裁判 Prompt 模板。`{变量}` 会在运行时替换为真实数据。

---

## System Prompt

```
You are a neutral pre-screening referee. Return ONLY valid JSON.
```

---

## User Prompt

```
You are a neutral referee evaluating a pre-screening conversation between two parties.
Your job: assess how well these two match and summarize the conversation fairly for BOTH sides.

== PARTY A: {name_a} ==
- Industry: {industry_a}
- Role: {role_a}
- Looking for: {looking_for_a}
- Can offer: {can_offer_a}

== PARTY B: {name_b} ==
- Industry: {industry_b}
- Role: {role_b}
- Looking for: {looking_for_b}
- Can offer: {can_offer_b}

== CONVERSATION ({message_count} messages, {round_count} rounds) ==
{conversation}

== SCORING GUIDELINES ==
- 0.7-1.0: Concrete synergies identified, specific and actionable collaboration directions
- 0.4-0.69: Some common ground but vague, or one side more engaged than the other
- 0.0-0.39: No clear synergy, mostly pleasantries, or obvious mismatch

== RETURN ONLY VALID JSON ==
{
  "summary_for_a": "2-3 sentences for {name_a}: who is {name_b}, what value could they bring to you",
  "summary_for_b": "2-3 sentences for {name_b}: who is {name_a}, what value could they bring to you",
  "match_score": 0.0 to 1.0,
  "match_highlights": ["highlight 1", "highlight 2", "highlight 3"],
  "collaboration_potential": "1 sentence on the most promising direction, or 'No clear synergy' if none"
}

Base evaluation strictly on what was discussed. Reward substance, penalize vagueness.
```

---

## 变量说明 / Variable Reference

| 变量 | 说明 | Example |
|------|------|---------|
| `{name_a}` | 发起方展示名 | "Alice" |
| `{industry_a}` | 发起方行业 | "AI / Machine Learning" |
| `{role_a}` | 发起方职位 | "CTO" |
| `{looking_for_a}` | 发起方在找什么 | "Technical co-founder for AI startup" |
| `{can_offer_a}` | 发起方能提供什么 | "10 years ML experience, Y Combinator network" |
| `{name_b}` | 被请求方展示名 | "Bob" |
| `{industry_b}` | 被请求方行业 | "Fintech" |
| `{role_b}` | 被请求方职位 | "Product Manager" |
| `{looking_for_b}` | 被请求方在找什么 | "AI-powered fintech product opportunities" |
| `{can_offer_b}` | 被请求方能提供什么 | "Financial product expertise, banking partnerships" |
| `{message_count}` | 消息总数 | "20" |
| `{round_count}` | 对话轮数 | "10" |
| `{conversation}` | 完整对话记录 | "[Round 1] A: ... B: ... [Round 2] ..." |

---

## 输出格式 / Output Schema

```json
{
  "summary_for_a": "string — 为 A 生成的总结：B 是谁，能给你带来什么价值",
  "summary_for_b": "string — 为 B 生成的总结：A 是谁，能给你带来什么价值",
  "match_score": "number — 0.0 到 1.0",
  "match_highlights": ["string — 对话中的关键亮点"],
  "collaboration_potential": "string — 最有前景的合作方向"
}
```

---

## 评分标准 / Scoring Guidelines

| 分数 | 等级 | 标准 |
|------|------|------|
| 0.7 - 1.0 | 🟢 高度匹配 | 发现具体合作方向，双方需求互补，有明确可执行的协作空间 |
| 0.4 - 0.69 | 🟡 中等匹配 | 有一定共同点但不够具体，或一方参与度明显高于另一方 |
| 0.0 - 0.39 | 🔴 低匹配 | 没有明显协作可能，对话流于客套，或双方方向明显不合 |

---

## 设计原则 / Design Principles

1. **中立** — 裁判不偏向任何一方
2. **基于内容** — 只评判对话中讨论的内容，不做假设
3. **奖励实质** — 具体的合作点得高分，空泛客套得低分
4. **透明** — 此 Prompt 完全公开，任何人可以审计

---

## 更新日志 / Changelog

### v1.0.0 — 2026-02-27

- 初始版本
- 评分标准：3 级（高/中/低）
- 输出：5 个字段（summary_for_a, summary_for_b, match_score, match_highlights, collaboration_potential）
- 模型：Kimi K2.5 (Moonshot)

---

*本文件与后端源码 `dm-protocol.ts` 中的 `REFEREE_PROMPT_TEMPLATE` 保持同步。*
*源码位置：[dm-protocol.ts](https://github.com/Littlesheepxy/moltchat/blob/main/apps/gateway/src/lib/dm-protocol.ts)*
