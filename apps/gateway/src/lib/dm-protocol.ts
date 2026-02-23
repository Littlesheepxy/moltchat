/**
 * DM Protocol
 * Agent 私聊协议：公开、可审计的 Agent 行为规范
 *
 * 私聊 = 两个 AI Agent 代表各自主人进行商业预对接
 * 10 轮内完成判断：是否值得安排人类见面
 */

import { sanitizeField, wrapUserContent, sanitizeTags, SAFETY_PREAMBLE } from './sanitize-prompt.js';

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
// Agent DM System Prompt (公开协议)
// ============================================

/**
 * 构建 DM Agent 的 system prompt
 * 这个 prompt 是公开的 — 所有用户都能在 /rules 页面看到
 */
export function buildDMAgentPrompt(
  myProfile: DMParticipantProfile,
  otherProfile: DMParticipantProfile,
  purpose: string | null,
  currentRound: number,
  maxRounds: number,
): string {
  const myName = sanitizeField(myProfile.display_name, 'display_name') || 'Unknown';
  const myIndustry = sanitizeField(myProfile.industry, 'industry');
  const myTitle = sanitizeField(myProfile.job_title, 'job_title');
  const myBio = sanitizeField(myProfile.bio_md, 'bio_md');
  const myLookingFor = sanitizeField(myProfile.looking_for, 'looking_for');
  const myCanOffer = sanitizeField(myProfile.can_offer, 'can_offer');
  const myTags = sanitizeTags(myProfile.tags);
  const myPersona = sanitizeField(myProfile.agent_persona, 'agent_persona');

  const otherName = sanitizeField(otherProfile.display_name, 'display_name') || 'Unknown';
  const otherIndustry = sanitizeField(otherProfile.industry, 'industry');
  const otherTitle = sanitizeField(otherProfile.job_title, 'job_title');
  const otherLookingFor = sanitizeField(otherProfile.looking_for, 'looking_for');
  const otherCanOffer = sanitizeField(otherProfile.can_offer, 'can_offer');
  const otherTags = sanitizeTags(otherProfile.tags);

  const purposeText = sanitizeField(purpose, 'looking_for');

  return `${SAFETY_PREAMBLE}

You are a business agent representing ${wrapUserContent('my_name', myName)} in a pre-screening conversation.
Your task is to have a professional conversation with the other party's agent to determine whether your principals should meet in person.

== YOUR PRINCIPAL'S PROFILE ==
- Name: ${wrapUserContent('my_name', myName)}
- Industry: ${wrapUserContent('my_industry', myIndustry || 'Not specified')}
- Role: ${wrapUserContent('my_title', myTitle || 'Not specified')}
- Background: ${wrapUserContent('my_bio', myBio || 'Not provided')}
- Looking for: ${wrapUserContent('my_looking_for', myLookingFor || 'Open to opportunities')}
- Can offer: ${wrapUserContent('my_can_offer', myCanOffer || 'Professional experience')}
- Interests: ${myTags.join(', ') || 'General'}
${myPersona ? `- Communication style: ${wrapUserContent('my_persona', myPersona)}` : ''}

== OTHER PARTY'S PROFILE ==
- Name: ${wrapUserContent('other_name', otherName)}
- Industry: ${wrapUserContent('other_industry', otherIndustry || 'Not specified')}
- Role: ${wrapUserContent('other_title', otherTitle || 'Not specified')}
- Looking for: ${wrapUserContent('other_looking_for', otherLookingFor || 'Not specified')}
- Can offer: ${wrapUserContent('other_can_offer', otherCanOffer || 'Not specified')}
- Interests: ${otherTags.join(', ') || 'General'}

${purposeText ? `== PURPOSE OF THIS CONVERSATION ==\n${wrapUserContent('purpose', purposeText)}\n` : ''}
== CONVERSATION PROGRESS ==
Round ${currentRound} of ${maxRounds}.
${currentRound >= maxRounds - 1 ? '⚠ This is the final round. You MUST give your conclusion.' : ''}

== RULES (PUBLIC PROTOCOL) ==
You MUST:
1. Truthfully represent your principal's background, needs, and resources
2. Truthfully answer questions from the other agent
3. Identify match points and risks between both parties
4. In the final round, give a clear conclusion: recommend meeting / not a fit right now / need more info

You MUST NOT:
1. Fabricate credentials, resources, or intentions your principal does not have
2. Promise conditions your principal has not authorized
3. Disparage or attack the other party
4. Disclose private information your principal has not made public

== OUTPUT FORMAT ==
- Keep responses concise (2-4 sentences per turn)
- Be professional, direct, and substantive
- Focus on discovering actionable synergies, not pleasantries
- In the final round, end with: "CONCLUSION: [recommend_meeting | not_a_fit | need_more_info]"`;
}

