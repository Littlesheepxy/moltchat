/**
 * DM Exploration Engine
 * DM 专用 Agent-to-Agent 预对接引擎
 *
 * 重构后：Gateway 只做裁判，不做对话
 * - 创建 exploration 并设置为 in_progress
 * - 通过 assignments 通知双方 agent 轮流发言
 * - Agent 通过 /v1/agents/me/explorations/:id/respond 提交消息
 * - 10 轮结束后标记 completed，双方各自决定
 */

import { query, queryOne, queryMany } from '../db/client.js';
import { logger } from './logger.js';
import { callLLM } from './ai-exploration.js';
import { REFEREE_PROMPT_TEMPLATE } from './dm-protocol.js';

async function safeNotify(
  userId: string, type: string, title: string, content: string, metadata: Record<string, unknown>,
): Promise<void> {
  try {
    await query(
      `INSERT INTO agent_notifications (owner_user_id, type, title, content, metadata)
       VALUES ($1, $2, $3, $4, $5)`,
      [userId, type, title, content, JSON.stringify(metadata)],
    );
  } catch (err) {
    logger.warn({ err, userId, type }, 'Failed to send notification (non-blocking)');
  }
}

// ============================================
// Types
// ============================================

interface DMExplorationRow {
  id: string;
  user_a_id: string;
  user_b_id: string;
  agent_a_id: string | null;
  agent_b_id: string | null;
  max_rounds: number;
  origin_dm_request_id: string | null;
  room_id: string | null;
  source: string;
  status: string;
  total_rounds: number;
  current_turn: string | null;
}

// ============================================
// Core: Initialize DM Exploration (no LLM)
// ============================================

/**
 * Initialize a DM exploration — just set status and notify.
 * The actual conversation is driven by agents via respond endpoint.
 */
export async function initDMExploration(explorationId: string): Promise<void> {
  logger.info({ explorationId }, 'Initializing DM exploration (agent-driven)');

  const exploration = await queryOne<DMExplorationRow>(
    `SELECT id, user_a_id, user_b_id, agent_a_id, agent_b_id, max_rounds,
            origin_dm_request_id, room_id, source, status, total_rounds
     FROM ai_explorations WHERE id = $1 AND status = 'pending'`,
    [explorationId],
  );

  if (!exploration) {
    logger.warn({ explorationId }, 'DM exploration not found or not pending');
    return;
  }

  // Set to in_progress, initiator (A) goes first
  await query(
    `UPDATE ai_explorations SET status = 'in_progress', current_turn = 'A', updated_at = NOW() WHERE id = $1`,
    [explorationId],
  );

  // Get intent from originating DM request
  let intent: string | null = null;
  if (exploration.origin_dm_request_id) {
    const dmReq = await queryOne<{ intent: string }>(
      `SELECT intent FROM dm_requests WHERE id = $1`,
      [exploration.origin_dm_request_id],
    );
    intent = dmReq?.intent || null;
  }

  // Notify initiator (A): your turn to speak
  if (exploration.user_a_id) {
    await safeNotify(
      exploration.user_a_id,
      'exploration_your_turn',
      'Pre-screening Started — Your Turn',
      'You initiated a DM pre-screening. Please introduce yourself and your intent. Check assignments for details.',
      { exploration_id: explorationId, round: 1, your_side: 'A', intent },
    );
  }

  // Notify target (B): pre-screening started, waiting for A
  if (exploration.user_b_id) {
    await safeNotify(
      exploration.user_b_id,
      'exploration_started',
      'Pre-screening Started — Waiting for Other Party',
      'Someone wants to connect with you. Their agent will speak first. You\'ll be notified when it\'s your turn.',
      { exploration_id: explorationId, your_side: 'B', intent },
    );
  }

  logger.info({ explorationId, intent }, 'DM exploration initialized, waiting for agent A to respond');
}

// ============================================
// Agent responds in exploration
// ============================================

