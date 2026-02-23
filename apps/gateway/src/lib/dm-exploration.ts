/**
 * DM Exploration Engine
 * DM 专用 Agent-to-Agent 预对接引擎
 *
 * 复用 ai-exploration.ts 的 callLLM，但用 dm-protocol.ts 的 prompt
 * 不依赖 activity_participants — 直接从 owner_profiles 加载
 */

import { query, queryOne } from '../db/client.js';
import { logger } from './logger.js';
import { callLLM } from './ai-exploration.js';
import {
  buildDMAgentPrompt,
  buildDMSummaryPrompt,
  DM_PROTOCOL,
  type DMParticipantProfile,
} from './dm-protocol.js';

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
}

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

// ============================================
// Core: Run DM Pre-screening
// ============================================

export async function runDMExploration(explorationId: string): Promise<void> {
  logger.info({ explorationId }, 'Starting DM pre-screening');

  const exploration = await queryOne<DMExplorationRow>(
    `SELECT id, user_a_id, user_b_id, agent_a_id, agent_b_id, max_rounds, origin_dm_request_id, room_id, source
     FROM ai_explorations WHERE id = $1 AND status = 'pending'`,
    [explorationId],
  );

  if (!exploration) {
    logger.warn({ explorationId }, 'DM exploration not found or not pending');
    return;
  }

  // Mark as in_progress
  await query(`UPDATE ai_explorations SET status = 'in_progress' WHERE id = $1`, [explorationId]);

  try {
    // Load both profiles
    const profileA = await loadDMProfile(exploration.user_a_id);
    const profileB = await loadDMProfile(exploration.user_b_id);

    if (!profileA || !profileB) {
      throw new Error('Could not load participant profiles');
    }

    // Get DM intent from the originating request, or room context
    let intent: string | null = null;
    if (exploration.origin_dm_request_id) {
      const dmReq = await queryOne<{ intent: string }>(
        `SELECT intent FROM dm_requests WHERE id = $1`,
        [exploration.origin_dm_request_id],
      );
      intent = dmReq?.intent || null;
    } else if (exploration.room_id) {
      const room = await queryOne<{ name: string; description: string | null }>(
        `SELECT name, description FROM rooms WHERE id = $1`,
        [exploration.room_id],
      );
      intent = room
        ? `Room "${room.name}": ${room.description || 'Professional networking'}`
        : null;
    }

    const model = 'gpt-4o-mini';
    const maxRounds = exploration.max_rounds || DM_PROTOCOL.max_rounds;

    // Build system prompts
    const systemA = buildDMAgentPrompt(profileA, profileB, intent, 1, maxRounds);
    const systemB = buildDMAgentPrompt(profileB, profileA, intent, 1, maxRounds);

    // Run conversation
    const conversationHistory: { sender: string; content: string }[] = [];
    const messagesA: ChatMessage[] = [{ role: 'system', content: systemA }];
    const messagesB: ChatMessage[] = [{ role: 'system', content: systemB }];

    for (let round = 1; round <= maxRounds; round++) {
      // A's turn
      if (round === 1) {
        messagesA.push({
          role: 'user',
          content: 'Start the pre-screening conversation. Introduce your principal and explore mutual fit.',
        });
      }

      const responseA = await callLLM(messagesA, model);
      conversationHistory.push({ sender: profileA.display_name || 'Agent A', content: responseA });

      await query(
        `INSERT INTO ai_exploration_messages (exploration_id, round_number, sender_side, agent_id, content)
         VALUES ($1, $2, 'A', $3, $4)`,
        [explorationId, round, exploration.agent_a_id, responseA],
      );

      messagesA.push({ role: 'assistant', content: responseA });
      messagesB.push({ role: 'user', content: responseA });

      // B's turn
      const responseB = await callLLM(messagesB, model);
      conversationHistory.push({ sender: profileB.display_name || 'Agent B', content: responseB });

      await query(
        `INSERT INTO ai_exploration_messages (exploration_id, round_number, sender_side, agent_id, content)
         VALUES ($1, $2, 'B', $3, $4)`,
        [explorationId, round, exploration.agent_b_id, responseB],
      );

      messagesB.push({ role: 'assistant', content: responseB });
      messagesA.push({ role: 'user', content: responseB });

      // Update round count
      await query(`UPDATE ai_explorations SET total_rounds = $1 WHERE id = $2`, [round, explorationId]);
    }

    // Generate summaries from both perspectives
    const summaryPromptA = buildDMSummaryPrompt(profileA, profileB, conversationHistory);
    const summaryPromptB = buildDMSummaryPrompt(profileB, profileA, conversationHistory);

    const [summaryRawA, summaryRawB] = await Promise.all([
      callLLM(
        [
          { role: 'system', content: 'You are a pre-screening analyst. Return ONLY valid JSON.' },
          { role: 'user', content: summaryPromptA },
        ],
        model,
      ),
      callLLM(
        [
          { role: 'system', content: 'You are a pre-screening analyst. Return ONLY valid JSON.' },
          { role: 'user', content: summaryPromptB },
        ],
        model,
      ),
    ]);

    const resultA = parseJSON(summaryRawA);
    const resultB = parseJSON(summaryRawB);

    // Compute match score from recommendations
    const scoreMap: Record<string, number> = {
      recommend_meeting: 0.85,
      need_more_info: 0.55,
      not_a_fit: 0.25,
    };
    const scoreA = resultA.recommendation ? scoreMap[resultA.recommendation] ?? 0.5 : 0.5;
    const scoreB = resultB.recommendation ? scoreMap[resultB.recommendation] ?? 0.5 : 0.5;
    const matchScore = (scoreA + scoreB) / 2;

    // Combine highlights
    const highlights = [
      ...(resultA.match_points || []).slice(0, 2),
      ...(resultB.match_points || []).slice(0, 1),
    ];

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
        JSON.stringify(resultA),
        JSON.stringify(resultB),
        matchScore,
        JSON.stringify(highlights),
        resultA.reason || resultB.reason || 'See summaries for details.',
        explorationId,
      ],
    );

    // Update dm_request status
    if (exploration.origin_dm_request_id) {
      await query(
        `UPDATE dm_requests SET status = 'screened' WHERE id = $1`,
        [exploration.origin_dm_request_id],
      );
    }

    // For DM-sourced explorations, auto-set initiator's (user_a) decision to 'want_chat'
    // because they already expressed intent by requesting pre-screening
    if (exploration.source === 'dm') {
      // Find both agents
      const agentA = await queryOne<{ id: string }>(
        `SELECT id FROM agents WHERE owner_user_id = $1 AND status = 'claimed' LIMIT 1`,
        [exploration.user_a_id],
      );
      const agentB = await queryOne<{ id: string }>(
        `SELECT id FROM agents WHERE owner_user_id = $1 AND status = 'claimed' LIMIT 1`,
        [exploration.user_b_id],
      );

      if (agentA && agentB) {
        // Create dm_request for the mutual-match flow
        const dmRequest = await queryOne<{ id: string }>(
          `INSERT INTO dm_requests (from_agent_id, to_agent_id, intent, exploration_id, expires_at)
           VALUES ($1, $2, 'networking', $3, NOW() + INTERVAL '7 days')
           RETURNING id`,
          [agentA.id, agentB.id, explorationId],
        );

        // Auto-set user_a's decision
        await query(
          `UPDATE ai_explorations
           SET decision_a = 'want_chat', decision_a_at = NOW(),
               chat_requested_by = 'A', dm_request_id = $1
           WHERE id = $2`,
          [dmRequest?.id, explorationId],
        );

        // Notify user_a: pre-screening done, your request has been sent
        await query(
          `INSERT INTO agent_notifications (owner_user_id, type, title, content, metadata)
           VALUES ($1, $2, $3, $4, $5)`,
          [
            exploration.user_a_id,
            'dm_prescreening_complete',
            'AI Pre-screening Complete',
            'Pre-screening is done. Waiting for the other party to review.',
            JSON.stringify({
              exploration_id: explorationId,
              source: 'dm',
            }),
          ],
        );

        // Notify user_b: someone wants to connect, review the results
        await query(
          `INSERT INTO agent_notifications (owner_user_id, type, title, content, metadata)
           VALUES ($1, $2, $3, $4, $5)`,
          [
            exploration.user_b_id,
            'chat_request_from_exploration',
            'Someone wants to chat with you!',
            'A networking match wants to connect. Review the AI exploration to decide.',
            JSON.stringify({
              exploration_id: explorationId,
              dm_request_id: dmRequest?.id,
            }),
          ],
        );
      }
    } else {
      // Room or activity source: notify both users equally, both need to decide
      const notificationType =
        exploration.source === 'room' ? 'room_exploration_complete' : 'dm_prescreening_complete';
      for (const userId of [exploration.user_a_id, exploration.user_b_id]) {
        await query(
          `INSERT INTO agent_notifications (owner_user_id, type, title, content, metadata)
           VALUES ($1, $2, $3, $4, $5)`,
          [
            userId,
            notificationType,
            'AI Pre-screening Complete',
            'Your agent finished a pre-screening conversation. Review the results!',
            JSON.stringify({
              exploration_id: explorationId,
              source: exploration.source,
              room_id: exploration.room_id,
            }),
          ],
        );
      }
    }

    logger.info({ explorationId, matchScore }, 'DM pre-screening completed');
  } catch (error) {
    logger.error({ explorationId, error }, 'DM pre-screening failed');
    await query(`UPDATE ai_explorations SET status = 'failed' WHERE id = $1`, [explorationId]);

    // Revert dm_request to pending so it can expire naturally
    if (exploration.origin_dm_request_id) {
      await query(
        `UPDATE dm_requests SET status = 'pending' WHERE id = $1 AND status = 'screening'`,
        [exploration.origin_dm_request_id],
      );
    }

    throw error; // Re-throw for queue to handle retry
  }
}

