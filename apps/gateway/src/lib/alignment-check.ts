/**
 * Alignment Check
 * 对齐度评估：AI 预演评分，alignment >= 0.65 才进入真人层
 */

import { queryOne, queryMany } from '../db/client.js';
import { getPublicProfile } from './reputation.js';

// ============================================
// Types
// ============================================

export interface AlignmentDetails {
  intent_match: number;
  value_exchange: number;
  industry_overlap: number;
  tag_overlap: number;
  behavior_history: number;
  final_score: number;
}

export interface AlignmentResult {
  score: number;
  passed: boolean;
  details: AlignmentDetails;
}

interface UserProfile {
  user_id: string;
  industry: string | null;
  topics_of_interest: string[];
  roles: string[];
  tags: string[];
  looking_for: string | null;
  can_offer: string | null;
}

// ============================================
// Constants
// ============================================

const ALIGNMENT_THRESHOLD = 0.65;

// Role complementarity pairs (reused from networking.ts)
const COMPLEMENTARY_PAIRS: Record<string, string[]> = {
  job_seeker: ['recruiter'],
  recruiter: ['job_seeker'],
  fundraiser: ['investor'],
  investor: ['fundraiser'],
  kol_seeker: ['kol'],
  kol: ['kol_seeker'],
  traffic_provider: ['business_owner'],
  business_owner: ['traffic_provider'],
  business_general: [
    'business_general', 'job_seeker', 'recruiter',
    'fundraiser', 'investor', 'kol_seeker', 'kol',
    'traffic_provider', 'business_owner',
  ],
};

// Scoring weights
const WEIGHTS = {
  intent_match: 0.30,
  value_exchange: 0.15,
  industry_overlap: 0.15,
  tag_overlap: 0.10,
  behavior_history: 0.30,
};

// ============================================
// Core Functions
// ============================================

/**
 * Check alignment between two users
 * If an ai_exploration exists between them, use its match_score directly
 */
export async function checkAlignment(
  fromUserId: string,
  toUserId: string,
  activityId?: string
): Promise<AlignmentResult> {
  // First check if there's an existing AI exploration with a score
  if (activityId) {
    const exploration = await queryOne<{ match_score: number }>(
      `SELECT match_score FROM ai_explorations
       WHERE activity_id = $1
         AND ((user_a_id = $2 AND user_b_id = $3) OR (user_a_id = $3 AND user_b_id = $2))
         AND match_score IS NOT NULL
       ORDER BY created_at DESC LIMIT 1`,
      [activityId, fromUserId, toUserId]
    );

    if (exploration) {
      // Use AI exploration score, augmented by behavior history
      const reputation = await getPublicProfile(fromUserId);
      const behaviorScore = reputationToScore(reputation.reputation_score);

      // Weighted combination: 70% AI exploration + 30% behavior
      const finalScore = exploration.match_score * 0.7 + behaviorScore * 0.3;

      return {
        score: Math.round(finalScore * 100) / 100,
        passed: finalScore >= ALIGNMENT_THRESHOLD,
        details: {
          intent_match: exploration.match_score,
          value_exchange: exploration.match_score,
          industry_overlap: 0,
          tag_overlap: 0,
          behavior_history: behaviorScore,
          final_score: finalScore,
        },
      };
    }
  }

  // Fallback: calculate alignment from profiles
  const fromProfile = await getUserProfile(fromUserId);
  const toProfile = await getUserProfile(toUserId);

  if (!fromProfile || !toProfile) {
    return {
      score: 0,
      passed: false,
      details: {
        intent_match: 0,
        value_exchange: 0,
        industry_overlap: 0,
        tag_overlap: 0,
        behavior_history: 0,
        final_score: 0,
      },
    };
  }

  const details = await calculateAlignmentDetails(fromProfile, toProfile, fromUserId);

  return {
    score: details.final_score,
    passed: details.final_score >= ALIGNMENT_THRESHOLD,
    details,
  };
}

/**
 * Preview alignment score without creating any records
 */
export async function previewAlignment(
  fromUserId: string,
  toUserId: string,
  activityId?: string
): Promise<AlignmentResult> {
  return checkAlignment(fromUserId, toUserId, activityId);
}

// ============================================
// Internal Helpers
// ============================================