export async function handleExplorationRespond(
  explorationId: string,
  userId: string,
  agentId: string,
  content: string,
): Promise<{
  round: number;
  side: string;
  status: 'in_progress' | 'completed';
  your_turn: boolean;
  total_rounds: number;
  max_rounds: number;
}> {
  const exploration = await queryOne<DMExplorationRow>(
    `SELECT id, user_a_id, user_b_id, agent_a_id, agent_b_id,
            max_rounds, total_rounds, current_turn, status,
            origin_dm_request_id, source
     FROM ai_explorations WHERE id = $1`,
    [explorationId],
  );

  if (!exploration) {
    throw new Error('Exploration not found');
  }

  if (exploration.status !== 'in_progress') {
    throw new Error(`Exploration is ${exploration.status}, not in_progress`);
  }

  // Determine which side this user is
  const iAmA = exploration.user_a_id === userId;
  const iAmB = exploration.user_b_id === userId;
  if (!iAmA && !iAmB) {
    throw new Error('You are not a participant in this exploration');
  }
  const mySide = iAmA ? 'A' : 'B';

  // Check if it's my turn
  if (exploration.current_turn !== mySide) {
    throw new Error(`It's not your turn. Current turn: ${exploration.current_turn}`);
  }

  // Determine round number:
  // A speaks first in each round, then B. After B speaks, round increments.
  const currentRound = mySide === 'A'
    ? exploration.total_rounds + 1
    : exploration.total_rounds + 1;

  // For A: round = total_rounds + 1 (starting new round)
  // For B: round = total_rounds + 1 (completing current round)
  // total_rounds increments only after B speaks
  const roundNumber = exploration.total_rounds + 1;

  // Insert message
  await query(
    `INSERT INTO ai_exploration_messages (exploration_id, round_number, sender_side, agent_id, content)
     VALUES ($1, $2, $3, $4, $5)`,
    [explorationId, roundNumber, mySide, agentId, content],
  );

  // Determine next state
  let nextTurn: string;
  let newTotalRounds = exploration.total_rounds;
  let newStatus: 'in_progress' | 'completed' = 'in_progress';

  if (mySide === 'A') {
    // A just spoke, now B's turn (same round)
    nextTurn = 'B';
  } else {
    // B just spoke, this round is complete
    newTotalRounds = roundNumber;

    if (newTotalRounds >= exploration.max_rounds) {
      // All rounds done
      newStatus = 'completed';
      nextTurn = 'done';
    } else {
      // Next round, A's turn
      nextTurn = 'A';
    }
  }

  // Update exploration state
  if (newStatus === 'completed') {
    await query(
      `UPDATE ai_explorations
       SET total_rounds = $1, current_turn = NULL, status = 'completed', completed_at = NOW(), updated_at = NOW()
       WHERE id = $2`,
      [newTotalRounds, explorationId],
    );

    // Update dm_request status
    if (exploration.origin_dm_request_id) {
      await query(
        `UPDATE dm_requests SET status = 'screened' WHERE id = $1`,
        [exploration.origin_dm_request_id],
      );
    }

    // Referee: generate neutral summary for both parties (non-blocking)
    generateRefereeSummary(explorationId).catch(err => {
      logger.warn({ explorationId, err }, 'Referee summary generation failed (non-blocking)');
    });

    // Notify both parties: conversation complete, please decide
    for (const [uid, side] of [
      [exploration.user_a_id, 'A'],
      [exploration.user_b_id, 'B'],
    ] as const) {
      await safeNotify(
        uid,
        'exploration_completed',
        'Pre-screening Complete — Please Decide',
        `The ${newTotalRounds}-round pre-screening conversation is complete. Review the conversation and decide: want_chat or pass.`,
        { exploration_id: explorationId, total_rounds: newTotalRounds, your_side: side },
      );
    }

    logger.info({ explorationId, totalRounds: newTotalRounds }, 'DM exploration completed');
  } else {
    await query(
      `UPDATE ai_explorations SET total_rounds = $1, current_turn = $2, updated_at = NOW() WHERE id = $3`,
      [newTotalRounds, nextTurn, explorationId],
    );

    // Notify the other party: your turn
    const otherUserId = mySide === 'A' ? exploration.user_b_id : exploration.user_a_id;
    const otherSide = mySide === 'A' ? 'B' : 'A';

    await safeNotify(
      otherUserId,
      'exploration_your_turn',
      `Pre-screening Round ${nextTurn === 'A' ? newTotalRounds + 1 : roundNumber} — Your Turn`,
      'The other party has responded in the pre-screening conversation. It\'s your turn to reply. Check assignments for details.',
      { exploration_id: explorationId, round: nextTurn === 'A' ? newTotalRounds + 1 : roundNumber, your_side: otherSide },
    );
  }

  return {
    round: roundNumber,
    side: mySide,
    status: newStatus,
    your_turn: false,
    total_rounds: newTotalRounds,
    max_rounds: exploration.max_rounds,
  };
}

// ============================================
// Referee: Neutral Summary Generation
// ============================================

/**
 * Platform acts as neutral referee after conversation completes.
 * Reads the real agent-to-agent conversation and generates:
 * - summary_for_a (from A's perspective)
 * - summary_for_b (from B's perspective)
 * - match_score
 * - match_highlights
 *
 * This ensures both parties see consistent, fair evaluation.
 */
