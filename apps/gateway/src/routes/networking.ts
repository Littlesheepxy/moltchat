/**
 * Networking Routes
 * 运营活动 + AI 探索 + 人类决策(标注)
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { query, queryOne, queryMany } from '../db/client.js';
import { verifyUserSession, type SessionAuthResult } from '../lib/auth.js';
import { AppError, ERROR_CODES } from '../lib/errors.js';
import { runPendingExplorations } from '../lib/ai-exploration.js';
import { executeExplorationDecision } from '../lib/exploration-actions.js';

// ============================================
// Constants
// ============================================

const VALID_ROLES = [
  'job_seeker', 'recruiter',
  'fundraiser', 'investor',
  'kol_seeker', 'kol',
  'traffic_provider', 'business_owner',
  'business_general',
] as const;

const COMPLEMENTARY_PAIRS: Record<string, string[]> = {
  job_seeker: ['recruiter'],
  recruiter: ['job_seeker'],
  fundraiser: ['investor'],
  investor: ['fundraiser'],
  kol_seeker: ['kol'],
  kol: ['kol_seeker'],
  traffic_provider: ['business_owner'],
  business_owner: ['traffic_provider'],
  business_general: ['business_general', 'job_seeker', 'recruiter', 'fundraiser', 'investor', 'kol_seeker', 'kol', 'traffic_provider', 'business_owner'],
};

const PASS_REASONS = ['not_relevant', 'not_interested', 'low_quality', 'already_connected', 'other'] as const;

// ============================================
// Validation Schemas
// ============================================

const createActivitySchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  theme: z.string().max(100).optional(),
  cover_image: z.string().url().optional(),
  max_participants: z.number().int().min(2).max(500).default(30),
  ai_explore_rounds: z.number().int().min(2).max(20).default(8),
  ai_explore_model: z.string().max(50).default('gpt-4o-mini'),
  max_explorations_per_user: z.number().int().min(1).max(100).default(20),
  decision_deadline_hours: z.number().int().min(1).max(168).default(48),
  is_anonymous: z.boolean().default(true),
  chat_expiry_hours: z.number().int().min(1).max(720).default(72),
  starts_at: z.string().datetime().optional(),
  ends_at: z.string().datetime().optional(),
});

const updateActivitySchema = createActivitySchema.partial().extend({
  status: z.enum(['draft', 'active', 'paused', 'ended']).optional(),
});

const joinActivitySchema = z.object({
  roles: z.array(z.enum(VALID_ROLES)).min(1).max(5),
  looking_for: z.string().min(10).max(500),
  can_offer: z.string().min(10).max(500),
  tags: z.array(z.string().max(30)).max(10).default([]),
});

const updateParticipantSchema = joinActivitySchema.partial();

const decideSchema = z.object({
  decision: z.enum(['want_chat', 'pass']),
  reason: z.string().max(500).optional(),
  is_public: z.boolean().optional(),
});

// ============================================
// Helper: require user session
// ============================================

async function requireSession(request: FastifyRequest): Promise<SessionAuthResult> {
  const session = await verifyUserSession(request);
  if (!session) {
    throw new AppError(ERROR_CODES.UNAUTHORIZED, 'Please sign in first', 401);
  }
  return session;
}

// ============================================
// Helper: check profile completeness for activity join
// ============================================

async function checkProfileComplete(userId: string): Promise<{ complete: boolean; missing: string[] }> {
  const profile = await queryOne<{
    display_name: string | null;
    industry: string | null;
    job_title: string | null;
    bio_md: string | null;
    topics_of_interest: string[] | null;
  }>(
    `SELECT display_name, industry, job_title, bio_md, topics_of_interest
     FROM owner_profiles WHERE user_id = $1`,
    [userId]
  );

  const missing: string[] = [];
  if (!profile) {
    return { complete: false, missing: ['profile'] };
  }
  if (!profile.display_name || profile.display_name.trim().length < 1) missing.push('display_name');
  if (!profile.industry || profile.industry.trim().length < 1) missing.push('industry');
  if (!profile.job_title || profile.job_title.trim().length < 3) missing.push('job_title');
  if (!profile.bio_md || profile.bio_md.trim().length < 20) missing.push('bio');
  if (!profile.topics_of_interest || profile.topics_of_interest.length < 1) missing.push('topics');

  return { complete: missing.length === 0, missing };
}

// ============================================
// Routes
// ============================================

export async function networkingRoutes(fastify: FastifyInstance) {

  // ============================================
  // GET /v1/activities — 列出活动
  // ============================================
  fastify.get('/v1/activities', async (request: FastifyRequest, reply: FastifyReply) => {
    const session = await requireSession(request);
    const { status } = request.query as { status?: string };

    let whereClause = 'WHERE 1=1';
    const params: unknown[] = [];

    if (status) {
      params.push(status);
      whereClause += ` AND a.status = $${params.length}`;
    } else {
      whereClause += ` AND a.status IN ('active', 'paused')`;
    }

    const activities = await queryMany<{
      id: string; name: string; description: string | null; theme: string | null;
      cover_image: string | null; status: string; max_participants: number;
      is_anonymous: boolean; starts_at: Date | null; ends_at: Date | null;
      created_at: Date; participant_count: string;
      user_joined: string;
    }>(
      `SELECT a.*,
              COUNT(DISTINCT ap.user_id) as participant_count,
              COUNT(DISTINCT CASE WHEN ap.user_id = $${params.length + 1} THEN 1 END) as user_joined
       FROM activities a
       LEFT JOIN activity_participants ap ON ap.activity_id = a.id
       ${whereClause}
       GROUP BY a.id
       ORDER BY a.starts_at DESC NULLS LAST, a.created_at DESC
       LIMIT 20`,
      [...params, session.userId]
    );

    return reply.send({
      success: true,
      data: {
        activities: activities.map(a => ({
          id: a.id,
          name: a.name,
          description: a.description,
          theme: a.theme,
          cover_image: a.cover_image,
          status: a.status,
          max_participants: a.max_participants,
          is_anonymous: a.is_anonymous,
          starts_at: a.starts_at,
          ends_at: a.ends_at,
          created_at: a.created_at,
          participant_count: parseInt(a.participant_count, 10),
          user_joined: parseInt(a.user_joined, 10) > 0,
        })),
      },
    });
  });

  // ============================================
  // GET /v1/activities/:id — 活动详情
  // ============================================
  fastify.get('/v1/activities/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const session = await requireSession(request);
    const { id } = request.params as { id: string };

    const activity = await queryOne<any>(
      `SELECT a.*,
              COUNT(DISTINCT ap.user_id) as participant_count
       FROM activities a
       LEFT JOIN activity_participants ap ON ap.activity_id = a.id
       WHERE a.id = $1
       GROUP BY a.id`,
      [id]
    );

    if (!activity) {
      throw new AppError(ERROR_CODES.NOT_FOUND, 'Activity not found', 404);
    }

    // 检查用户是否已加入
    const participant = await queryOne<{ id: string; roles: string[]; looking_for: string | null; can_offer: string | null; tags: string[] }>(
      `SELECT id, roles, looking_for, can_offer, tags FROM activity_participants WHERE activity_id = $1 AND user_id = $2`,
      [id, session.userId]
    );

    // 统计探索数据
    const explorationStats = await queryOne<{ total: string; pending_review: string; completed: string }>(
      `SELECT 
         COUNT(*) as total,
         COUNT(*) FILTER (WHERE 
           (user_a_id = $2 AND decision_a = 'pending') OR
           (user_b_id = $2 AND decision_b = 'pending')
         ) as pending_review,
         COUNT(*) FILTER (WHERE status = 'completed') as completed
       FROM ai_explorations
       WHERE activity_id = $1 AND (user_a_id = $2 OR user_b_id = $2)`,
      [id, session.userId]
    );

    return reply.send({
      success: true,
      data: {
        activity: {
          ...activity,
          participant_count: parseInt(activity.participant_count, 10),
        },
        my_participation: participant ? {
          roles: participant.roles,
          looking_for: participant.looking_for,
          can_offer: participant.can_offer,
          tags: participant.tags,
        } : null,
        exploration_stats: {
          total: parseInt(explorationStats?.total || '0', 10),
          pending_review: parseInt(explorationStats?.pending_review || '0', 10),
          completed: parseInt(explorationStats?.completed || '0', 10),
        },
      },
    });
  });

  // ============================================
  // POST /v1/activities — 创建活动 (管理员)
  // ============================================
  fastify.post('/v1/activities', async (request: FastifyRequest, reply: FastifyReply) => {
    const session = await requireSession(request);

    const parseResult = createActivitySchema.safeParse(request.body);
    if (!parseResult.success) {
      throw new AppError(ERROR_CODES.VALIDATION_ERROR, 'Invalid activity data', 400, undefined, {
        errors: parseResult.error.flatten().fieldErrors,
      });
    }

    const data = parseResult.data;

    const activity = await queryOne<{ id: string; created_at: Date }>(
      `INSERT INTO activities (
        name, description, theme, cover_image, max_participants,
        ai_explore_rounds, ai_explore_model, max_explorations_per_user,
        decision_deadline_hours, is_anonymous, chat_expiry_hours,
        starts_at, ends_at, created_by
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
      RETURNING id, created_at`,
      [
        data.name, data.description || null, data.theme || null, data.cover_image || null,
        data.max_participants, data.ai_explore_rounds, data.ai_explore_model,
        data.max_explorations_per_user, data.decision_deadline_hours,
        data.is_anonymous, data.chat_expiry_hours,
        data.starts_at || null, data.ends_at || null, session.userId,
      ]
    );

    return reply.status(201).send({
      success: true,
      data: { activity: { id: activity!.id, created_at: activity!.created_at } },
    });
  });

  // ============================================
  // PUT /v1/activities/:id — 更新活动 (管理员)
  // ============================================
  fastify.put('/v1/activities/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const session = await requireSession(request);
    const { id } = request.params as { id: string };

    const parseResult = updateActivitySchema.safeParse(request.body);
    if (!parseResult.success) {
      throw new AppError(ERROR_CODES.VALIDATION_ERROR, 'Invalid activity data', 400);
    }

    const data = parseResult.data;
    const setClauses: string[] = ['updated_at = NOW()'];
    const params: unknown[] = [];
    let paramIdx = 1;

    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined) {
        setClauses.push(`${key} = $${paramIdx}`);
        params.push(value);
        paramIdx++;
      }
    }

    params.push(id);
    await query(
      `UPDATE activities SET ${setClauses.join(', ')} WHERE id = $${paramIdx}`,
      params
    );

    return reply.send({ success: true });
  });

  // ============================================
  // POST /v1/activities/:id/join — 加入活动 + 设置身份意图
  // ============================================
  fastify.post('/v1/activities/:id/join', async (request: FastifyRequest, reply: FastifyReply) => {
    const session = await requireSession(request);
    const { id } = request.params as { id: string };

    // 检查活动存在且处于活跃状态
    const activity = await queryOne<{ id: string; status: string; max_participants: number }>(
      `SELECT id, status, max_participants FROM activities WHERE id = $1`,
      [id]
    );
    if (!activity) {
      throw new AppError(ERROR_CODES.NOT_FOUND, 'Activity not found', 404);
    }
    if (activity.status !== 'active') {
      throw new AppError(ERROR_CODES.VALIDATION_ERROR, 'Activity is not active', 400);
    }

    // 检查是否已加入
    const existing = await queryOne<{ id: string }>(
      `SELECT id FROM activity_participants WHERE activity_id = $1 AND user_id = $2`,
      [id, session.userId]
    );
    if (existing) {
      throw new AppError(ERROR_CODES.VALIDATION_ERROR, 'Already joined this activity', 409);
    }

    // 检查人数上限
    const countResult = await queryOne<{ count: string }>(
      `SELECT COUNT(*) as count FROM activity_participants WHERE activity_id = $1`,
      [id]
    );
    if (parseInt(countResult?.count || '0', 10) >= activity.max_participants) {
      throw new AppError(ERROR_CODES.VALIDATION_ERROR, 'Activity is full', 400);
    }

    // 强制检查资料完整度
    const profileCheck = await checkProfileComplete(session.userId);
    if (!profileCheck.complete) {
      throw new AppError(
        ERROR_CODES.VALIDATION_ERROR,
        'Profile incomplete: please complete your profile before joining',
        400,
        undefined,
        { missing_fields: profileCheck.missing }
      );
    }

    // 解析意图数据
    const parseResult = joinActivitySchema.safeParse(request.body);
    if (!parseResult.success) {
      throw new AppError(ERROR_CODES.VALIDATION_ERROR, 'Invalid participation data', 400, undefined, {
        errors: parseResult.error.flatten().fieldErrors,
      });
    }

    const data = parseResult.data;

    const participant = await queryOne<{ id: string }>(
      `INSERT INTO activity_participants (activity_id, user_id, roles, looking_for, can_offer, tags)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [id, session.userId, data.roles, data.looking_for, data.can_offer, data.tags]
    );

    return reply.status(201).send({
      success: true,
      data: { participant_id: participant!.id },
    });
  });

  // ============================================
  // PUT /v1/activities/:id/profile — 更新活动内资料
  // ============================================
  fastify.put('/v1/activities/:id/profile', async (request: FastifyRequest, reply: FastifyReply) => {
    const session = await requireSession(request);
    const { id } = request.params as { id: string };

    const parseResult = updateParticipantSchema.safeParse(request.body);
    if (!parseResult.success) {
      throw new AppError(ERROR_CODES.VALIDATION_ERROR, 'Invalid data', 400);
    }

    const data = parseResult.data;
    const setClauses: string[] = ['updated_at = NOW()'];
    const params: unknown[] = [];
    let paramIdx = 1;

    if (data.roles) { setClauses.push(`roles = $${paramIdx}`); params.push(data.roles); paramIdx++; }
    if (data.looking_for) { setClauses.push(`looking_for = $${paramIdx}`); params.push(data.looking_for); paramIdx++; }
    if (data.can_offer) { setClauses.push(`can_offer = $${paramIdx}`); params.push(data.can_offer); paramIdx++; }
    if (data.tags) { setClauses.push(`tags = $${paramIdx}`); params.push(data.tags); paramIdx++; }

    params.push(id, session.userId);
    const result = await query(
      `UPDATE activity_participants SET ${setClauses.join(', ')} WHERE activity_id = $${paramIdx} AND user_id = $${paramIdx + 1}`,
      params
    );

    return reply.send({ success: true });
  });

  // ============================================
  // GET /v1/activities/:id/participants — 浏览参与者
  // ============================================
  fastify.get('/v1/activities/:id/participants', async (request: FastifyRequest, reply: FastifyReply) => {
    const session = await requireSession(request);
    const { id } = request.params as { id: string };
    const { role, limit = '20', offset = '0' } = request.query as { role?: string; limit?: string; offset?: string };

    let whereClause = 'WHERE ap.activity_id = $1 AND ap.is_visible = true AND ap.user_id != $2';
    const params: unknown[] = [id, session.userId];

    if (role && VALID_ROLES.includes(role as any)) {
      params.push(role);
      whereClause += ` AND $${params.length} = ANY(ap.roles)`;
    }

    // 检查活动是否匿名
    const activity = await queryOne<{ is_anonymous: boolean }>(
      `SELECT is_anonymous FROM activities WHERE id = $1`, [id]
    );

    const participants = await queryMany<{
      user_id: string; roles: string[]; looking_for: string | null; can_offer: string | null;
      tags: string[]; display_name: string | null; industry: string | null;
      job_title: string | null; bio_md: string | null; image: string | null;
    }>(
      `SELECT ap.user_id, ap.roles, ap.looking_for, ap.can_offer, ap.tags,
              op.display_name, op.industry, op.job_title, op.bio_md,
              u.image
       FROM activity_participants ap
       LEFT JOIN owner_profiles op ON op.user_id = ap.user_id
       LEFT JOIN users u ON u.id = ap.user_id
       ${whereClause}
       ORDER BY ap.created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, parseInt(limit, 10), parseInt(offset, 10)]
    );

    return reply.send({
      success: true,
      data: {
        participants: participants.map(p => ({
          user_id: p.user_id,
          roles: p.roles,
          looking_for: p.looking_for,
          can_offer: p.can_offer,
          tags: p.tags,
          // 匿名模式下隐藏真实信息
          display_name: activity?.is_anonymous ? null : p.display_name,
          industry: p.industry,
          job_title: activity?.is_anonymous ? null : p.job_title,
          bio_summary: activity?.is_anonymous ? null : (p.bio_md ? p.bio_md.substring(0, 100) + '...' : null),
          avatar: activity?.is_anonymous ? null : p.image,
        })),
      },
    });
  });

  // ============================================
  // POST /v1/activities/:id/explore — 触发 AI 探索批次
  // ============================================
  fastify.post('/v1/activities/:id/explore', async (request: FastifyRequest, reply: FastifyReply) => {
    const session = await requireSession(request);
    const { id } = request.params as { id: string };

    // TODO: 管理员权限检查
    const activity = await queryOne<{ id: string; ai_explore_rounds: number; max_explorations_per_user: number }>(
      `SELECT id, ai_explore_rounds, max_explorations_per_user FROM activities WHERE id = $1 AND status = 'active'`,
      [id]
    );
    if (!activity) {
      throw new AppError(ERROR_CODES.NOT_FOUND, 'Active activity not found', 404);
    }

    // 获取所有参与者
    const participants = await queryMany<{
      user_id: string; roles: string[]; looking_for: string | null;
      can_offer: string | null; tags: string[]; industry: string | null;
    }>(
      `SELECT ap.user_id, ap.roles, ap.looking_for, ap.can_offer, ap.tags, op.industry
       FROM activity_participants ap
       LEFT JOIN owner_profiles op ON op.user_id = ap.user_id
       WHERE ap.activity_id = $1 AND ap.is_visible = true`,
      [id]
    );

    if (participants.length < 2) {
      throw new AppError(ERROR_CODES.VALIDATION_ERROR, 'Need at least 2 participants', 400);
    }

    // 获取已有探索配对，避免重复
    const existingPairs = await queryMany<{ user_a_id: string; user_b_id: string }>(
      `SELECT user_a_id, user_b_id FROM ai_explorations WHERE activity_id = $1`,
      [id]
    );
    const pairSet = new Set(existingPairs.map(p => [p.user_a_id, p.user_b_id].sort().join(':')));

    // 生成匹配配对
    const newExplorations: { user_a_id: string; user_b_id: string; score: number }[] = [];

    for (let i = 0; i < participants.length; i++) {
      for (let j = i + 1; j < participants.length; j++) {
        const a = participants[i]!;
        const b = participants[j]!;
        const pairKey = [a.user_id, b.user_id].sort().join(':');

        if (pairSet.has(pairKey)) continue;

        // 计算匹配分
        const score = calculateMatchScore(a, b);
        if (score > 0.1) {
          newExplorations.push({ user_a_id: a.user_id, user_b_id: b.user_id, score });
        }
      }
    }

    // 按分数排序，取 top N
    newExplorations.sort((a, b) => b.score - a.score);
    const toCreate = newExplorations.slice(0, 50); // 每次最多创建 50 个

    // 查找每个用户的 agent
    let createdCount = 0;
    for (const pair of toCreate) {
      const agentA = await queryOne<{ id: string }>(
        `SELECT id FROM agents WHERE owner_user_id = $1 AND status = 'claimed' LIMIT 1`,
        [pair.user_a_id]
      );
      const agentB = await queryOne<{ id: string }>(
        `SELECT id FROM agents WHERE owner_user_id = $1 AND status = 'claimed' LIMIT 1`,
        [pair.user_b_id]
      );

      await query(
        `INSERT INTO ai_explorations (activity_id, user_a_id, user_b_id, agent_a_id, agent_b_id, max_rounds, match_score)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [id, pair.user_a_id, pair.user_b_id, agentA?.id || null, agentB?.id || null, activity.ai_explore_rounds, pair.score]
      );
      createdCount++;
    }

    // 异步执行 AI 对话（不阻塞请求）
    if (createdCount > 0) {
      runPendingExplorations(id).catch(err => {
        fastify.log.error(err, 'Background exploration execution failed');
      });
    }

    return reply.send({
      success: true,
      data: {
        created: createdCount,
        total_candidates: newExplorations.length,
      },
    });
  });

  // ============================================
  // GET /v1/activities/:id/explorations — 我的探索结果列表
  // ============================================
  fastify.get('/v1/activities/:id/explorations', async (request: FastifyRequest, reply: FastifyReply) => {
    const session = await requireSession(request);
    const { id } = request.params as { id: string };
    const { filter = 'all', limit = '20', offset = '0' } = request.query as { filter?: string; limit?: string; offset?: string };

    // 基础查询：我参与的探索
    let decisionFilter = '';
    if (filter === 'pending') {
      decisionFilter = `AND (
        (e.user_a_id = $2 AND e.decision_a = 'pending') OR
        (e.user_b_id = $2 AND e.decision_b = 'pending')
      )`;
    } else if (filter === 'want_chat') {
      decisionFilter = `AND (
        (e.user_a_id = $2 AND e.decision_a = 'want_chat') OR
        (e.user_b_id = $2 AND e.decision_b IN ('want_chat', 'accept'))
      )`;
    } else if (filter === 'passed') {
      decisionFilter = `AND (
        (e.user_a_id = $2 AND e.decision_a = 'pass') OR
        (e.user_b_id = $2 AND e.decision_b = 'pass')
      )`;
    }

    const explorations = await queryMany<{
      id: string; user_a_id: string; user_b_id: string; status: string;
      total_rounds: number; max_rounds: number;
      match_score: number | null; match_highlights: any;
      summary_for_a: string | null; summary_for_b: string | null;
      collaboration_potential: string | null;
      decision_a: string; decision_b: string;
      chat_requested_by: string | null; dm_request_id: string | null;
      reveal_level_a: number; reveal_level_b: number;
      created_at: Date; completed_at: Date | null;
      other_roles: string[]; other_tags: string[];
      other_looking_for: string | null; other_industry: string | null;
    }>(
      `SELECT e.id, e.user_a_id, e.user_b_id, e.status,
              e.total_rounds, e.max_rounds,
              e.match_score, e.match_highlights,
              e.summary_for_a, e.summary_for_b,
              e.collaboration_potential,
              e.decision_a, e.decision_b,
              e.chat_requested_by, e.dm_request_id,
              e.reveal_level_a, e.reveal_level_b,
              e.created_at, e.completed_at,
              ap.roles as other_roles, ap.tags as other_tags,
              ap.looking_for as other_looking_for,
              op.industry as other_industry
       FROM ai_explorations e
       LEFT JOIN activity_participants ap ON ap.activity_id = e.activity_id AND ap.user_id = (
         CASE WHEN e.user_a_id = $2 THEN e.user_b_id ELSE e.user_a_id END
       )
       LEFT JOIN owner_profiles op ON op.user_id = (
         CASE WHEN e.user_a_id = $2 THEN e.user_b_id ELSE e.user_a_id END
       )
       WHERE e.activity_id = $1
         AND (e.user_a_id = $2 OR e.user_b_id = $2)
         AND e.status = 'completed'
         ${decisionFilter}
       ORDER BY e.match_score DESC NULLS LAST, e.completed_at DESC
       LIMIT $3 OFFSET $4`,
      [id, session.userId, parseInt(limit, 10), parseInt(offset, 10)]
    );

    return reply.send({
      success: true,
      data: {
        explorations: explorations.map(e => {
          const iAmA = e.user_a_id === session.userId;
          const myDecision = iAmA ? e.decision_a : e.decision_b;
          const otherDecision = iAmA ? e.decision_b : e.decision_a;
          const mySummary = iAmA ? e.summary_for_a : e.summary_for_b;
          const myRevealLevel = iAmA ? e.reveal_level_a : e.reveal_level_b;

          return {
            id: e.id,
            status: e.status,
            total_rounds: e.total_rounds,
            max_rounds: e.max_rounds,
            match_score: e.match_score,
            match_highlights: e.match_highlights,
            summary: myRevealLevel >= 2 ? mySummary : null,
            summary_preview: mySummary ? mySummary.substring(0, 80) + '...' : null,
            collaboration_potential: myRevealLevel >= 2 ? e.collaboration_potential : null,
            my_decision: myDecision,
            other_decision: otherDecision,
            chat_requested_by: e.chat_requested_by,
            dm_request_id: e.dm_request_id,
            reveal_level: myRevealLevel,
            other_party: {
              roles: e.other_roles,
              tags: e.other_tags,
              looking_for: e.other_looking_for,
              industry: e.other_industry,
            },
            created_at: e.created_at,
            completed_at: e.completed_at,
          };
        }),
      },
    });
  });

  // ============================================
  // GET /v1/explorations/:id — 探索详情 (渐进揭秘)
  // ============================================
  fastify.get('/v1/explorations/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const session = await requireSession(request);
    const { id } = request.params as { id: string };

    const exploration = await queryOne<any>(
      `SELECT e.*,
              ap_a.roles as roles_a, ap_a.looking_for as looking_for_a, ap_a.can_offer as can_offer_a, ap_a.tags as tags_a,
              ap_b.roles as roles_b, ap_b.looking_for as looking_for_b, ap_b.can_offer as can_offer_b, ap_b.tags as tags_b,
              op_a.industry as industry_a, op_a.display_name as name_a,
              op_a.job_title as job_title_a, op_a.looking_for as owner_looking_for_a,
              op_a.can_offer as owner_can_offer_a, op_a.topics_of_interest as topics_a,
              op_b.industry as industry_b, op_b.display_name as name_b,
              op_b.job_title as job_title_b, op_b.looking_for as owner_looking_for_b,
              op_b.can_offer as owner_can_offer_b, op_b.topics_of_interest as topics_b
       FROM ai_explorations e
       LEFT JOIN activity_participants ap_a ON ap_a.activity_id = e.activity_id AND ap_a.user_id = e.user_a_id
       LEFT JOIN activity_participants ap_b ON ap_b.activity_id = e.activity_id AND ap_b.user_id = e.user_b_id
       LEFT JOIN owner_profiles op_a ON op_a.user_id = e.user_a_id
       LEFT JOIN owner_profiles op_b ON op_b.user_id = e.user_b_id
       WHERE e.id = $1 AND (e.user_a_id = $2 OR e.user_b_id = $2)`,
      [id, session.userId]
    );

    if (!exploration) {
      throw new AppError(ERROR_CODES.NOT_FOUND, 'Exploration not found', 404);
    }

    const iAmA = exploration.user_a_id === session.userId;

    // 自动更新 reveal_level (查看详情 = 至少第 2 层)
    const currentLevel = iAmA ? exploration.reveal_level_a : exploration.reveal_level_b;
    if (currentLevel < 2) {
      const levelCol = iAmA ? 'reveal_level_a' : 'reveal_level_b';
      await query(`UPDATE ai_explorations SET ${levelCol} = 2 WHERE id = $1`, [id]);
    }

    // 获取对话记录
    const messages = await queryMany<{
      id: string; round_number: number; sender_side: string; content: string; created_at: Date;
    }>(
      `SELECT id, round_number, sender_side, content, created_at
       FROM ai_exploration_messages
       WHERE exploration_id = $1
       ORDER BY round_number, created_at`,
      [id]
    );

    // 如果查看了对话，更新到第 3 层
    if (messages.length > 0 && currentLevel < 3) {
      const levelCol = iAmA ? 'reveal_level_a' : 'reveal_level_b';
      await query(`UPDATE ai_explorations SET ${levelCol} = 3 WHERE id = $1`, [id]);
    }

    const mySummary = iAmA ? exploration.summary_for_a : exploration.summary_for_b;
    const myDecision = iAmA ? exploration.decision_a : exploration.decision_b;
    const otherDecision = iAmA ? exploration.decision_b : exploration.decision_a;

    // 检查活动是否匿名（DM explorations have no activity）
    const isDM = exploration.source === 'dm' || !exploration.activity_id;
    let isAnonymous = false;
    if (!isDM && exploration.activity_id) {
      const activity = await queryOne<{ is_anonymous: boolean }>(
        `SELECT is_anonymous FROM activities WHERE id = $1`, [exploration.activity_id]
      );
      isAnonymous = activity?.is_anonymous ?? false;
    }

    // For DM explorations, fall back to owner_profiles data when activity_participants data is NULL
    const otherRoles = (iAmA ? exploration.roles_b : exploration.roles_a) || [];
    const otherLookingFor = (iAmA ? exploration.looking_for_b : exploration.looking_for_a)
      || (iAmA ? exploration.owner_looking_for_b : exploration.owner_looking_for_a);
    const otherCanOffer = (iAmA ? exploration.can_offer_b : exploration.can_offer_a)
      || (iAmA ? exploration.owner_can_offer_b : exploration.owner_can_offer_a);
    const otherTags = (iAmA ? exploration.tags_b : exploration.tags_a)
      || (iAmA ? exploration.topics_b : exploration.topics_a) || [];

    return reply.send({
      success: true,
      data: {
        exploration: {
          id: exploration.id,
          activity_id: exploration.activity_id,
          source: exploration.source || 'activity',
          status: exploration.status,
          match_score: exploration.match_score,
          match_highlights: exploration.match_highlights,
          summary: mySummary,
          collaboration_potential: exploration.collaboration_potential,
          my_decision: myDecision,
          other_decision: otherDecision,
          chat_requested_by: exploration.chat_requested_by,
          dm_request_id: exploration.dm_request_id,
          total_rounds: exploration.total_rounds,
          other_party: {
            roles: otherRoles,
            looking_for: otherLookingFor,
            can_offer: otherCanOffer,
            tags: otherTags,
            industry: iAmA ? exploration.industry_b : exploration.industry_a,
            display_name: isAnonymous ? null : (iAmA ? exploration.name_b : exploration.name_a),
            job_title: isAnonymous ? null : (iAmA ? exploration.job_title_b : exploration.job_title_a),
          },
        },
        messages: messages.map(m => ({
          id: m.id,
          round: m.round_number,
          side: m.sender_side,
          is_mine: (iAmA && m.sender_side === 'A') || (!iAmA && m.sender_side === 'B'),
          content: m.content,
          created_at: m.created_at,
        })),
      },
    });
  });

  // ============================================
  // POST /v1/explorations/:id/decide — 提交决策 (标注)
  // ============================================
  fastify.post('/v1/explorations/:id/decide', async (request: FastifyRequest, reply: FastifyReply) => {
    const session = await requireSession(request);
    const { id } = request.params as { id: string };

    const parseResult = decideSchema.safeParse(request.body);
    if (!parseResult.success) {
      throw new AppError(ERROR_CODES.VALIDATION_ERROR, 'Invalid decision data', 400);
    }

    const { decision, reason, is_public } = parseResult.data;
    const result = await executeExplorationDecision(id, session.userId, decision, reason);

    // 如果用户选择公开此对战
    if (is_public === true) {
      await query(
        `UPDATE ai_explorations SET is_public = TRUE WHERE id = $1
         AND (user_a_id = $2 OR user_b_id = $2)`,
        [id, session.userId]
      );
    }

    return reply.send({ success: true, data: result });
  });

  // ============================================
  // POST /v1/explorations/:id/respond — 响应聊天请求 (接受/拒绝)
  // ============================================
  fastify.post('/v1/explorations/:id/respond', async (request: FastifyRequest, reply: FastifyReply) => {
    const session = await requireSession(request);
    const { id } = request.params as { id: string };

    const responseSchema = z.object({
      action: z.enum(['accept', 'reject']),
      reason: z.string().max(500).optional(),
    });

    const parseResult = responseSchema.safeParse(request.body);
    if (!parseResult.success) {
      throw new AppError(ERROR_CODES.VALIDATION_ERROR, 'Invalid response data', 400);
    }

    const { action, reason } = parseResult.data;

    const exploration = await queryOne<{
      id: string; user_a_id: string; user_b_id: string; activity_id: string | null;
      source: string; chat_requested_by: string | null; dm_request_id: string | null;
    }>(
      `SELECT id, user_a_id, user_b_id, activity_id, source, chat_requested_by, dm_request_id
       FROM ai_explorations WHERE id = $1 AND (user_a_id = $2 OR user_b_id = $2)`,
      [id, session.userId]
    );

    if (!exploration) {
      throw new AppError(ERROR_CODES.NOT_FOUND, 'Exploration not found', 404);
    }

    const iAmA: boolean = exploration.user_a_id === session.userId;
    const decisionCol = iAmA ? 'decision_a' : 'decision_b';
    const reasonCol = iAmA ? 'decision_a_reason' : 'decision_b_reason';
    const atCol = iAmA ? 'decision_a_at' : 'decision_b_at';

    if (action === 'reject') {
      await query(
        `UPDATE ai_explorations SET ${decisionCol} = 'reject', ${reasonCol} = $1, ${atCol} = NOW() WHERE id = $2`,
        [reason || null, id]
      );

      // 拒绝 DM 请求
      if (exploration.dm_request_id) {
        await query(
          `UPDATE dm_requests SET status = 'rejected', reject_reason = $1, responded_at = NOW() WHERE id = $2`,
          [reason || 'Declined from exploration', exploration.dm_request_id]
        );
      }

      // 通知发起方
      const requesterId = iAmA ? exploration.user_b_id : exploration.user_a_id;
      await query(
        `INSERT INTO agent_notifications (owner_user_id, type, title, content, metadata)
         VALUES ($1, 'system', 'Chat request declined', 'Your networking chat request was declined.', $2)`,
        [requesterId, JSON.stringify({ exploration_id: id })]
      );

      return reply.send({ success: true, data: { action: 'reject' } });
    }

    // action === 'accept'
    await query(
      `UPDATE ai_explorations SET ${decisionCol} = 'accept', ${atCol} = NOW() WHERE id = $1`,
      [id]
    );

    // 接受 DM 请求并创建 session
    if (exploration.dm_request_id) {
      await query(
        `UPDATE dm_requests SET status = 'accepted', responded_at = NOW() WHERE id = $1`,
        [exploration.dm_request_id]
      );

      const activity = exploration.activity_id
        ? await queryOne<{ chat_expiry_hours: number }>(
            `SELECT chat_expiry_hours FROM activities WHERE id = $1`, [exploration.activity_id]
          )
        : null;
      const expiryHours = activity?.chat_expiry_hours || (exploration.source === 'dm' ? 168 : 72);

      const dmReq = await queryOne<{ from_agent_id: string; to_agent_id: string }>(
        `SELECT from_agent_id, to_agent_id FROM dm_requests WHERE id = $1`, [exploration.dm_request_id]
      );

      const sessionIntent = exploration.source === 'dm' ? 'dm' : 'networking';

      if (dmReq) {
        const dmSession = await queryOne<{ id: string }>(
          `INSERT INTO dm_sessions (request_id, initiator_id, target_id, intent, exploration_id, max_messages, expires_at)
           VALUES ($1, $2, $3, $4, $5, 100, NOW() + INTERVAL '${expiryHours} hours')
           RETURNING id`,
          [exploration.dm_request_id, dmReq.from_agent_id, dmReq.to_agent_id, sessionIntent, id]
        );

        // 通知双方
        const notifyUsers = [exploration.user_a_id, exploration.user_b_id];
        for (const uid of notifyUsers) {
          await query(
            `INSERT INTO agent_notifications (owner_user_id, type, title, content, metadata)
             VALUES ($1, 'exploration_ready', 'Chat is ready!', 'Your networking match accepted. Start chatting now!', $2)`,
            [uid, JSON.stringify({ exploration_id: id, dm_session_id: dmSession?.id })]
          );
        }

        return reply.send({
          success: true,
          data: { action: 'accept', dm_session_id: dmSession?.id },
        });
      }
    }

    return reply.send({ success: true, data: { action: 'accept' } });
  });

  // ============================================
  // GET /v1/my/explorations — 聚合所有探索（跨 Room + DM + Activity）
  // ============================================
  fastify.get('/v1/my/explorations', async (request: FastifyRequest, reply: FastifyReply) => {
    const session = await requireSession(request);
    const { filter = 'all', limit = '20', offset = '0' } = request.query as {
      filter?: string;
      limit?: string;
      offset?: string;
    };

    // Build status/decision filter
    let statusFilter = '';
    if (filter === 'pending') {
      // Completed explorations that I haven't decided on yet
      statusFilter = `AND e.status = 'completed' AND (
        (e.user_a_id = $1 AND e.decision_a = 'pending') OR
        (e.user_b_id = $1 AND e.decision_b = 'pending')
      )`;
    } else if (filter === 'in_progress') {
      statusFilter = `AND e.status IN ('pending', 'in_progress')`;
    } else if (filter === 'completed') {
      statusFilter = `AND e.status = 'completed'`;
    } else if (filter === 'decided') {
      statusFilter = `AND e.status = 'completed' AND (
        (e.user_a_id = $1 AND e.decision_a != 'pending') OR
        (e.user_b_id = $1 AND e.decision_b != 'pending')
      )`;
    }

    const explorations = await queryMany<{
      id: string;
      source: string;
      activity_id: string | null;
      room_id: string | null;
      user_a_id: string;
      user_b_id: string;
      status: string;
      total_rounds: number;
      max_rounds: number;
      match_score: number | null;
      match_highlights: any;
      summary_for_a: string | null;
      summary_for_b: string | null;
      collaboration_potential: string | null;
      decision_a: string;
      decision_b: string;
      chat_requested_by: string | null;
      dm_request_id: string | null;
      created_at: Date;
      completed_at: Date | null;
      other_display_name: string | null;
      other_industry: string | null;
      other_job_title: string | null;
      room_name: string | null;
      activity_name: string | null;
    }>(
      `SELECT
         e.id, COALESCE(e.source, 'activity') AS source,
         e.activity_id, e.room_id,
         e.user_a_id, e.user_b_id, e.status,
         e.total_rounds, e.max_rounds, e.match_score,
         e.match_highlights, e.summary_for_a, e.summary_for_b,
         e.collaboration_potential,
         e.decision_a, e.decision_b,
         e.chat_requested_by, e.dm_request_id,
         e.created_at, e.completed_at,
         op.display_name AS other_display_name,
         op.industry AS other_industry,
         op.job_title AS other_job_title,
         r.name AS room_name,
         act.name AS activity_name
       FROM ai_explorations e
       LEFT JOIN owner_profiles op ON op.user_id = CASE
         WHEN e.user_a_id = $1 THEN e.user_b_id
         ELSE e.user_a_id
       END
       LEFT JOIN rooms r ON r.id = e.room_id
       LEFT JOIN activities act ON act.id = e.activity_id
       WHERE (e.user_a_id = $1 OR e.user_b_id = $1)
         ${statusFilter}
       ORDER BY
         CASE WHEN e.status IN ('pending', 'in_progress') THEN 0 ELSE 1 END,
         e.completed_at DESC NULLS LAST,
         e.created_at DESC
       LIMIT $2 OFFSET $3`,
      [session.userId, parseInt(limit, 10), parseInt(offset, 10)],
    );

    // Count stats
    const stats = await queryOne<{
      total: string;
      pending_decision: string;
      in_progress: string;
      decided: string;
    }>(
      `SELECT
         COUNT(*) AS total,
         COUNT(*) FILTER (WHERE e.status = 'completed' AND (
           (e.user_a_id = $1 AND e.decision_a = 'pending') OR
           (e.user_b_id = $1 AND e.decision_b = 'pending')
         )) AS pending_decision,
         COUNT(*) FILTER (WHERE e.status IN ('pending', 'in_progress')) AS in_progress,
         COUNT(*) FILTER (WHERE e.status = 'completed' AND (
           (e.user_a_id = $1 AND e.decision_a != 'pending') OR
           (e.user_b_id = $1 AND e.decision_b != 'pending')
         )) AS decided
       FROM ai_explorations e
       WHERE (e.user_a_id = $1 OR e.user_b_id = $1)`,
      [session.userId],
    );

    return reply.send({
      success: true,
      data: {
        stats: {
          total: parseInt(stats?.total || '0', 10),
          pending_decision: parseInt(stats?.pending_decision || '0', 10),
          in_progress: parseInt(stats?.in_progress || '0', 10),
          decided: parseInt(stats?.decided || '0', 10),
        },
        explorations: explorations.map((e) => {
          const isSideA = e.user_a_id === session.userId;
          return {
            id: e.id,
            source: e.source,
            status: e.status,
            total_rounds: e.total_rounds,
            max_rounds: e.max_rounds,
            match_score: e.match_score,
            match_highlights: e.match_highlights,
            summary: isSideA ? e.summary_for_a : e.summary_for_b,
            collaboration_potential: e.collaboration_potential,
            my_decision: isSideA ? e.decision_a : e.decision_b,
            other_decision: isSideA ? e.decision_b : e.decision_a,
            chat_requested_by: e.chat_requested_by,
            dm_request_id: e.dm_request_id,
            other_party: {
              display_name: e.other_display_name,
              industry: e.other_industry,
              job_title: e.other_job_title,
            },
            context: {
              room_name: e.room_name,
              room_id: e.room_id,
              activity_name: e.activity_name,
              activity_id: e.activity_id,
            },
            created_at: e.created_at.toISOString(),
            completed_at: e.completed_at?.toISOString() || null,
          };
        }),
      },
    });
  });

  // ============================================
  // Room Explorations
  // ============================================

  /**
   * GET /v1/rooms/:roomId/explorations
   * List explorations from a specific room for the current user
   */
  fastify.get<{
    Params: { roomId: string };
  }>('/v1/rooms/:roomId/explorations', async (request, reply) => {
    const session = await verifyUserSession(request);
    if (!session) {
      throw new AppError(ERROR_CODES.UNAUTHORIZED, 'Login required', 401);
    }

    const { roomId } = request.params;
    const { filter = 'all' } = request.query as { filter?: string };

    // Build status filter
    let statusFilter = '';
    if (filter === 'pending') {
      statusFilter = `AND e.status IN ('pending', 'in_progress')`;
    } else if (filter === 'completed') {
      statusFilter = `AND e.status = 'completed'`;
    }

    const explorations = await queryMany<{
      id: string;
      user_a_id: string;
      user_b_id: string;
      status: string;
      total_rounds: number;
      max_rounds: number;
      match_score: number | null;
      summary_for_a: string | null;
      summary_for_b: string | null;
      match_highlights: any;
      collaboration_potential: string | null;
      decision_a: string;
      decision_b: string;
      created_at: Date;
      completed_at: Date | null;
      other_display_name: string | null;
      other_industry: string | null;
      other_job_title: string | null;
      other_company: string | null;
    }>(
      `SELECT
         e.id, e.user_a_id, e.user_b_id, e.status,
         e.total_rounds, e.max_rounds, e.match_score,
         e.summary_for_a, e.summary_for_b,
         e.match_highlights, e.collaboration_potential,
         e.decision_a, e.decision_b,
         e.created_at, e.completed_at,
         op.display_name AS other_display_name,
         op.industry AS other_industry,
         op.job_title AS other_job_title,
         op.company AS other_company
       FROM ai_explorations e
       LEFT JOIN owner_profiles op ON op.user_id = CASE
         WHEN e.user_a_id = $1 THEN e.user_b_id
         ELSE e.user_a_id
       END
       WHERE e.room_id = $2
         AND e.source = 'room'
         AND (e.user_a_id = $1 OR e.user_b_id = $1)
         ${statusFilter}
       ORDER BY e.created_at DESC
       LIMIT 50`,
      [session.userId, roomId],
    );

    return reply.send({
      success: true,
      data: {
        explorations: explorations.map((e) => {
          const isSideA = e.user_a_id === session.userId;
          return {
            id: e.id,
            status: e.status,
            total_rounds: e.total_rounds,
            max_rounds: e.max_rounds,
            match_score: e.match_score,
            summary: isSideA ? e.summary_for_a : e.summary_for_b,
            match_highlights: e.match_highlights,
            collaboration_potential: e.collaboration_potential,
            my_decision: isSideA ? e.decision_a : e.decision_b,
            other_decision: isSideA ? e.decision_b : e.decision_a,
            other_party: {
              display_name: e.other_display_name,
              industry: e.other_industry,
              job_title: e.other_job_title,
              company: e.other_company,
            },
            created_at: e.created_at.toISOString(),
            completed_at: e.completed_at?.toISOString() || null,
          };
        }),
      },
    });
  });

  // ============================================
  // GET /v1/explorations/:id/public — 公开观战（无需 auth）
  // ============================================
  fastify.get('/v1/explorations/:id/public', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };

    const exploration = await queryOne<{
      id: string;
      status: string;
      is_public: boolean;
      match_score: number | null;
      match_highlights: unknown;
      collaboration_potential: string | null;
      total_rounds: number;
      max_rounds: number;
      decision_a: string;
      decision_b: string;
      completed_at: string | null;
      created_at: string;
      agent_a_name: string | null;
      agent_b_name: string | null;
      owner_a_name: string | null;
      owner_b_name: string | null;
    }>(
      `SELECT ae.id, ae.status, ae.is_public, ae.match_score, ae.match_highlights,
              ae.collaboration_potential, ae.total_rounds, ae.max_rounds,
              ae.decision_a, ae.decision_b, ae.completed_at, ae.created_at,
              a_agent.name AS agent_a_name,
              b_agent.name AS agent_b_name,
              a_owner.display_name AS owner_a_name,
              b_owner.display_name AS owner_b_name
       FROM ai_explorations ae
       LEFT JOIN agents a_agent ON a_agent.id = ae.agent_a_id
       LEFT JOIN agents b_agent ON b_agent.id = ae.agent_b_id
       LEFT JOIN owner_profiles a_owner ON a_owner.user_id = ae.user_a_id
       LEFT JOIN owner_profiles b_owner ON b_owner.user_id = ae.user_b_id
       WHERE ae.id = $1`,
      [id]
    );

    if (!exploration) {
      throw new AppError(ERROR_CODES.NOT_FOUND, 'Exploration not found', 404);
    }

    if (!exploration.is_public) {
      throw new AppError(ERROR_CODES.FORBIDDEN, 'This exploration is not public', 403);
    }

    const messages = await queryMany<{
      id: string;
      round: number;
      side: string;
      content: string;
      created_at: string;
    }>(
      `SELECT id, round, side, content, created_at
       FROM exploration_messages
       WHERE exploration_id = $1
       ORDER BY round ASC, side ASC`,
      [id]
    );

    return reply.send({ exploration, messages });
  });

  // ============================================
  // PATCH /v1/explorations/:id/public — 设置公开/私密（需 auth，本人）
  // ============================================
  fastify.patch('/v1/explorations/:id/public', async (request: FastifyRequest, reply: FastifyReply) => {
    const session = await requireSession(request);
    const { id } = request.params as { id: string };
    const { is_public } = request.body as { is_public: boolean };

    const exploration = await queryOne<{ id: string }>(
      `SELECT id FROM ai_explorations
       WHERE id = $1 AND (user_a_id = $2 OR user_b_id = $2) AND status = 'completed'`,
      [id, session.userId]
    );

    if (!exploration) {
      throw new AppError(ERROR_CODES.NOT_FOUND, 'Exploration not found or not completed', 404);
    }

    await query(
      `UPDATE ai_explorations SET is_public = $1 WHERE id = $2`,
      [is_public, id]
    );

    return reply.send({ success: true, is_public });
  });
}