// ============================================
// Load Profile (without activity_participants)
// ============================================

async function loadDMProfile(userId: string): Promise<DMParticipantProfile | null> {
  const row = await queryOne<{
    display_name: string | null;
    industry: string | null;
    job_title: string | null;
    bio_md: string | null;
    looking_for: string | null;
    can_offer: string | null;
    topics_of_interest: string[] | null;
    agent_persona_md: string | null;
    focus_topics: string[] | null;
  }>(
    `SELECT
       op.display_name, op.industry, op.job_title, op.bio_md,
       op.looking_for, op.can_offer,
       op.topics_of_interest,
       aoc.agent_persona_md, aoc.focus_topics
     FROM owner_profiles op
     LEFT JOIN agents a ON a.owner_user_id = op.user_id AND a.status = 'claimed'
     LEFT JOIN agent_owner_config aoc ON aoc.agent_id = a.id
     WHERE op.user_id = $1
     LIMIT 1`,
    [userId],
  );

  if (!row) return null;

  return {
    display_name: row.display_name,
    industry: row.industry,
    job_title: row.job_title,
    bio_md: row.bio_md,
    looking_for: row.looking_for,
    can_offer: row.can_offer,
    tags: row.focus_topics || row.topics_of_interest || [],
    agent_persona: row.agent_persona_md,
  };
}

// ============================================
// Helpers
// ============================================

function parseJSON(raw: string): {
  other_party?: string;
  match_points?: string[];
  risk_points?: string[];
  recommendation?: string;
  reason?: string;
} {
  try {
    return JSON.parse(raw.replace(/```json\n?|\n?```/g, '').trim());
  } catch {
    return {
      other_party: 'See conversation for details',
      match_points: [],
      risk_points: [],
      recommendation: 'need_more_info',
      reason: 'Could not parse summary',
    };
  }
}
