/**
 * AI Exploration Engine
 * AI 代理双向对话 → 摘要生成 → 匹配评分
 */

import { query, queryOne, queryMany } from '../db/client.js';
import { config } from './config.js';
import { logger } from './logger.js';
import { sanitizeField, wrapUserContent, sanitizeTags, SAFETY_PREAMBLE } from './sanitize-prompt.js';

// ============================================
// Types
// ============================================

interface ExplorationRow {
  id: string;
  activity_id: string;
  user_a_id: string;
  user_b_id: string;
  agent_a_id: string | null;
  agent_b_id: string | null;
  max_rounds: number;
}

interface ParticipantContext {
  user_id: string;
  display_name: string | null;
  industry: string | null;
  job_title: string | null;
  bio_md: string | null;
  roles: string[];
  looking_for: string | null;
  can_offer: string | null;
  tags: string[];
  agent_persona: string | null;
}

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface ExplorationResult {
  summary_for_a: string;
  summary_for_b: string;
  match_score: number;
  match_highlights: string[];
  collaboration_potential: string;
}

// ============================================
// LLM Client (lightweight, no SDK dependency)
// ============================================

export async function callLLM(messages: ChatMessage[], model: string = 'gpt-4o-mini'): Promise<string> {
  if (!config.openai.apiKey) {
    logger.warn('No OpenAI API key configured, using mock response');
    return mockLLMResponse(messages);
  }

  const response = await fetch(`${config.openai.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.openai.apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.8,
      max_tokens: 800,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    logger.error({ status: response.status, body: err }, 'LLM API error');
    throw new Error(`LLM API error: ${response.status}`);
  }

  const data = (await response.json()) as {
    choices: Array<{ message: { content: string } }>;
  };

  return data.choices[0]?.message?.content || '';
}

function mockLLMResponse(messages: ChatMessage[]): string {
  const last = messages[messages.length - 1];
  if (last?.content.includes('summary')) {
    return JSON.stringify({
      summary_for_a: 'Based on the exploration, the other participant shares complementary interests in technology and business development. They have relevant experience that could benefit your goals.',
      summary_for_b: 'The other participant is actively looking for connections in your area of expertise. Their background suggests strong potential for mutual value creation.',
      match_score: 0.75,
      match_highlights: [
        'Complementary skill sets',
        'Shared industry focus',
        'Aligned timing and goals',
      ],
      collaboration_potential: 'High potential for knowledge exchange and business collaboration.',
    });
  }
  return 'I find this topic quite interesting! Could you tell me more about your experience and what you are looking for?';
}

// ============================================
// Build context prompts
// ============================================

function buildAgentSystemPrompt(
  context: ParticipantContext,
  otherContext: ParticipantContext,
  side: 'A' | 'B',
  activityTheme: string | null
): string {
  // Sanitize all user-provided fields
  const industry = sanitizeField(context.industry, 'industry');
  const jobTitle = sanitizeField(context.job_title, 'job_title');
  const lookingFor = sanitizeField(context.looking_for, 'looking_for');
  const canOffer = sanitizeField(context.can_offer, 'can_offer');
  const bio = sanitizeField(context.bio_md, 'bio_md');
  const persona = sanitizeField(context.agent_persona, 'agent_persona');
  const tags = sanitizeTags(context.tags);

  const otherIndustry = sanitizeField(otherContext.industry, 'industry');
  const otherLookingFor = sanitizeField(otherContext.looking_for, 'looking_for');
  const otherTags = sanitizeTags(otherContext.tags);
  const otherRoles = otherContext.roles.map(r => sanitizeField(r, 'tag'));

  const theme = sanitizeField(activityTheme, 'theme');

  return `${SAFETY_PREAMBLE}

You are an AI networking agent representing a person in a professional matchmaking conversation.

YOUR PERSON'S PROFILE:
- Industry: ${wrapUserContent('industry', industry || 'Not specified')}
- Role: ${wrapUserContent('job_title', jobTitle || 'Not specified')}
- Looking for: ${wrapUserContent('looking_for', lookingFor || 'Open to connections')}
- Can offer: ${wrapUserContent('can_offer', canOffer || 'Professional experience')}
- Interests: ${tags.join(', ') || 'General'}
- Bio: ${wrapUserContent('bio', bio || 'No bio provided')}
${persona ? `- Agent personality: ${wrapUserContent('persona', persona)}` : ''}

THE OTHER PERSON'S VISIBLE PROFILE:
- Industry: ${wrapUserContent('other_industry', otherIndustry || 'Not specified')}
- Roles: ${otherRoles.join(', ')}
- Looking for: ${wrapUserContent('other_looking_for', otherLookingFor || 'Not specified')}
- Interests: ${otherTags.join(', ') || 'General'}

${theme ? `ACTIVITY THEME: ${wrapUserContent('theme', theme)}` : ''}

INSTRUCTIONS:
- Represent your person authentically based on their profile
- Explore mutual interests, potential collaboration, and shared goals
- Ask thoughtful questions to understand the other party better
- Share relevant information about your person's background and offerings
- Be professional but warm and engaging
- Keep responses concise (2-4 sentences)
- Focus on discovering actionable synergies, not just pleasantries
- You are side ${side} in this conversation`;
}

function buildSummaryPrompt(
  contextA: ParticipantContext,
  contextB: ParticipantContext,
  conversationHistory: { side: string; content: string }[]
): string {
  // Sanitize profile fields
  const aIndustry = sanitizeField(contextA.industry, 'industry');
  const aJobTitle = sanitizeField(contextA.job_title, 'job_title');
  const aLookingFor = sanitizeField(contextA.looking_for, 'looking_for');
  const aCanOffer = sanitizeField(contextA.can_offer, 'can_offer');

  const bIndustry = sanitizeField(contextB.industry, 'industry');
  const bJobTitle = sanitizeField(contextB.job_title, 'job_title');
  const bLookingFor = sanitizeField(contextB.looking_for, 'looking_for');
  const bCanOffer = sanitizeField(contextB.can_offer, 'can_offer');

  // Sanitize conversation content (each message is AI-generated but could echo injected content)
  const convoText = conversationHistory.map(m => {
    const cleaned = sanitizeField(m.content, 'bio_md'); // reuse bio_md limit (1000 chars)
    return `[${m.side === 'A' ? 'Person A' : 'Person B'}]: ${cleaned}`;
  }).join('\n');

  return `${SAFETY_PREAMBLE}

Analyze this networking exploration conversation and generate a structured report.

PERSON A:
- Industry: ${wrapUserContent('a_industry', aIndustry || 'N/A')}, Role: ${wrapUserContent('a_role', aJobTitle || 'N/A')}
- Looking for: ${wrapUserContent('a_looking_for', aLookingFor || 'N/A')}
- Can offer: ${wrapUserContent('a_can_offer', aCanOffer || 'N/A')}

PERSON B:
- Industry: ${wrapUserContent('b_industry', bIndustry || 'N/A')}, Role: ${wrapUserContent('b_role', bJobTitle || 'N/A')}
- Looking for: ${wrapUserContent('b_looking_for', bLookingFor || 'N/A')}
- Can offer: ${wrapUserContent('b_can_offer', bCanOffer || 'N/A')}

CONVERSATION:
${convoText}

Return a JSON object (no markdown wrapping) with exactly these fields:
{
  "summary_for_a": "2-3 sentence summary from Person A's perspective, highlighting what B can offer A",
  "summary_for_b": "2-3 sentence summary from Person B's perspective, highlighting what A can offer B",
  "match_score": 0.0 to 1.0 (how well they match based on complementary needs),
  "match_highlights": ["highlight 1", "highlight 2", "highlight 3"] (3 key synergies),
  "collaboration_potential": "1-2 sentence assessment of concrete collaboration opportunities"
}`;
}

// ============================================
// Core: Run AI Exploration
// ============================================

export async function runExploration(explorationId: string): Promise<void> {
  logger.info({ explorationId }, 'Starting AI exploration');

  // Load exploration
  const exploration = await queryOne<ExplorationRow>(
    `SELECT id, activity_id, user_a_id, user_b_id, agent_a_id, agent_b_id, max_rounds
     FROM ai_explorations WHERE id = $1 AND status = 'pending'`,
    [explorationId]
  );

  if (!exploration) {
    logger.warn({ explorationId }, 'Exploration not found or not pending');
    return;
  }

  // Mark as in_progress
  await query(`UPDATE ai_explorations SET status = 'in_progress' WHERE id = $1`, [explorationId]);

  try {
    // Load participant contexts
    const contextA = await loadParticipantContext(exploration.activity_id, exploration.user_a_id);
    const contextB = await loadParticipantContext(exploration.activity_id, exploration.user_b_id);

    if (!contextA || !contextB) {
      throw new Error('Could not load participant contexts');
    }

    // Get activity theme
    const activity = await queryOne<{ theme: string | null; ai_explore_model: string }>(
      `SELECT theme, ai_explore_model FROM activities WHERE id = $1`,
      [exploration.activity_id]
    );
    const model = activity?.ai_explore_model || 'gpt-4o-mini';

    // Build system prompts
    const systemA = buildAgentSystemPrompt(contextA, contextB, 'A', activity?.theme || null);
    const systemB = buildAgentSystemPrompt(contextB, contextA, 'B', activity?.theme || null);

    // Run conversation
    const conversationHistory: { side: string; content: string }[] = [];
    const messagesA: ChatMessage[] = [{ role: 'system', content: systemA }];
    const messagesB: ChatMessage[] = [{ role: 'system', content: systemB }];

    for (let round = 1; round <= exploration.max_rounds; round++) {
      // A's turn
      if (round === 1) {
        messagesA.push({ role: 'user', content: 'Start the conversation with an introduction and opening question.' });
      }

      const responseA = await callLLM(messagesA, model);
      conversationHistory.push({ side: 'A', content: responseA });

      // Save message
      await query(
        `INSERT INTO ai_exploration_messages (exploration_id, round_number, sender_side, agent_id, content)
         VALUES ($1, $2, 'A', $3, $4)`,
        [explorationId, round, exploration.agent_a_id, responseA]
      );

      // Add A's response to both contexts
      messagesA.push({ role: 'assistant', content: responseA });
      messagesB.push({ role: 'user', content: responseA });

      // B's turn
      const responseB = await callLLM(messagesB, model);
      conversationHistory.push({ side: 'B', content: responseB });

      await query(
        `INSERT INTO ai_exploration_messages (exploration_id, round_number, sender_side, agent_id, content)
         VALUES ($1, $2, 'B', $3, $4)`,
        [explorationId, round, exploration.agent_b_id, responseB]
      );

      messagesB.push({ role: 'assistant', content: responseB });
      messagesA.push({ role: 'user', content: responseB });

      // Update round count
      await query(`UPDATE ai_explorations SET total_rounds = $1 WHERE id = $2`, [round, explorationId]);
    }

    // Generate summary
    const summaryPrompt = buildSummaryPrompt(contextA, contextB, conversationHistory);
    const summaryRaw = await callLLM([
      { role: 'system', content: 'You are an expert networking analyst. Return ONLY valid JSON.' },
      { role: 'user', content: summaryPrompt },
    ], model);

    let result: ExplorationResult;
    try {
      // Try to parse, stripping potential markdown fences
      const cleaned = summaryRaw.replace(/```json\n?|\n?```/g, '').trim();
      result = JSON.parse(cleaned);
    } catch {
      logger.warn({ explorationId, summaryRaw }, 'Failed to parse summary JSON, using defaults');
      result = {
        summary_for_a: 'AI exploration completed. Review the conversation to learn more about this match.',
        summary_for_b: 'AI exploration completed. Review the conversation to learn more about this match.',
        match_score: 0.5,
        match_highlights: ['Conversation completed'],
        collaboration_potential: 'Please review the conversation for details.',
      };
    }

    // Update exploration with results
    await query(
      `UPDATE ai_explorations SET
         status = 'completed',
         summary_for_a = $1, summary_for_b = $2,
         match_score = $3, match_highlights = $4,
         collaboration_potential = $5,
         reveal_level_a = 1, reveal_level_b = 1,
         completed_at = NOW()
       WHERE id = $6`,
      [
        result.summary_for_a, result.summary_for_b,
        result.match_score, JSON.stringify(result.match_highlights),
        result.collaboration_potential,
        explorationId,
      ]
    );

    // Notify both users
    for (const userId of [exploration.user_a_id, exploration.user_b_id]) {
      await query(
        `INSERT INTO agent_notifications (owner_user_id, type, title, content, metadata)
         VALUES ($1, 'exploration_ready', $2, $3, $4)`,
        [
          userId,
          'AI Exploration Complete',
          'Your AI networking match is ready for review!',
          JSON.stringify({ exploration_id: explorationId, activity_id: exploration.activity_id }),
        ]
      );
    }

    logger.info({ explorationId, score: result.match_score }, 'AI exploration completed');
  } catch (error) {
    logger.error({ explorationId, error }, 'AI exploration failed');
    await query(`UPDATE ai_explorations SET status = 'failed' WHERE id = $1`, [explorationId]);
  }
}

// ============================================
// Load participant context
// ============================================

async function loadParticipantContext(
  activityId: string,
  userId: string
): Promise<ParticipantContext | null> {
  const row = await queryOne<{
    user_id: string;
    display_name: string | null;
    industry: string | null;
    job_title: string | null;
    bio_md: string | null;
    roles: string[];
    looking_for: string | null;
    can_offer: string | null;
    tags: string[];
    agent_persona_md: string | null;
  }>(
    `SELECT
       ap.user_id,
       op.display_name, op.industry, op.job_title, op.bio_md,
       ap.roles, ap.looking_for, ap.can_offer, ap.tags,
       aoc.agent_persona_md
     FROM activity_participants ap
     LEFT JOIN owner_profiles op ON op.user_id = ap.user_id
     LEFT JOIN agents a ON a.owner_user_id = ap.user_id AND a.status = 'claimed'
     LEFT JOIN agent_owner_config aoc ON aoc.agent_id = a.id
     WHERE ap.activity_id = $1 AND ap.user_id = $2
     LIMIT 1`,
    [activityId, userId]
  );

  if (!row) return null;

  return {
    user_id: row.user_id,
    display_name: row.display_name,
    industry: row.industry,
    job_title: row.job_title,
    bio_md: row.bio_md,
    roles: row.roles,
    looking_for: row.looking_for,
    can_offer: row.can_offer,
    tags: row.tags,
    agent_persona: row.agent_persona_md,
  };
}

// ============================================
// Batch runner: process all pending explorations
// ============================================

export async function runPendingExplorations(activityId: string): Promise<number> {
  const pending = await queryMany<{ id: string }>(
    `SELECT id FROM ai_explorations WHERE activity_id = $1 AND status = 'pending' ORDER BY match_score DESC NULLS LAST LIMIT 10`,
    [activityId]
  );

  logger.info({ activityId, count: pending.length }, 'Running pending explorations');

  let completed = 0;
  for (const exploration of pending) {
    try {
      await runExploration(exploration.id);
      completed++;
    } catch (error) {
      logger.error({ explorationId: exploration.id, error }, 'Failed to run exploration');
    }
  }

  return completed;
}