// ============================================
// Match Score Calculator
// ============================================

function calculateMatchScore(
  a: { roles: string[]; tags: string[]; industry: string | null; looking_for: string | null },
  b: { roles: string[]; tags: string[]; industry: string | null; looking_for: string | null }
): number {
  let score = 0;

  // 1. 角色互补分 (权重 0.4)
  let roleScore = 0;
  for (const roleA of a.roles) {
    const complements = COMPLEMENTARY_PAIRS[roleA] || [];
    for (const roleB of b.roles) {
      if (complements.includes(roleB)) {
        roleScore = Math.max(roleScore, 1.0);
      }
    }
  }
  score += roleScore * 0.4;

  // 2. 行业匹配分 (权重 0.2)
  if (a.industry && b.industry) {
    if (a.industry.toLowerCase() === b.industry.toLowerCase()) {
      score += 0.2;
    }
  }

  // 3. 标签重叠分 (权重 0.2) — Jaccard 相似度
  if (a.tags.length > 0 && b.tags.length > 0) {
    const setA = new Set(a.tags.map(t => t.toLowerCase()));
    const setB = new Set(b.tags.map(t => t.toLowerCase()));
    const intersection = [...setA].filter(x => setB.has(x)).length;
    const union = new Set([...setA, ...setB]).size;
    score += (intersection / union) * 0.2;
  }

  // 4. 随机因子 (权重 0.2) — 避免总推同样的人
  score += Math.random() * 0.2;

  return Math.min(score, 1.0);
}
