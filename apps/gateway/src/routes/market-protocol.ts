/**
 * Market Protocol Routes
 * 市场驱动协议 API：预算、声誉、对齐度
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { verifyUserSession } from '../lib/auth.js';
import { AppError, ERROR_CODES } from '../lib/errors.js';
import { getBudgetStatus, getWeekStart, updateUserBudgetPreference } from '../lib/attention-budget.js';
import { getPublicProfile, getEvents } from '../lib/reputation.js';
import { previewAlignment } from '../lib/alignment-check.js';

// ============================================
// Dev Mode Helpers
// ============================================

function isDevUser(userId: string): boolean {
  return userId.startsWith('dev_');
}

function devBudgetData() {
  return {
    inbound: { allowed: true, used: 0, limit: 10, remaining: 10 },
    outbound_unlimited: true as const,
    week_start: getWeekStart(),
    preferences: {
      inbound_limit: 10,
      overflow_policy: 'queue' as const,
      priority_by_reputation: true,
    },
  };
}

function devReputationData() {
  return {
    reputation_score: 60,
    hit_rate: 0,
    avg_post_chat_rating: null,
    in_cooldown: false,
  };
}

// ============================================
// Routes
// ============================================

export async function marketProtocolRoutes(fastify: FastifyInstance): Promise<void> {

  // ============================================
  // GET /v1/protocol/budget - 获取当前用户的注意力预算
  // ============================================
  fastify.get('/v1/protocol/budget', async (request: FastifyRequest, reply: FastifyReply) => {
    const session = await verifyUserSession(request);
    if (!session) {
      throw new AppError(ERROR_CODES.UNAUTHORIZED, 'Login required', 401);
    }

    if (isDevUser(session.userId)) {
      return reply.send({ success: true, data: devBudgetData() });
    }

    const budget = await getBudgetStatus(session.userId);

    return reply.send({
      success: true,
      data: budget,
    });
  });

  // ============================================
  // PUT /v1/protocol/budget/preferences - 更新预算偏好设置
  // ============================================
  fastify.put('/v1/protocol/budget/preferences', async (request: FastifyRequest, reply: FastifyReply) => {
    const session = await verifyUserSession(request);
    if (!session) {
      throw new AppError(ERROR_CODES.UNAUTHORIZED, 'Login required', 401);
    }

    const schema = z.object({
      inbound_limit: z.number().int().min(-1).max(999).optional(),  // -1 = unlimited
      overflow_policy: z.enum(['queue', 'reject']).optional(),
      priority_by_reputation: z.boolean().optional(),
    });

    const parseResult = schema.safeParse(request.body);
    if (!parseResult.success) {
      throw new AppError(ERROR_CODES.VALIDATION_ERROR, 'Invalid preferences', 400);
    }

    if (isDevUser(session.userId)) {
      return reply.send({ success: true, data: devBudgetData().preferences });
    }

    const updated = await updateUserBudgetPreference(session.userId, parseResult.data);

    return reply.send({
      success: true,
      data: updated,
    });
  });

  // ============================================
  // GET /v1/protocol/reputation - 获取当前用户的声誉账本
  // ============================================
  fastify.get('/v1/protocol/reputation', async (request: FastifyRequest, reply: FastifyReply) => {
    const session = await verifyUserSession(request);
    if (!session) {
      throw new AppError(ERROR_CODES.UNAUTHORIZED, 'Login required', 401);
    }

    if (isDevUser(session.userId)) {
      return reply.send({ success: true, data: devReputationData() });
    }

    const profile = await getPublicProfile(session.userId);

    return reply.send({
      success: true,
      data: profile,
    });
  });

  // ============================================
  // GET /v1/protocol/reputation/:userId - 获取其他用户的公开声誉
  // ============================================
  fastify.get('/v1/protocol/reputation/:userId', async (request: FastifyRequest, reply: FastifyReply) => {
    const { userId } = request.params as { userId: string };

    if (isDevUser(userId)) {
      return reply.send({ success: true, data: devReputationData() });
    }

    const profile = await getPublicProfile(userId);

    return reply.send({
      success: true,
      data: profile,
    });
  });

  // ============================================
  // GET /v1/protocol/reputation/events - 获取声誉事件历史
  // ============================================
  fastify.get('/v1/protocol/reputation/events', async (request: FastifyRequest, reply: FastifyReply) => {
    const session = await verifyUserSession(request);
    if (!session) {
      throw new AppError(ERROR_CODES.UNAUTHORIZED, 'Login required', 401);
    }

    if (isDevUser(session.userId)) {
      return reply.send({ success: true, data: { events: [] } });
    }

    const { limit } = request.query as { limit?: string };
    const eventLimit = Math.min(parseInt(limit || '50', 10), 100);

    const events = await getEvents(session.userId, eventLimit);

    return reply.send({
      success: true,
      data: { events },
    });
  });

  // ============================================
  // POST /v1/protocol/alignment/preview - 预览对齐度
  // ============================================
  fastify.post('/v1/protocol/alignment/preview', async (request: FastifyRequest, reply: FastifyReply) => {
    const session = await verifyUserSession(request);
    if (!session) {
      throw new AppError(ERROR_CODES.UNAUTHORIZED, 'Login required', 401);
    }

    const schema = z.object({
      target_user_id: z.string().uuid(),
      activity_id: z.string().uuid().optional(),
    });

    const parseResult = schema.safeParse(request.body);
    if (!parseResult.success) {
      throw new AppError(ERROR_CODES.VALIDATION_ERROR, 'target_user_id is required', 400);
    }

    const { target_user_id, activity_id } = parseResult.data;

    const result = await previewAlignment(session.userId, target_user_id, activity_id);

    return reply.send({
      success: true,
      data: {
        alignment: result,
        threshold: 0.65,
        would_pass: result.passed,
      },
    });
  });
}
