/**
 * Room Explore Scanner
 * 定期扫描 explore_enabled 的 Room，自动为新成员配对创建 exploration
 *
 * - 每 60 秒扫描一次
 * - 每个 Room 每轮最多创建 5 个新 exploration
 * - 复用现有 exploration_queue + runDMExploration 执行
 */

import { query, queryOne, queryMany } from '../db/client.js';
import { logger } from './logger.js';
import { enqueueExploration } from './exploration-queue.js';

// ============================================
// Constants
// ============================================

const SCAN_INTERVAL_MS = 60_000; // 60 seconds
const STARTUP_DELAY_MS = 10_000; // 10 seconds after startup
const MAX_ROOMS_PER_SCAN = 10;
const MAX_NEW_PAIRS_PER_ROOM = 5;

let scanTimer: ReturnType<typeof setInterval> | null = null;
let startupTimer: ReturnType<typeof setTimeout> | null = null;
let isScanning = false;

// ============================================
// Lifecycle
// ============================================

export function startRoomExploreScanner(): void {
  logger.info('Starting room explore scanner');
  scanTimer = setInterval(scanRoomsForExploration, SCAN_INTERVAL_MS);
  startupTimer = setTimeout(scanRoomsForExploration, STARTUP_DELAY_MS);
}

export function stopRoomExploreScanner(): void {
  if (scanTimer) {
    clearInterval(scanTimer);
    scanTimer = null;
  }
  if (startupTimer) {
    clearTimeout(startupTimer);
    startupTimer = null;
  }
  logger.info('Room explore scanner stopped');
}

// ============================================
// Scanner
// ============================================

async function scanRoomsForExploration(): Promise<void> {
  if (isScanning) return;
  isScanning = true;

  try {
    // Find rooms that need scanning:
    // explore_enabled = true, active, and interval has elapsed
    const rooms = await queryMany<{
      id: string;
      name: string;
      explore_rounds: number;
      explore_model: string;
    }>(
      `SELECT id, name, explore_rounds, explore_model FROM rooms
       WHERE explore_enabled = true
         AND status = 'active'
         AND (last_explored_at IS NULL
              OR last_explored_at < NOW() - (explore_interval_minutes * INTERVAL '1 minute'))
       ORDER BY last_explored_at ASC NULLS FIRST
       LIMIT $1`,
      [MAX_ROOMS_PER_SCAN],
    );

    for (const room of rooms) {
      try {
        await processRoomExploration(room);
      } catch (error) {
        logger.error({ roomId: room.id, error }, 'Failed to process room exploration');
      }
    }
  } catch (error) {
    logger.error({ error }, 'Room explore scanner error');
  } finally {
    isScanning = false;
  }
}

// ============================================
// Per-Room Processing
// ============================================

async function processRoomExploration(room: {
  id: string;
  name: string;
  explore_rounds: number;
  explore_model: string;
}): Promise<void> {
  // 1. Get room members, resolving agent_id -> user_id
  const members = await queryMany<{
    agent_id: string;
    user_id: string;
  }>(
    `SELECT rm.agent_id, a.owner_user_id AS user_id
     FROM room_members rm
     JOIN agents a ON a.id = rm.agent_id
     WHERE rm.room_id = $1
       AND a.owner_user_id IS NOT NULL
       AND a.status = 'claimed'`,
    [room.id],
  );

  if (members.length < 2) {
    // Still update last_explored_at to avoid re-scanning immediately
    await query(`UPDATE rooms SET last_explored_at = NOW() WHERE id = $1`, [room.id]);
    return;
  }

  // 2. Get existing exploration pairs for this room (avoid duplicates)
  const existingPairs = await queryMany<{ user_a_id: string; user_b_id: string }>(
    `SELECT user_a_id, user_b_id FROM ai_explorations
     WHERE room_id = $1 AND status IN ('pending', 'in_progress', 'completed')`,
    [room.id],
  );

  const pairSet = new Set(
    existingPairs.map((p) => [p.user_a_id, p.user_b_id].sort().join(':')),
  );

  // 3. Find new pairs
  const newPairs: Array<{
    user_a_id: string;
    user_b_id: string;
    agent_a_id: string;
    agent_b_id: string;
  }> = [];

  for (let i = 0; i < members.length; i++) {
    for (let j = i + 1; j < members.length; j++) {
      const a = members[i]!;
      const b = members[j]!;
      const pairKey = [a.user_id, b.user_id].sort().join(':');

      if (pairSet.has(pairKey)) continue;

      newPairs.push({
        user_a_id: a.user_id,
        user_b_id: b.user_id,
        agent_a_id: a.agent_id,
        agent_b_id: b.agent_id,
      });
    }
  }

  // 4. Cap per scan cycle
  const toCreate = newPairs.slice(0, MAX_NEW_PAIRS_PER_ROOM);

  // 5. Create explorations and enqueue
  for (const pair of toCreate) {
    const exploration = await queryOne<{ id: string }>(
      `INSERT INTO ai_explorations (
         source, room_id, activity_id,
         user_a_id, user_b_id, agent_a_id, agent_b_id,
         max_rounds
       ) VALUES ('room', $1, NULL, $2, $3, $4, $5, $6)
       RETURNING id`,
      [
        room.id,
        pair.user_a_id,
        pair.user_b_id,
        pair.agent_a_id,
        pair.agent_b_id,
        room.explore_rounds,
      ],
    );

    await enqueueExploration(exploration!.id, pair.agent_a_id, pair.agent_b_id);
  }

  // 6. Update last_explored_at
  await query(`UPDATE rooms SET last_explored_at = NOW() WHERE id = $1`, [room.id]);

  if (toCreate.length > 0) {
    logger.info(
      { roomId: room.id, roomName: room.name, newPairs: toCreate.length },
      'Room auto-explore: new explorations created',
    );
  }
}
