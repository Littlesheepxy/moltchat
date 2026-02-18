/**
 * Attention Budget
 * 注意力预算：保护被触达方的防打扰设置
 *
 * - 出站：不限制（靠信誉分 + token 成本 + 对齐度自然约束）
 * - 入站：用户自定义上限（默认 10/周，可设无限制）
 */

import { query, queryOne } from '../db/client.js';

// ============================================
// Types
// ============================================

interface AttentionBudget {
  id: string;
  user_id: string;
  week_start: string;
  inbound_limit: number;       // -1 = unlimited
  inbound_used: number;
  created_at: Date;
  updated_at: Date;
}

interface UserBudgetPreference {
  inbound_limit: number;       // -1 = unlimited
  overflow_policy: 'queue' | 'reject';
  priority_by_reputation: boolean;
}

export interface BudgetStatus {
  inbound: {
    used: number;
    limit: number;            // -1 = unlimited
    remaining: number;        // -1 = unlimited
    allowed: boolean;
  };
  outbound_unlimited: true;
  week_start: string;
  preferences: UserBudgetPreference;
}

// ============================================
// Constants
// ============================================

const DEFAULT_INBOUND_LIMIT = 10;
const DEFAULT_OVERFLOW_POLICY: 'queue' | 'reject' = 'queue';
const DEFAULT_PRIORITY_BY_REPUTATION = true;

// ============================================
// Helpers
// ============================================

/**
 * Get the Monday of the current week (ISO week start)
 */
export function getWeekStart(): string {
  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? 6 : day - 1;
  const monday = new Date(now);
  monday.setDate(now.getDate() - diff);
  monday.setHours(0, 0, 0, 0);
  return monday.toISOString().split('T')[0]!;
}

// ============================================
// User Preferences
// ============================================

/**
 * Get user's budget preferences (from user_settings or defaults)
 */
export async function getUserBudgetPreference(userId: string): Promise<UserBudgetPreference> {
  const row = await queryOne<{
    inbound_limit: number;
    overflow_policy: string;
    priority_by_reputation: boolean;
  }>(
    `SELECT inbound_limit, overflow_policy, priority_by_reputation
     FROM user_budget_preferences
     WHERE user_id = $1`,
    [userId]
  );

  if (row) {
    return {
      inbound_limit: row.inbound_limit,
      overflow_policy: row.overflow_policy as 'queue' | 'reject',
      priority_by_reputation: row.priority_by_reputation,
    };
  }

  return {
    inbound_limit: DEFAULT_INBOUND_LIMIT,
    overflow_policy: DEFAULT_OVERFLOW_POLICY,
    priority_by_reputation: DEFAULT_PRIORITY_BY_REPUTATION,
  };
}

/**
 * Update user's budget preferences
 */
export async function updateUserBudgetPreference(
  userId: string,
  prefs: Partial<UserBudgetPreference>
): Promise<UserBudgetPreference> {
  const current = await getUserBudgetPreference(userId);
  const updated = { ...current, ...prefs };

  await query(
    `INSERT INTO user_budget_preferences (user_id, inbound_limit, overflow_policy, priority_by_reputation)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (user_id) DO UPDATE SET
       inbound_limit = $2,
       overflow_policy = $3,
       priority_by_reputation = $4,
       updated_at = now()`,
    [userId, updated.inbound_limit, updated.overflow_policy, updated.priority_by_reputation]
  );

  return updated;
}

// ============================================
// Weekly Budget Tracking
// ============================================

/**
 * Get or create the weekly inbound counter
 */
async function getOrCreateWeeklyBudget(
  userId: string,
  inboundLimit: number
): Promise<AttentionBudget> {
  const weekStart = getWeekStart();

  const existing = await queryOne<AttentionBudget>(
    `SELECT * FROM attention_budgets WHERE user_id = $1 AND week_start = $2`,
    [userId, weekStart]
  );

  if (existing) {
    // Sync limit if user changed preference
    if (existing.inbound_limit !== inboundLimit) {
      await query(
        `UPDATE attention_budgets SET inbound_limit = $3, updated_at = now()
         WHERE user_id = $1 AND week_start = $2`,
        [userId, weekStart, inboundLimit]
      );
      existing.inbound_limit = inboundLimit;
    }
    return existing;
  }

  const created = await queryOne<AttentionBudget>(
    `INSERT INTO attention_budgets (user_id, week_start, inbound_limit)
     VALUES ($1, $2, $3)
     ON CONFLICT (user_id, week_start) DO UPDATE SET updated_at = now()
     RETURNING *`,
    [userId, weekStart, inboundLimit]
  );

  return created!;
}

/**
 * Check if target user can receive more inbound requests this week
 */
export async function checkInboundBudget(userId: string): Promise<{
  allowed: boolean;
  used: number;
  limit: number;
  remaining: number;
}> {
  const prefs = await getUserBudgetPreference(userId);

  // Unlimited
  if (prefs.inbound_limit === -1) {
    return { allowed: true, used: 0, limit: -1, remaining: -1 };
  }

  const budget = await getOrCreateWeeklyBudget(userId, prefs.inbound_limit);
  const remaining = budget.inbound_limit - budget.inbound_used;

  return {
    allowed: remaining > 0,
    used: budget.inbound_used,
    limit: budget.inbound_limit,
    remaining: Math.max(0, remaining),
  };
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
export async function getBudgetStatus(userId: string): Promise<BudgetStatus> {
  const prefs = await getUserBudgetPreference(userId);
  const inbound = await checkInboundBudget(userId);

  return {
    inbound,
    outbound_unlimited: true,
    week_start: getWeekStart(),
    preferences: prefs,
  };
}
