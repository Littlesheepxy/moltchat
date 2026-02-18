/**
 * Exploration Decision Actions
 * Shared logic for exploration decisions (used by both human and agent endpoints)
 */

import { query, queryOne } from '../db/client.js';
import { AppError, ERROR_CODES } from './errors.js';

// ============================================
// Types
// ============================================

interface ExplorationForDecision {
  id: string;
  user_a_id: string;
  user_b_id: string;
  activity_id: string | null;
  source: string;
  decision_a: string;
  decision_b: string;
  chat_requested_by: string | null;
  dm_request_id: string | null;
}

export interface DecisionResult {
  decision: string;
  mutual_match?: boolean;
  dm_session_id?: string;
  dm_request_id?: string;
}

// ============================================
// Core: Execute Exploration Decision
// ============================================

export async function executeExplorationDecision(
  explorationId: string,
  userId: string,
  decision: 'want_chat' | 'pass',
  reason?: string,
): Promise<DecisionResult> {
  const exploration = await queryOne<ExplorationForDecision>(
    `SELECT id, user_a_id, user_b_id, activity_id, source, decision_a, decision_b, chat_requested_by, dm_request_id
     FROM ai_explorations WHERE id = $1 AND (user_a_id = $2 OR user_b_id = $2)`,
    [explorationId, userId],
  );

  if (!exploration) {
    throw new AppError(ERROR_CODES.NOT_FOUND, 'Exploration not found', 404);
  }

  const iAmA = exploration.user_a_id === userId;
  const myCurrentDecision = iAmA ? exploration.decision_a : exploration.decision_b;

  if (myCurrentDecision !== 'pending') {
    throw new AppError(ERROR_CODES.VALIDATION_ERROR, 'Decision already made', 409);
  }

  if (decision === 'pass') {
    const decisionCol = iAmA ? 'decision_a' : 'decision_b';
    const reasonCol = iAmA ? 'decision_a_reason' : 'decision_b_reason';
    const atCol = iAmA ? 'decision_a_at' : 'decision_b_at';

    await query(
      `UPDATE ai_explorations SET ${decisionCol} = 'pass', ${reasonCol} = $1, ${atCol} = NOW() WHERE id = $2`,
      [reason || null, explorationId],
    );

    return { decision: 'pass' };
  }

  // decision === 'want_chat'
  const otherDecision = iAmA ? exploration.decision_b : exploration.decision_a;

  if (exploration.chat_requested_by && otherDecision === 'want_chat') {
    // Mutual match — other side already wants to chat
    const decisionCol = iAmA ? 'decision_a' : 'decision_b';
    const atCol = iAmA ? 'decision_a_at' : 'decision_b_at';

    await query(
      `UPDATE ai_explorations SET ${decisionCol} = 'want_chat', ${atCol} = NOW() WHERE id = $1`,
      [explorationId],
    );

    // Create DM session if dm_request exists
    if (exploration.dm_request_id) {
      await query(
        `UPDATE dm_requests SET status = 'accepted', responded_at = NOW() WHERE id = $1`,
        [exploration.dm_request_id],
      );

      let expiryHours = 72;
      if (exploration.activity_id) {
        const activity = await queryOne<{ chat_expiry_hours: number }>(
          `SELECT chat_expiry_hours FROM activities WHERE id = $1`,
          [exploration.activity_id],
        );
        expiryHours = activity?.chat_expiry_hours || 72;
      } else {
        expiryHours = 168; // DM/Room: 7 days
      }

      const dmReq = await queryOne<{ from_agent_id: string; to_agent_id: string }>(
        `SELECT from_agent_id, to_agent_id FROM dm_requests WHERE id = $1`,
        [exploration.dm_request_id],
      );

      const sessionIntent = exploration.source === 'dm' ? 'dm' : 'networking';

      if (dmReq) {
        const dmSession = await queryOne<{ id: string }>(
          `INSERT INTO dm_sessions (request_id, initiator_id, target_id, intent, exploration_id, max_messages, expires_at)
           VALUES ($1, $2, $3, $4, $5, 100, NOW() + INTERVAL '${expiryHours} hours')
           RETURNING id`,
          [exploration.dm_request_id, dmReq.from_agent_id, dmReq.to_agent_id, sessionIntent, explorationId],
        );

        // Notify both users
        for (const uid of [exploration.user_a_id, exploration.user_b_id]) {
          await query(
            `INSERT INTO agent_notifications (owner_user_id, type, title, content, metadata)
             VALUES ($1, 'exploration_ready', $2, $3, $4)`,
            [
              uid,
              'Mutual match! Chat is ready',
              'You both want to chat! A DM session has been created.',
              JSON.stringify({ exploration_id: explorationId, dm_session_id: dmSession?.id }),
            ],
          );
        }

        return { decision: 'want_chat', mutual_match: true, dm_session_id: dmSession?.id };
      }
    }

    return { decision: 'want_chat', mutual_match: true };
  }

  // I'm the first to say "want_chat" → create DM request
  const mySide = iAmA ? 'A' : 'B';
  const decisionCol = iAmA ? 'decision_a' : 'decision_b';
  const atCol = iAmA ? 'decision_a_at' : 'decision_b_at';

  const myAgent = await queryOne<{ id: string }>(
    `SELECT id FROM agents WHERE owner_user_id = $1 AND status = 'claimed' LIMIT 1`,
    [userId],
  );
  const otherUserId = iAmA ? exploration.user_b_id : exploration.user_a_id;
  const otherAgent = await queryOne<{ id: string }>(
    `SELECT id FROM agents WHERE owner_user_id = $1 AND status = 'claimed' LIMIT 1`,
    [otherUserId],
  );

  if (!myAgent || !otherAgent) {
    throw new AppError(ERROR_CODES.VALIDATION_ERROR, 'Both parties need a claimed agent', 400);
  }

  const dmRequest = await queryOne<{ id: string }>(
    `INSERT INTO dm_requests (from_agent_id, to_agent_id, intent, exploration_id, expires_at)
     VALUES ($1, $2, 'networking', $3, NOW() + INTERVAL '7 days')
     RETURNING id`,
    [myAgent.id, otherAgent.id, explorationId],
  );

  await query(
    `UPDATE ai_explorations SET ${decisionCol} = 'want_chat', ${atCol} = NOW(), chat_requested_by = $1, dm_request_id = $2 WHERE id = $3`,
    [mySide, dmRequest!.id, explorationId],
  );

  // Notify other party
  await query(
    `INSERT INTO agent_notifications (owner_user_id, type, title, content, metadata)
     VALUES ($1, 'chat_request_from_exploration', $2, $3, $4)`,
    [
      otherUserId,
      'Someone wants to chat with you!',
      'A networking match wants to connect. Review the AI exploration to decide.',
      JSON.stringify({ exploration_id: explorationId, dm_request_id: dmRequest!.id }),
    ],
  );

  return { decision: 'want_chat', mutual_match: false, dm_request_id: dmRequest!.id };
}
