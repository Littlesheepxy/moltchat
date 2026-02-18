/**
 * Exploration Queue Worker
 * PostgreSQL-based queue for Agent-to-Agent conversations
 *
 * - 每 5 秒轮询 pending 任务
 * - SELECT FOR UPDATE SKIP LOCKED 防并发
 * - 一个 Agent 同时只能处理一个对话
 * - 失败自动重试（最多 3 次）
 */

import { query, queryOne } from '../db/client.js';
import { logger } from './logger.js';

// ============================================
// Constants
// ============================================

const POLL_INTERVAL_MS = 5000;
const STALE_LOCK_MINUTES = 5;
const WORKER_ID = `worker-${process.pid}-${Date.now()}`;

let pollTimer: ReturnType<typeof setInterval> | null = null;
let isProcessing = false;

// ============================================
// Worker Lifecycle
// ============================================

export function startExplorationWorker(): void {
  logger.info({ workerId: WORKER_ID }, 'Starting exploration queue worker');
  pollTimer = setInterval(processNextItem, POLL_INTERVAL_MS);
  // Run once immediately
  processNextItem();
}

export function stopExplorationWorker(): void {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
  logger.info('Exploration queue worker stopped');
}

// ============================================
// Enqueue
// ============================================

/**
 * Add an exploration to the processing queue
 */
export async function enqueueExploration(
  explorationId: string,
  agentAId: string | null,
  agentBId: string | null,
  priority: number = 0,
): Promise<string> {
  const item = await queryOne<{ id: string }>(
    `INSERT INTO exploration_queue (exploration_id, agent_a_id, agent_b_id, priority)
     VALUES ($1, $2, $3, $4)
     RETURNING id`,
    [explorationId, agentAId, agentBId, priority],
  );
  logger.info({ explorationId, queueId: item!.id, priority }, 'Exploration enqueued');
  return item!.id;
}

// ============================================
// Process
// ============================================

async function processNextItem(): Promise<void> {
  if (isProcessing) return;
  isProcessing = true;

  try {
    // 1. Release stale locks (worker crashed mid-processing)
    await query(
      `UPDATE exploration_queue
       SET status = 'pending', locked_by = NULL, locked_at = NULL
       WHERE status = 'processing'
         AND locked_at < NOW() - INTERVAL '${STALE_LOCK_MINUTES} minutes'`,
    );

    // 2. Find and lock next eligible item
    //    "Eligible": pending, under max_attempts, neither agent is busy
    const item = await queryOne<{
      id: string;
      exploration_id: string;
      agent_a_id: string | null;
      agent_b_id: string | null;
      attempts: number;
    }>(
      `UPDATE exploration_queue SET
         status = 'processing',
         locked_by = $1,
         locked_at = NOW(),
         started_at = COALESCE(started_at, NOW()),
         attempts = attempts + 1
       WHERE id = (
         SELECT q.id FROM exploration_queue q
         WHERE q.status = 'pending'
           AND q.attempts < q.max_attempts
           AND NOT EXISTS (
             SELECT 1 FROM exploration_queue busy
             WHERE busy.status = 'processing'
               AND busy.id != q.id
               AND (
                 (busy.agent_a_id IS NOT NULL AND busy.agent_a_id IN (q.agent_a_id, q.agent_b_id))
                 OR (busy.agent_b_id IS NOT NULL AND busy.agent_b_id IN (q.agent_a_id, q.agent_b_id))
               )
           )
         ORDER BY q.priority DESC, q.created_at ASC
         LIMIT 1
         FOR UPDATE SKIP LOCKED
       )
       RETURNING id, exploration_id, agent_a_id, agent_b_id, attempts`,
      [WORKER_ID],
    );

    if (!item) return; // Nothing to process

    logger.info(
      { queueId: item.id, explorationId: item.exploration_id, attempt: item.attempts },
      'Processing queue item',
    );

    try {
      // Dynamically import to avoid circular dependency
      const { runDMExploration } = await import('./dm-exploration.js');
      await runDMExploration(item.exploration_id);

      // Mark completed
      await query(
        `UPDATE exploration_queue SET status = 'completed', completed_at = NOW() WHERE id = $1`,
        [item.id],
      );

      logger.info({ queueId: item.id }, 'Queue item completed');
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      logger.error({ queueId: item.id, error: errMsg }, 'Queue item failed');

      // Check if we've exhausted retries
      if (item.attempts >= 3) {
        await query(
          `UPDATE exploration_queue SET status = 'failed', last_error = $1, completed_at = NOW() WHERE id = $2`,
          [errMsg, item.id],
        );
      } else {
        // Return to pending for retry
        await query(
          `UPDATE exploration_queue SET status = 'pending', locked_by = NULL, locked_at = NULL, last_error = $1 WHERE id = $2`,
          [errMsg, item.id],
        );
      }
    }
  } catch (error) {
    logger.error({ error }, 'Queue worker error');
  } finally {
    isProcessing = false;
  }
}