async function generateRefereeSummary(explorationId: string): Promise<void> {
  logger.info({ explorationId }, 'Generating referee summary');

  const exploration = await queryOne<{
    user_a_id: string; user_b_id: string;
  }>(
    `SELECT user_a_id, user_b_id FROM ai_explorations WHERE id = $1`,
    [explorationId],
  );
  if (!exploration) return;

  // Load profiles
  const profileA = await queryOne<{
    display_name: string; industry: string; job_title: string;
    looking_for: string; can_offer: string;
  }>(
    `SELECT display_name, industry, job_title, looking_for, can_offer
     FROM owner_profiles WHERE user_id = $1`,
    [exploration.user_a_id],
  );
  const profileB = await queryOne<{
    display_name: string; industry: string; job_title: string;
    looking_for: string; can_offer: string;
  }>(
    `SELECT display_name, industry, job_title, looking_for, can_offer
     FROM owner_profiles WHERE user_id = $1`,
    [exploration.user_b_id],
  );

  // Load conversation
  const messages = await queryMany<{
    round_number: number; sender_side: string; content: string;
  }>(
    `SELECT round_number, sender_side, content
     FROM ai_exploration_messages WHERE exploration_id = $1
     ORDER BY round_number, created_at`,
    [explorationId],
  );

  if (messages.length === 0) return;

  const nameA = profileA?.display_name || 'Party A';
  const nameB = profileB?.display_name || 'Party B';

  const conversationText = messages
    .map(m => `[Round ${m.round_number}] ${m.sender_side === 'A' ? nameA : nameB}: ${m.content}`)
    .join('\n');

  // Build prompt from the public template (REFEREE_PROMPT_TEMPLATE in dm-protocol.ts)
  const refereePrompt = REFEREE_PROMPT_TEMPLATE.user
    .replace(/\{name_a\}/g, nameA)
    .replace(/\{name_b\}/g, nameB)
    .replace('{industry_a}', profileA?.industry || 'Unknown')
    .replace('{role_a}', profileA?.job_title || 'Unknown')
    .replace('{looking_for_a}', profileA?.looking_for || 'Unknown')
    .replace('{can_offer_a}', profileA?.can_offer || 'Unknown')
    .replace('{industry_b}', profileB?.industry || 'Unknown')
    .replace('{role_b}', profileB?.job_title || 'Unknown')
    .replace('{looking_for_b}', profileB?.looking_for || 'Unknown')
    .replace('{can_offer_b}', profileB?.can_offer || 'Unknown')
    .replace('{message_count}', String(messages.length))
    .replace('{round_count}', String(Math.ceil(messages.length / 2)))
    .replace('{conversation}', conversationText);

  try {
    const raw = await callLLM(
      [
        { role: 'system', content: REFEREE_PROMPT_TEMPLATE.system },
        { role: 'user', content: refereePrompt },
      ],
      REFEREE_PROMPT_TEMPLATE.model,
    );

    const result = parseRefereeSummary(raw);

    await query(
      `UPDATE ai_explorations SET
         summary_for_a = $1, summary_for_b = $2,
         match_score = $3, match_highlights = $4,
         collaboration_potential = $5
       WHERE id = $6`,
      [
        result.summary_for_a,
        result.summary_for_b,
        result.match_score,
        JSON.stringify(result.match_highlights),
        result.collaboration_potential,
        explorationId,
      ],
    );

    logger.info({ explorationId, matchScore: result.match_score }, 'Referee summary generated');
  } catch (err) {
    logger.error({ explorationId, err }, 'Referee summary LLM call failed');
  }
}

function parseRefereeSummary(raw: string): {
  summary_for_a: string;
  summary_for_b: string;
  match_score: number;
  match_highlights: string[];
  collaboration_potential: string;
} {
  try {
    const parsed = JSON.parse(raw.replace(/```json\n?|\n?```/g, '').trim());
    return {
      summary_for_a: parsed.summary_for_a || 'Summary not available.',
      summary_for_b: parsed.summary_for_b || 'Summary not available.',
      match_score: Math.min(1, Math.max(0, Number(parsed.match_score) || 0.5)),
      match_highlights: Array.isArray(parsed.match_highlights) ? parsed.match_highlights.slice(0, 5) : [],
      collaboration_potential: parsed.collaboration_potential || 'See conversation for details.',
    };
  } catch {
    return {
      summary_for_a: 'Summary generation failed. Please review the conversation directly.',
      summary_for_b: 'Summary generation failed. Please review the conversation directly.',
      match_score: 0.5,
      match_highlights: [],
      collaboration_potential: 'See conversation for details.',
    };
  }
}
