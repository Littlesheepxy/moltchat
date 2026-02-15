/**
 * Reputation System
 * 声誉账本：公开记录行为，优质行为降低成本，劣质行为触发冷却
 */

import { query, queryOne, queryMany } from '../db/client.js';
import { logger } from './logger.js';

// ============================================
// Types
// ============================================

interface ReputationLedger {
  id: string;
  user_id: string;
  reputation_score: number;
  total_outbound: number;
  total_accepted: number;
  total_fulfilled: number;
  total_forfeited: number;
  avg_post_chat_rating: number | null;
  cooldown_until: Date | null;
  created_at: Date;
  updated_at: Date;
}

interface ReputationEvent {
  id: string;
  user_id: string;
  event_type: string;
  points_delta: number;
  reference_id: string | null;
  metadata: Record<string, unknown>;
  created_at: Date;
}

export type ReputationEventType =
  | 'outreach_sent'
  | 'outreach_accepted'
  | 'outreach_rejected'
  | 'stake_fulfilled'
  | 'stake_forfeited'
  | 'post_chat_positive'
  | 'post_chat_negative'
  | 'cooldown_triggered'
  | 'cooldown_lifted';

export interface PublicReputation {
  reputation_score: number;
  hit_rate: number;
  fulfillment_rate: number;
  avg_post_chat_rating: number | null;
  in_cooldown: boolean;
}

// ============================================
// Points Configuration
// ============================================

const POINTS: Record<ReputationEventType, number> = {
  outreach_sent: 0,
  outreach_accepted: 5,
  outreach_rejected: -3,
  stake_fulfilled: 10,
  stake_forfeited: -15,
  post_chat_positive: 5,
  post_chat_negative: -10,
  cooldown_triggered: 0,
  cooldown_lifted: 0,
};

const COOLDOWN_THRESHOLD = 50;
const COOLDOWN_DAYS = 7;
const INITIAL_SCORE = 100;

// ============================================
// Core Functions
// ============================================

/**
 * Get or create a reputation ledger for a user
 */
export async function getOrCreateLedger(userId: string): Promise<ReputationLedger> {
  const existing = await queryOne<ReputationLedger>(
    `SELECT * FROM reputation_ledger WHERE user_id = $1`,
    [userId]
  );

  if (existing) return existing;

  const created = await queryOne<ReputationLedger>(
    `INSERT INTO reputation_ledger (user_id, reputation_score)
     VALUES ($1, $2)
     ON CONFLICT (user_id) DO UPDATE SET updated_at = now()
     RETURNING *`,
    [userId, INITIAL_SCORE]
  );

  return created!;
}

/**
 * Record a reputation event and update the ledger
 */