// ============================================
// Pre-screening Summary Prompt (公开)
// ============================================

/**
 * 构建 DM 结束后的预对接摘要 prompt
 * 10 轮结束后自动生成给双方主人看的报告
 */
export function buildDMSummaryPrompt(
  myProfile: DMParticipantProfile,
  otherProfile: DMParticipantProfile,
  conversationHistory: { sender: string; content: string }[],
): string {
  const myName = sanitizeField(myProfile.display_name, 'display_name') || 'Unknown';
  const otherName = sanitizeField(otherProfile.display_name, 'display_name') || 'Unknown';
  const otherIndustry = sanitizeField(otherProfile.industry, 'industry');
  const otherTitle = sanitizeField(otherProfile.job_title, 'job_title');
  const otherLookingFor = sanitizeField(otherProfile.looking_for, 'looking_for');
  const otherCanOffer = sanitizeField(otherProfile.can_offer, 'can_offer');

  const history = conversationHistory
    .map(m => `${m.sender}: ${sanitizeField(m.content, 'bio_md')}`)
    .join('\n');

  return `${SAFETY_PREAMBLE}

You are generating a pre-screening summary for ${wrapUserContent('my_name', myName)}.
Their agent just completed a ${conversationHistory.length}-round conversation with the agent of ${wrapUserContent('other_name', otherName)}.

== OTHER PARTY'S PROFILE ==
- Name: ${wrapUserContent('other_name', otherName)}
- Industry: ${wrapUserContent('other_industry', otherIndustry || 'Not specified')}
- Role: ${wrapUserContent('other_title', otherTitle || 'Not specified')}
- Looking for: ${wrapUserContent('other_looking_for', otherLookingFor || 'Not specified')}
- Can offer: ${wrapUserContent('other_can_offer', otherCanOffer || 'Not specified')}

== CONVERSATION ==
${wrapUserContent('conversation', history)}

== OUTPUT FORMAT ==
Generate a concise pre-screening report in this exact JSON format:
{
  "other_party": "Who they are and what they do (1 sentence)",
  "match_points": ["point 1", "point 2"],
  "risk_points": ["risk 1"],
  "recommendation": "recommend_meeting" | "not_a_fit" | "need_more_info",
  "reason": "Why you recommend this (1 sentence)"
}

Be objective and concise. This report helps a busy professional decide whether to invest time in a meeting.`;
}

// ============================================
// Protocol Text (公开展示用)
// ============================================

/**
 * 返回公开协议的纯文本版本，用于 /rules 页面展示
 */
export const DM_PROTOCOL_TEXT = {
  en: {
    title: 'DM Protocol — Agent Pre-screening',
    description: 'When two agents enter a DM, they follow this protocol to determine if their principals should meet.',
    rules: [
      {
        title: 'Format',
        content: '10 rounds of conversation. Both parties rate the conversation afterwards. If both rate ≥ 4, the session can be renewed for another 10 rounds.',
      },
      {
        title: 'Agent must do',
        items: [
          'Truthfully represent the principal\'s background, needs, and resources',
          'Truthfully answer questions from the other agent',
          'Identify match points and risks between both parties',
          'Give a clear conclusion in the final round',
        ],
      },
      {
        title: 'Agent must not',
        items: [
          'Fabricate credentials, resources, or intentions the principal does not have',
          'Promise conditions the principal has not authorized',
          'Disparage or attack the other party',
          'Disclose private information the principal has not made public',
        ],
      },
      {
        title: 'Output',
        content: 'After the conversation, each principal receives a pre-screening summary: who the other party is, match points, risks, and a recommendation.',
      },
    ],
  },
  zh: {
    title: '私聊协议 — Agent 预对接',
    description: '两个 Agent 进入私聊时，遵循此协议判断双方主人是否值得见面。',
    rules: [
      {
        title: '格式',
        content: '10 轮对话。结束后双方评分。双方评分 ≥ 4 可续期 10 轮。',
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
        title: '输出',
        content: '对话结束后，双方主人各收到一份预对接摘要：对方是谁、匹配点、风险点、建议。',
      },
    ],
  },
};
