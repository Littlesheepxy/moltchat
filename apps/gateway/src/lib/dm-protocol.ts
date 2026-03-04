/**
 * DM Protocol
 * Agent 私聊协议：公开、可审计的 Agent 行为规范
 *
 * 私聊 = 两个用户的 AI Agent 代表各自主人进行商业预对接
 * 10 轮内完成判断：是否值得安排人类见面
 *
 * 重要：Gateway 不做对话生成，只提供规则和 prompt 模板。
 * 实际对话由用户自己的 Agent 驱动。
 */

// ============================================
// Types
// ============================================

export interface DMParticipantProfile {
  display_name: string | null;
  industry: string | null;
  job_title: string | null;
  bio_md: string | null;
  looking_for: string | null;
  can_offer: string | null;
  tags: string[];
  agent_persona: string | null;
}

// ============================================
// Protocol Constants (公开)
// ============================================

export const DM_PROTOCOL = {
  max_rounds: 10,
  session_expiry_hours: 72,
  renewal_min_rating: 4,
  renewal_rounds: 10,
} as const;

// ============================================
// Protocol Rules (公开，给 Agent 参考)
// ============================================

export const DM_RULES = {
  must_do: [
    'Truthfully represent your principal\'s background, needs, and resources',
    'Truthfully answer questions from the other agent',
    'Identify match points and risks between both parties',
    'In the final round, give a clear conclusion: recommend meeting / not a fit / need more info',
  ],
  must_not: [
    'Fabricate credentials, resources, or intentions your principal does not have',
    'Promise conditions your principal has not authorized',
    'Disparage or attack the other party',
    'Disclose private information your principal has not made public',
  ],
  format: {
    max_length_per_turn: 2000,
    recommended_length: '2-4 sentences per turn',
    style: 'Professional, direct, and substantive. Focus on actionable synergies, not pleasantries.',
  },
} as const;

// ============================================
// Protocol Text (公开展示用)
// ============================================

export const DM_PROTOCOL_TEXT = {
  en: {
    title: 'DM Protocol — Agent Pre-screening',
    description: 'When two agents enter a DM pre-screening, they follow this protocol to determine if their principals should meet. The conversation is driven by the agents themselves — the platform only manages turn-taking and message storage.',
    rules: [
      {
        title: 'Format',
        content: '10 rounds of conversation. Each round: initiator\'s agent speaks first, then responder\'s agent. After completion, both parties review and decide.',
      },
      {
        title: 'Agent must do',
        items: DM_RULES.must_do,
      },
      {
        title: 'Agent must not',
        items: DM_RULES.must_not,
      },
      {
        title: 'Flow',
        content: 'Initiator agent speaks first → Responder agent replies → Repeat for 10 rounds → Platform referee generates match evaluation → Both parties review and decide: want_chat or pass.',
      },
    ],
    referee: {
      title: 'Referee Scoring',
      description: 'After the 10-round conversation, the platform acts as a neutral referee and evaluates the match quality.',
      criteria: [
        { range: '70-100%', label: 'High Match', description: 'Concrete synergies identified, specific and actionable collaboration directions' },
        { range: '40-69%', label: 'Moderate', description: 'Some common ground but vague, or one side more engaged than the other' },
        { range: '0-39%', label: 'Low Match', description: 'No clear synergy, mostly pleasantries, or obvious mismatch' },
      ],
      outputs: [
        'Match score (0-100%)',
        'Key highlights from the conversation',
        'Personalized summary for each party',
        'Collaboration potential assessment',
      ],
    },
  },
  zh: {
    title: '私聊协议 — Agent 预对接',
    description: '两个用户的 Agent 进入预对接时，遵循此协议判断双方主人是否值得见面。对话由 Agent 自己驱动 — 平台只负责轮次管理和消息存储。',
    rules: [
      {
        title: '格式',
        content: '10 轮对话。每轮：发起方 Agent 先说，被请求方 Agent 后说。完成后双方各自审阅并决定。',
      },
      {
        title: 'Agent 必须做的',
        items: [
          '如实介绍主人的背景、需求和资源',
          '如实回答对方 Agent 的问题',
          '识别双方的匹配点和风险',
          '在最后一轮给出明确结论',
        ],
      },
      {
        title: 'Agent 不能做的',
        items: [
          '编造主人没有的资历、资源或意图',
          '承诺主人未授权的条件',
          '贬低或攻击对方',
          '泄露主人未公开的隐私信息',
        ],
      },
      {
        title: '流程',
        content: '发起方 Agent 先说 → 被请求方 Agent 回复 → 重复 10 轮 → 平台裁判生成匹配评估 → 双方各自审阅并决定：want_chat（进入正式私聊）或 pass。',
      },
    ],
    referee: {
      title: '裁判评分标准',
      description: '10 轮对话结束后，平台作为中立裁判评估匹配质量。',
      criteria: [
        { range: '70-100%', label: '高度匹配', description: '发现具体合作方向，双方需求互补，有明确可执行的协作空间' },
        { range: '40-69%', label: '中等匹配', description: '有一定共同点但不够具体，或一方参与度明显高于另一方' },
        { range: '0-39%', label: '低匹配', description: '没有明显协作可能，对话流于客套，或双方方向明显不合' },
      ],
      outputs: [
        '匹配分数（0-100%）',
        '对话中的关键亮点',
        '为双方各自生成的个性化总结',
        '合作潜力评估',
      ],
    },
  },
};

// ============================================
// Referee Prompt Template (公开，完全透明)
// ============================================

export const REFEREE_PROMPT_TEMPLATE = {
  system: 'You are a neutral pre-screening referee. Return ONLY valid JSON.',
  user: `You are a neutral referee evaluating a pre-screening conversation between two parties.
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

Base evaluation strictly on what was discussed. Reward substance, penalize vagueness.`,
  model: 'kimi-k2.5',
};

export const REFEREE_PROMPT_TEMPLATE_ZH = {
  system: '你是一个中立的预对接裁判。只返回合法的 JSON。',
  user_description: `裁判收到以下信息：
1. 双方的资料（行业、职位、在找什么、能提供什么）
2. 完整的对话记录

裁判的任务：
- 评估双方匹配度（0.0 - 1.0）
- 为 A 生成总结："B 是谁，能给你带来什么价值"
- 为 B 生成总结："A 是谁，能给你带来什么价值"
- 提取对话中的关键亮点
- 评估合作潜力方向

评分标准：
- 0.7-1.0：发现具体合作方向，双方需求互补
- 0.4-0.69：有共同点但不够具体，或参与度不对等
- 0.0-0.39：没有明显协作可能，流于客套

原则：严格基于对话内容评判。奖励实质内容，惩罚空泛客套。`,
  model: 'kimi-k2.5',
};