export async function recordEvent(
  userId: string,
  eventType: ReputationEventType,
  referenceId?: string,
  metadata?: Record<string, unknown>
): Promise<ReputationEvent> {
  const pointsDelta = POINTS[eventType];

  // Insert event
  const event = await queryOne<ReputationEvent>(
    `INSERT INTO reputation_events (user_id, event_type, points_delta, reference_id, metadata)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [userId, eventType, pointsDelta, referenceId || null, JSON.stringify(metadata || {})]
  );

  // Update ledger score
  const ledger = await getOrCreateLedger(userId);
  const newScore = Math.max(0, ledger.reputation_score + pointsDelta);

  // Update counters based on event type
  const counterUpdates: string[] = ['reputation_score = $2', 'updated_at = now()'];
  const params: unknown[] = [userId, newScore];

  if (eventType === 'outreach_sent') {
    counterUpdates.push('total_outbound = total_outbound + 1');
  } else if (eventType === 'outreach_accepted') {
    counterUpdates.push('total_accepted = total_accepted + 1');
  } else if (eventType === 'stake_fulfilled') {
    counterUpdates.push('total_fulfilled = total_fulfilled + 1');
  } else if (eventType === 'stake_forfeited') {
    counterUpdates.push('total_forfeited = total_forfeited + 1');
  }

  await query(
    `UPDATE reputation_ledger SET ${counterUpdates.join(', ')} WHERE user_id = $1`,
    params
  );

  // Check if cooldown should be triggered
  if (newScore < COOLDOWN_THRESHOLD && !ledger.cooldown_until) {
    const cooldownUntil = new Date(Date.now() + COOLDOWN_DAYS * 24 * 60 * 60 * 1000);
    await query(
      `UPDATE reputation_ledger SET cooldown_until = $2 WHERE user_id = $1`,
      [userId, cooldownUntil]
    );
    // Record cooldown event
    await query(
      `INSERT INTO reputation_events (user_id, event_type, points_delta, metadata)
       VALUES ($1, 'cooldown_triggered', 0, $2)`,
      [userId, JSON.stringify({ cooldown_until: cooldownUntil, trigger_score: newScore })]
    );
    logger.info({ userId, newScore, cooldownUntil }, 'Reputation cooldown triggered');
  }

  return event!;
}

/**
 * Update the average post-chat rating for a user
 */
export async function updatePostChatRating(userId: string): Promise<void> {
  // Calculate average from all rated sessions where this user was involved
  const result = await queryOne<{ avg_rating: number }>(
    `SELECT AVG(rating)::REAL as avg_rating FROM (
      SELECT post_chat_rating_a as rating FROM dm_sessions
      WHERE initiator_id IN (SELECT id FROM agents WHERE owner_user_id = $1)
        AND post_chat_rating_a IS NOT NULL
      UNION ALL
      SELECT post_chat_rating_b as rating FROM dm_sessions
      WHERE target_id IN (SELECT id FROM agents WHERE owner_user_id = $1)
        AND post_chat_rating_b IS NOT NULL
    ) ratings`,
    [userId]
  );

  if (result?.avg_rating != null) {
    await query(
      `UPDATE reputation_ledger SET avg_post_chat_rating = $2, updated_at = now() WHERE user_id = $1`,
      [userId, result.avg_rating]
    );
  }
}

/**
 * Check if a user is in cooldown
 */
export async function checkCooldown(userId: string): Promise<{ inCooldown: boolean; until: Date | null }> {
  const ledger = await getOrCreateLedger(userId);

  if (ledger.cooldown_until && ledger.cooldown_until > new Date()) {
    return { inCooldown: true, until: ledger.cooldown_until };
  }

  // Clear expired cooldown
  if (ledger.cooldown_until && ledger.cooldown_until <= new Date()) {
    await query(
      `UPDATE reputation_ledger SET cooldown_until = NULL, updated_at = now() WHERE user_id = $1`,
      [userId]
    );
    await query(
      `INSERT INTO reputation_events (user_id, event_type, points_delta, metadata)
       VALUES ($1, 'cooldown_lifted', 0, '{}')`,
      [userId]
    );
  }

  return { inCooldown: false, until: null };
}

/**
 * Get public reputation profile
 */
export async function getPublicProfile(userId: string): Promise<PublicReputation> {
  const ledger = await getOrCreateLedger(userId);

  const hitRate = ledger.total_outbound > 0
    ? ledger.total_accepted / ledger.total_outbound
    : 0;

  const totalStakeResolved = ledger.total_fulfilled + ledger.total_forfeited;
  const fulfillmentRate = totalStakeResolved > 0
    ? ledger.total_fulfilled / totalStakeResolved
    : 1;

  const inCooldown = !!(ledger.cooldown_until && ledger.cooldown_until > new Date());

  return {
    reputation_score: ledger.reputation_score,
    hit_rate: Math.round(hitRate * 100) / 100,
    fulfillment_rate: Math.round(fulfillmentRate * 100) / 100,
    avg_post_chat_rating: ledger.avg_post_chat_rating,
    in_cooldown: inCooldown,
  };
}

/**
 * Get reputation events for a user
 */
export async function getEvents(userId: string, limit = 50): Promise<ReputationEvent[]> {
  return queryMany<ReputationEvent>(
    `SELECT * FROM reputation_events WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2`,
    [userId, limit]
  );
}