async function getUserProfile(userId: string): Promise<UserProfile | null> {
  // Get owner profile
  const profile = await queryOne<{
    user_id: string;
    industry: string | null;
    topics_of_interest: string[];
  }>(
    `SELECT user_id, industry, topics_of_interest
     FROM owner_profiles WHERE user_id = $1`,
    [userId]
  );

  if (!profile) return null;

  // Get activity participant data (if any active participation)
  const participant = await queryOne<{
    roles: string[];
    tags: string[];
    looking_for: string | null;
    can_offer: string | null;
  }>(
    `SELECT roles, tags, looking_for, can_offer
     FROM activity_participants
     WHERE user_id = $1
     ORDER BY created_at DESC LIMIT 1`,
    [userId]
  );

  return {
    user_id: userId,
    industry: profile.industry,
    topics_of_interest: profile.topics_of_interest || [],
    roles: participant?.roles || [],
    tags: participant?.tags || [],
    looking_for: participant?.looking_for || null,
    can_offer: participant?.can_offer || null,
  };
}

async function calculateAlignmentDetails(
  from: UserProfile,
  to: UserProfile,
  fromUserId: string
): Promise<AlignmentDetails> {
  // 1. Intent/Role match (complementary pairs)
  let intentMatch = 0;
  for (const roleA of from.roles) {
    const complements = COMPLEMENTARY_PAIRS[roleA] || [];
    for (const roleB of to.roles) {
      if (complements.includes(roleB)) {
        intentMatch = 1.0;
        break;
      }
    }
    if (intentMatch > 0) break;
  }

  // 2. Value exchange (looking_for vs can_offer overlap)
  let valueExchange = 0;
  if (from.looking_for && to.can_offer) {
    // Simple keyword overlap check
    const lookingWords = new Set(from.looking_for.toLowerCase().split(/\s+/));
    const offerWords = new Set(to.can_offer.toLowerCase().split(/\s+/));
    const overlap = [...lookingWords].filter(w => offerWords.has(w) && w.length > 2).length;
    valueExchange = Math.min(1.0, overlap / Math.max(3, lookingWords.size) * 2);
  }

  // 3. Industry overlap
  let industryOverlap = 0;
  if (from.industry && to.industry) {
    if (from.industry.toLowerCase() === to.industry.toLowerCase()) {
      industryOverlap = 1.0;
    }
  }

  // 4. Tag overlap (Jaccard similarity)
  let tagOverlap = 0;
  const allFromTags = [...from.tags, ...from.topics_of_interest].map(t => t.toLowerCase());
  const allToTags = [...to.tags, ...to.topics_of_interest].map(t => t.toLowerCase());
  if (allFromTags.length > 0 && allToTags.length > 0) {
    const setA = new Set(allFromTags);
    const setB = new Set(allToTags);
    const intersection = [...setA].filter(x => setB.has(x)).length;
    const union = new Set([...setA, ...setB]).size;
    tagOverlap = union > 0 ? intersection / union : 0;
  }

  // 5. Behavior history (from reputation)
  const reputation = await getPublicProfile(fromUserId);
  const behaviorHistory = reputationToScore(reputation.reputation_score);

  // Weighted final score
  const finalScore =
    intentMatch * WEIGHTS.intent_match +
    valueExchange * WEIGHTS.value_exchange +
    industryOverlap * WEIGHTS.industry_overlap +
    tagOverlap * WEIGHTS.tag_overlap +
    behaviorHistory * WEIGHTS.behavior_history;

  return {
    intent_match: Math.round(intentMatch * 100) / 100,
    value_exchange: Math.round(valueExchange * 100) / 100,
    industry_overlap: Math.round(industryOverlap * 100) / 100,
    tag_overlap: Math.round(tagOverlap * 100) / 100,
    behavior_history: Math.round(behaviorHistory * 100) / 100,
    final_score: Math.round(finalScore * 100) / 100,
  };
}

/**
 * Convert reputation score (0-200+) to a 0-1 behavior score
 * 100 is baseline (0.5), 0 is worst (0), 200+ is best (1.0)
 */
function reputationToScore(reputationScore: number): number {
  // Normalize: 0→0, 100→0.5, 200→1.0
  return Math.min(1.0, Math.max(0, reputationScore / 200));
}
