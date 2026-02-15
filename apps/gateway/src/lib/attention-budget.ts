/**
 * Attention Budget
 * 注意力预算：每周固定处理额度，超额自动排队
 */

import { query, queryOne } from '../db/client.js';

// ============================================
// Types
// ============================================

interface AttentionBudget {
  id: string;
  user_id: string;
  week_start: string;
  inbound_limit: number;
  outbound_limit: number;
  inbound_used: number;
  outbound_used: number;
  created_at: Date;
  updated_at: Date;
}

export interface BudgetCheck {
  allowed: boolean;
  used: number;
  limit: number;
  remaining: number;
}

// ============================================
// Constants
// ============================================

const DEFAULT_INBOUND_LIMIT = 5;
const DEFAULT_OUTBOUND_LIMIT = 5;

// ============================================
// Helpers
// ============================================

/**
 * Get the Monday of the current week (ISO week start)
 */
export function getWeekStart(): string {
  const now = new Date();
  const day = now.getDay();
  // getDay(): 0=Sun, 1=Mon, ..., 6=Sat
  // offset to Monday: if Sun (0), go back 6; otherwise go back (day-1)
  const diff = day === 0 ? 6 : day - 1;
  const monday = new Date(now);
  monday.setDate(now.getDate() - diff);
  monday.setHours(0, 0, 0, 0);
  return monday.toISOString().split('T')[0]!; // YYYY-MM-DD
}

/**
 * Calculate effective limit based on reputation score
 * Higher reputation → more budget
 */
function calculateEffectiveLimit(baseLimit: number, reputationScore: number): number {
  if (reputationScore >= 150) return baseLimit + 2;
  if (reputationScore >= 120) return baseLimit + 1;
  return baseLimit;
}

// ============================================
// Core Functions
// ============================================

/**
 * Get or create the attention budget for the current week
 */
export async function getOrCreateBudget(
  userId: string,
  reputationScore: number = 100
): Promise<AttentionBudget> {
  const weekStart = getWeekStart();

  const existing = await queryOne<AttentionBudget>(
    `SELECT * FROM attention_budgets WHERE user_id = $1 AND week_start = $2`,
    [userId, weekStart]
  );

  if (existing) {
    // Update limits if reputation changed (dynamic adjustment)
    const effectiveInbound = calculateEffectiveLimit(DEFAULT_INBOUND_LIMIT, reputationScore);
    const effectiveOutbound = calculateEffectiveLimit(DEFAULT_OUTBOUND_LIMIT, reputationScore);

    if (existing.inbound_limit !== effectiveInbound || existing.outbound_limit !== effectiveOutbound) {
      await query(
        `UPDATE attention_budgets
         SET inbound_limit = $3, outbound_limit = $4, updated_at = now()
         WHERE user_id = $1 AND week_start = $2`,
        [userId, weekStart, effectiveInbound, effectiveOutbound]
      );
      existing.inbound_limit = effectiveInbound;
      existing.outbound_limit = effectiveOutbound;
    }

    return existing;
  }

  const effectiveInbound = calculateEffectiveLimit(DEFAULT_INBOUND_LIMIT, reputationScore);
  const effectiveOutbound = calculateEffectiveLimit(DEFAULT_OUTBOUND_LIMIT, reputationScore);

  const created = await queryOne<AttentionBudget>(
    `INSERT INTO attention_budgets (user_id, week_start, inbound_limit, outbound_limit)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (user_id, week_start) DO UPDATE SET updated_at = now()
     RETURNING *`,
    [userId, weekStart, effectiveInbound, effectiveOutbound]
  );

  return created!;
}

/**
 * Check if user has outbound budget remaining
 */
export async function checkOutboundBudget(
  userId: string,
  reputationScore: number = 100
): Promise<BudgetCheck> {
  const budget = await getOrCreateBudget(userId, reputationScore);
  const remaining = budget.outbound_limit - budget.outbound_used;

  return {
    allowed: remaining > 0,
    used: budget.outbound_used,
    limit: budget.outbound_limit,
    remaining: Math.max(0, remaining),
  };
}

/**
 * Check if target user has inbound budget remaining
 */
export async function checkInboundBudget(
  userId: string,
  reputationScore: number = 100
): Promise<BudgetCheck> {
  const budget = await getOrCreateBudget(userId, reputationScore);
  const remaining = budget.inbound_limit - budget.inbound_used;

  return {
    allowed: remaining > 0,
    used: budget.inbound_used,
    limit: budget.inbound_limit,
    remaining: Math.max(0, remaining),
  };
}

/**
 * Consume one outbound budget slot
 */
export async function consumeOutbound(userId: string): Promise<void> {
  const weekStart = getWeekStart();
  await query(
    `UPDATE attention_budgets
     SET outbound_used = outbound_used + 1, updated_at = now()
     WHERE user_id = $1 AND week_start = $2`,
    [userId, weekStart]
  );
}

/**
 * Consume one inbound budget slot
 */
export async function consumeInbound(userId: string): Promise<void> {
  const weekStart = getWeekStart();
  await query(
    `UPDATE attention_budgets
     SET inbound_used = inbound_used + 1, updated_at = now()
     WHERE user_id = $1 AND week_start = $2`,
    [userId, weekStart]
  );
}

/**
 * Get current budget status for display
 */
export async function getBudgetStatus(
  userId: string,
  reputationScore: number = 100
): Promise<{
  outbound: BudgetCheck;
  inbound: BudgetCheck;
  week_start: string;
}> {
  const outbound = await checkOutboundBudget(userId, reputationScore);
  const inbound = await checkInboundBudget(userId, reputationScore);
  return { outbound, inbound, week_start: getWeekStart() };
}
