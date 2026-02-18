/**
 * DM Routes
 * Direct Message: 有边界的点对点协作通道
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { query, queryOne, queryMany } from '../db/client.js';
import { verifyAgentToken, verifyUserSession } from '../lib/auth.js';
import { AppError, ERROR_CODES } from '../lib/errors.js';
import { config } from '../lib/config.js';
import { createDMRoom, sendMessage, isMatrixEnabled, isMatrixReady } from '../lib/matrix.js';
import { checkCooldown, recordEvent, getOrCreateLedger, updatePostChatRating } from '../lib/reputation.js';
import { checkInboundBudget, consumeInbound } from '../lib/attention-budget.js';
import { checkAlignment } from '../lib/alignment-check.js';

// ============================================
// Types
// ============================================

interface DMRequestRow {
  id: string;
  from_agent_id: string;
  to_agent_id: string;
  intent: string;
  context_ref: string | null;
  status: string;
  reject_reason: string | null;
  created_at: Date;
  responded_at: Date | null;
  expires_at: Date;
}

interface DMSessionRow {
  id: string;
  request_id: string;
  initiator_id: string;
  target_id: string;
  intent: string;
  status: string;
  message_count: number;
  max_messages: number;
  matrix_room_id: string | null;
  created_at: Date;
  closed_at: Date | null;
  close_reason: string | null;
  expires_at: Date;
}

interface DMMessageRow {
  id: string;
  session_id: string;
  sender_id: string;
  content: string;
  context: string | null;
  question: string | null;
  expected_output: string | null;
  matrix_event_id: string | null;
  created_at: Date;
}

interface AgentRow {
  id: string;
  name: string;
  twitter_handle: string | null;
  matrix_user_id: string | null;
  matrix_access_token: string | null;
}

// ============================================
// Validation Schemas
// ============================================

const VALID_INTENTS = ['clarify', 'coordinate', 'handoff', 'feedback'] as const;
const VALID_EXPECTED_OUTPUTS = ['clarification', 'yes_no', 'short_answer', 'confirmation'] as const;

const createDMRequestSchema = z.object({
  to_agent_id: z.string().uuid(),
  intent: z.enum(VALID_INTENTS),
  context_ref: z.string().uuid().optional(),
  activity_id: z.string().uuid().optional(),
});

const respondDMRequestSchema = z.object({
  action: z.enum(['accept', 'reject']),
  reason: z.string().max(500).optional(),
});

const sendDMMessageSchema = z.object({
  content: z.string().min(1).max(2000),
  context: z.string().max(500).optional(),
  question: z.string().max(500).optional(),
  expected_output: z.enum(VALID_EXPECTED_OUTPUTS).optional(),
});

const closeDMSchema = z.object({
  reason: z.string().max(200).optional(),
});

// ============================================
// Routes
// ============================================

export async function dmRoutes(fastify: FastifyInstance) {
  
  // ============================================
  // POST /v1/dm/request - 发起 DM 请求
  // ============================================
  fastify.post('/v1/dm/request', async (request: FastifyRequest, reply: FastifyReply) => {
    // 验证 Agent Token
    const authResult = await verifyAgentToken(request);
    if (!authResult) {
      throw new AppError(ERROR_CODES.UNAUTHORIZED, 'Agent token required', 401);
    }

    // 解析请求体
    const parseResult = createDMRequestSchema.safeParse(request.body);
    if (!parseResult.success) {
      throw new AppError(ERROR_CODES.VALIDATION_ERROR, 'Invalid request body', 400);
    }

    const { to_agent_id, intent, context_ref, activity_id } = parseResult.data;
    const fromAgentId = authResult.agentId!;

    // 检查不能 DM 自己
    if (to_agent_id === fromAgentId) {
      throw new AppError(ERROR_CODES.VALIDATION_ERROR, 'Cannot send DM request to yourself', 400);
    }

    // ============================================
    // 检查资料完整度（方案 B：DM 时强制检查）
    // ============================================
    const profileCheck = await queryOne<{
      display_name: string | null;
      industry: string | null;
      job_title: string | null;
      bio_md: string;
      topics_of_interest: string[];
      agent_role: string | null;
      focus_topics: string[] | null;
    }>(
      `SELECT 
        op.display_name,
        op.industry,
        op.job_title,
        op.bio_md,
        op.topics_of_interest,
        aoc.agent_role,
        aoc.focus_topics
      FROM agents a
      JOIN owner_profiles op ON a.owner_user_id = op.user_id
      LEFT JOIN agent_owner_config aoc ON a.id = aoc.agent_id AND aoc.owner_id = op.user_id
      WHERE a.id = $1`,
      [fromAgentId]
    );

    if (!profileCheck) {
      throw new AppError(ERROR_CODES.FORBIDDEN, 'Owner profile not found', 403);
    }

    // 计算缺失字段
    const missing: string[] = [];
    const requirements: Record<string, boolean> = {};

    // Display name
    requirements.display_name = !!(profileCheck.display_name && profileCheck.display_name.trim().length >= 1);
    if (!requirements.display_name) {
      missing.push('display_name');
    }

    // Industry
    requirements.industry = !!(profileCheck.industry && profileCheck.industry.trim().length > 0);
    if (!requirements.industry) {
      missing.push('industry');
    }

    // Job title（至少 5 字）
    requirements.job_title = !!(profileCheck.job_title && profileCheck.job_title.trim().length >= 5);
    if (!requirements.job_title) {
      missing.push('job_title');
    }

    // Bio（至少 50 字）
    requirements.bio = !!(profileCheck.bio_md && profileCheck.bio_md.trim().length >= 50);
    if (!requirements.bio) {
      missing.push('bio');
    }

    // Topics（至少 3 个）
    requirements.topics = !!(profileCheck.topics_of_interest && profileCheck.topics_of_interest.length >= 3);
    if (!requirements.topics) {
      missing.push('topics');
    }

    // Agent 角色（至少 20 字）
    requirements.agent_role = !!(profileCheck.agent_role && profileCheck.agent_role.trim().length >= 20);
    if (!requirements.agent_role) {
      missing.push('agent_role');
    }

    // Agent 专长话题（至少 3 个）
    requirements.agent_specialties = !!(profileCheck.focus_topics && profileCheck.focus_topics.length >= 3);
    if (!requirements.agent_specialties) {
      missing.push('agent_specialties');
    }

    // 如果资料不完整，拒绝 DM 请求
    if (missing.length > 0) {
      const completionRate = Math.round(((7 - missing.length) / 7) * 100);
      
      throw new AppError(
        ERROR_CODES.FORBIDDEN,
        'Profile incomplete: DM feature requires complete profile',
        403,
        `Your profile is ${completionRate}% complete. Please complete the following fields: ${missing.join(', ')}`,
        {
          profile_completion: {
            rate: completionRate,
            missing_fields: missing,
            requirements: {
              display_name: 'Your display name or nickname',
              industry: 'Your industry sector',
              job_title: 'Your job title (at least 5 characters)',
              bio: 'Your professional background (at least 50 characters)',
              topics: 'Your topics of interest (at least 3)',
              agent_role: 'Your agent\'s role (at least 20 characters)',
              agent_specialties: 'Your agent\'s specialties (at least 3)',
            },
            settings_url: `${config.app.url}/console/settings`,
            message_to_human: 'I cannot send DM requests yet. Please help me complete our profile by visiting the settings page.',
          },
        }
      );
    }

    // 检查目标 Agent 是否存在且已 claimed
    const targetAgent = await queryOne<AgentRow>(
      `SELECT id, name, twitter_handle FROM agents WHERE id = $1 AND status = 'claimed'`,
      [to_agent_id]
    );
    if (!targetAgent) {
      throw new AppError(ERROR_CODES.NOT_FOUND, 'Target agent not found or not claimed', 404);
    }

    // 检查是否已有待处理的请求
    const existingRequest = await queryOne<DMRequestRow>(
      `SELECT id FROM dm_requests 
       WHERE from_agent_id = $1 AND to_agent_id = $2 AND status = 'pending' AND expires_at > NOW()`,
      [fromAgentId, to_agent_id]
    );
    if (existingRequest) {
      throw new AppError(ERROR_CODES.VALIDATION_ERROR, 'You already have a pending DM request to this agent', 400);
    }

    // 检查是否已有活跃的 DM session
    const existingSession = await queryOne<DMSessionRow>(
      `SELECT id FROM dm_sessions
       WHERE ((initiator_id = $1 AND target_id = $2) OR (initiator_id = $2 AND target_id = $1))
       AND status = 'active' AND expires_at > NOW()`,
      [fromAgentId, to_agent_id]
    );
    if (existingSession) {
      throw new AppError(ERROR_CODES.VALIDATION_ERROR, 'You already have an active DM session with this agent', 400);
    }

    // ============================================
    // Market-Driven Protocol Gates
    // ============================================

    // Resolve user IDs for protocol checks
    const fromUser = await queryOne<{ owner_user_id: string }>(
      `SELECT owner_user_id FROM agents WHERE id = $1`, [fromAgentId]
    );
    const toUser = await queryOne<{ owner_user_id: string }>(
      `SELECT owner_user_id FROM agents WHERE id = $1`, [to_agent_id]
    );
    const fromUserId = fromUser?.owner_user_id;
    const toUserId = toUser?.owner_user_id;

    if (fromUserId && toUserId) {
      // Gate 1: Cooldown check — 声誉冷却期
      const cooldown = await checkCooldown(fromUserId);
      if (cooldown.inCooldown) {
        throw new AppError(ERROR_CODES.FORBIDDEN, 'Your account is in reputation cooldown', 429, undefined, {
          cooldown_until: cooldown.until,
        });
      }

      // Gate 2: Inbound budget check — 对方接收额度
      const inbound = await checkInboundBudget(toUserId);
      if (!inbound.allowed) {
        throw new AppError(ERROR_CODES.FORBIDDEN, 'Target user\'s inbound budget is full this week', 429, undefined, {
          target_inbound_full: true,
        });
      }

      // Gate 3: Alignment check — 对齐度预演
      const alignment = await checkAlignment(fromUserId, toUserId, activity_id);
      if (!alignment.passed) {
        throw new AppError(ERROR_CODES.FORBIDDEN, 'Alignment score too low for direct outreach', 422, undefined, {
          alignment: { score: alignment.score, threshold: 0.65, details: alignment.details },
        });
      }

      // Consume inbound budget slot
      await consumeInbound(toUserId);

      // Record outreach event
      await recordEvent(fromUserId, 'outreach_sent');

      // Create DM request with alignment data
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const dmRequest = await queryOne<DMRequestRow>(
        `INSERT INTO dm_requests (from_agent_id, to_agent_id, intent, context_ref, expires_at, alignment_score, alignment_details)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [fromAgentId, to_agent_id, intent, context_ref || null, expiresAt, alignment.score, JSON.stringify(alignment.details)]
      );

      // Notify target agent's owner about the DM request
      const fromAgentInfo = await queryOne<{ name: string }>(
        `SELECT name FROM agents WHERE id = $1`, [fromAgentId]
      );
      const targetAgentInfo = await queryOne<{ name: string; owner_user_id: string | null }>(
        `SELECT name, owner_user_id FROM agents WHERE id = $1`, [to_agent_id]
      );
      if (targetAgentInfo?.owner_user_id) {
        await query(
          `INSERT INTO agent_notifications (owner_user_id, agent_id, type, title, content, metadata)
           VALUES ($1, $2, 'dm_request', $3, $4, $5)`,
          [
            targetAgentInfo.owner_user_id,
            to_agent_id,
            `${fromAgentInfo?.name || 'An agent'} wants to DM`,
            `Agent "${fromAgentInfo?.name}" sent a DM request to your agent "${targetAgentInfo.name}". Alignment score: ${alignment.score}.`,
            JSON.stringify({
              request_id: dmRequest!.id,
              from_agent_id: fromAgentId,
              from_agent_name: fromAgentInfo?.name,
              to_agent_id,
              to_agent_name: targetAgentInfo.name,
              intent,
              alignment_score: alignment.score,
            }),
          ]
        );
      }

      return reply.status(201).send({
        success: true,
        data: {
          request: {
            id: dmRequest!.id,
            from_agent_id: dmRequest!.from_agent_id,
            to_agent_id: dmRequest!.to_agent_id,
            intent: dmRequest!.intent,
            context_ref: dmRequest!.context_ref,
            status: dmRequest!.status,
            alignment_score: alignment.score,
            created_at: dmRequest!.created_at,
            expires_at: dmRequest!.expires_at,
          },
        },
      });
    }

    // Fallback: if user IDs not resolved, create request without protocol gates
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const dmRequest = await queryOne<DMRequestRow>(
      `INSERT INTO dm_requests (from_agent_id, to_agent_id, intent, context_ref, expires_at)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [fromAgentId, to_agent_id, intent, context_ref || null, expiresAt]
    );

    // Notify target agent's owner about the DM request
    const fromAgentInfo = await queryOne<{ name: string }>(
      `SELECT name FROM agents WHERE id = $1`, [fromAgentId]
    );
    const targetAgentInfo = await queryOne<{ name: string; owner_user_id: string | null }>(
      `SELECT name, owner_user_id FROM agents WHERE id = $1`, [to_agent_id]
    );
    if (targetAgentInfo?.owner_user_id) {
      await query(
        `INSERT INTO agent_notifications (owner_user_id, agent_id, type, title, content, metadata)
         VALUES ($1, $2, 'dm_request', $3, $4, $5)`,
        [
          targetAgentInfo.owner_user_id,
          to_agent_id,
          `${fromAgentInfo?.name || 'An agent'} wants to DM`,
          `Agent "${fromAgentInfo?.name}" sent a DM request to your agent "${targetAgentInfo.name}". Check your notifications to approve or decline.`,
          JSON.stringify({
            request_id: dmRequest!.id,
            from_agent_id: fromAgentId,
            from_agent_name: fromAgentInfo?.name,
            to_agent_id,
            to_agent_name: targetAgentInfo.name,
            intent,
          }),
        ]
      );
    }

    return reply.status(201).send({
      success: true,
      data: {
        request: {
          id: dmRequest!.id,
          from_agent_id: dmRequest!.from_agent_id,
          to_agent_id: dmRequest!.to_agent_id,
          intent: dmRequest!.intent,
          context_ref: dmRequest!.context_ref,
          status: dmRequest!.status,
          created_at: dmRequest!.created_at,
          expires_at: dmRequest!.expires_at,
        },
      },
    });
  });

  // ============================================
  // GET /v1/dm/requests - 获取待处理的 DM 请求
  // ============================================
  fastify.get('/v1/dm/requests', async (request: FastifyRequest, reply: FastifyReply) => {
    const authResult = await verifyAgentToken(request);
    if (!authResult) {
      throw new AppError(ERROR_CODES.UNAUTHORIZED, 'Agent token required', 401);
    }

    const agentId = authResult.agentId!;
    const { status } = request.query as { status?: string };

    let whereClause = 'WHERE to_agent_id = $1';
    const params: unknown[] = [agentId];

    if (status) {
      whereClause += ' AND dr.status = $2';
      params.push(status);
    }

    // 先过期超时的请求
    await query(
      `UPDATE dm_requests SET status = 'expired' WHERE status = 'pending' AND expires_at <= NOW()`
    );

    const requests = await queryMany<DMRequestRow & { from_agent_name: string; from_agent_handle: string | null }>(
      `SELECT dr.*, a.name as from_agent_name, a.twitter_handle as from_agent_handle
       FROM dm_requests dr
       JOIN agents a ON a.id = dr.from_agent_id
       ${whereClause}
       ORDER BY dr.created_at DESC
       LIMIT 50`,
      params
    );

    return reply.send({
      success: true,
      data: {
        requests: requests.map(r => ({
          id: r.id,
          from_agent: {
            id: r.from_agent_id,
            name: r.from_agent_name,
            twitter_handle: r.from_agent_handle,
          },
          intent: r.intent,
          context_ref: r.context_ref,
          status: r.status,
          created_at: r.created_at,
          expires_at: r.expires_at,
        })),
      },
    });
  });

  // ============================================
  // POST /v1/dm/request/:id/respond - 响应 DM 请求
  // ============================================
  fastify.post('/v1/dm/request/:id/respond', async (request: FastifyRequest, reply: FastifyReply) => {
    const authResult = await verifyAgentToken(request);
    if (!authResult) {
      throw new AppError(ERROR_CODES.UNAUTHORIZED, 'Agent token required', 401);
    }

    const { id } = request.params as { id: string };
    const agentId = authResult.agentId!;

    // 解析请求体
    const parseResult = respondDMRequestSchema.safeParse(request.body);
    if (!parseResult.success) {
      throw new AppError(ERROR_CODES.VALIDATION_ERROR, 'Invalid request body', 400);
    }

    const { action, reason } = parseResult.data;

    // 获取 DM 请求
    const dmRequest = await queryOne<DMRequestRow>(
      `SELECT * FROM dm_requests WHERE id = $1`,
      [id]
    );
    if (!dmRequest) {
      throw new AppError(ERROR_CODES.NOT_FOUND, 'DM request not found', 404);
    }

    // 检查是否是接收者
    if (dmRequest.to_agent_id !== agentId) {
      throw new AppError(ERROR_CODES.FORBIDDEN, 'You can only respond to DM requests sent to you', 403);
    }

    // 检查状态
    if (dmRequest.status !== 'pending') {
      throw new AppError(ERROR_CODES.DM_REQUEST_NOT_PENDING, 'DM request is not pending', 400);
    }

    // 检查是否过期
    if (new Date(dmRequest.expires_at) <= new Date()) {
      await query(`UPDATE dm_requests SET status = 'expired' WHERE id = $1`, [id]);
      throw new AppError(ERROR_CODES.DM_REQUEST_EXPIRED, 'DM request has expired', 400);
    }

    // Resolve user IDs for reputation tracking
    const fromAgentOwner = await queryOne<{ owner_user_id: string }>(
      `SELECT owner_user_id FROM agents WHERE id = $1`, [dmRequest.from_agent_id]
    );
    const fromOwnerId = fromAgentOwner?.owner_user_id;

    if (action === 'reject') {
      // 拒绝请求
      await query(
        `UPDATE dm_requests SET status = 'rejected', reject_reason = $1, responded_at = NOW() WHERE id = $2`,
        [reason || null, id]
      );

      // Record reputation event: outreach_rejected
      if (fromOwnerId) {
        await recordEvent(fromOwnerId, 'outreach_rejected', id);
      }

      return reply.send({
        success: true,
        data: {
          request: {
            id: dmRequest.id,
            status: 'rejected',
          },
        },
      });
    }

    // 接受请求 - 创建 DM Session
    await query(
      `UPDATE dm_requests SET status = 'accepted', responded_at = NOW() WHERE id = $1`,
      [id]
    );

    // Record reputation event: outreach_accepted
    if (fromOwnerId) {
      await recordEvent(fromOwnerId, 'outreach_accepted', id);
    }

    // 创建 Matrix room for DM（如果启用）
    let matrixRoomId: string | null = null;
    if (isMatrixEnabled() && isMatrixReady()) {
      const fromAgent = await queryOne<AgentRow>(
        `SELECT name FROM agents WHERE id = $1`,
        [dmRequest.from_agent_id]
      );
      const toAgent = await queryOne<AgentRow>(
        `SELECT name FROM agents WHERE id = $1`,
        [dmRequest.to_agent_id]
      );
      
      const dmRoom = await createDMRoom(
        `DM: ${fromAgent?.name} ↔ ${toAgent?.name}`,
        `Intent: ${dmRequest.intent}`
      );
      matrixRoomId = dmRoom?.roomId || null;
    }

    // 创建 DM Session（24 小时过期）
    const sessionExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const dmSession = await queryOne<DMSessionRow>(
      `INSERT INTO dm_sessions (request_id, initiator_id, target_id, intent, matrix_room_id, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [id, dmRequest.from_agent_id, dmRequest.to_agent_id, dmRequest.intent, matrixRoomId, sessionExpiresAt]
    );

    return reply.send({
      success: true,
      data: {
        dm: {
          id: dmSession!.id,
          initiator_id: dmSession!.initiator_id,
          target_id: dmSession!.target_id,
          intent: dmSession!.intent,
          status: dmSession!.status,
          max_messages: dmSession!.max_messages,
          message_count: dmSession!.message_count,
          matrix_room_id: dmSession!.matrix_room_id,
          expires_at: dmSession!.expires_at,
        },
      },
    });
  });

  // ============================================
  // GET /v1/dm/:id - 获取 DM 详情
  // ============================================
  fastify.get('/v1/dm/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const authResult = await verifyAgentToken(request);
    if (!authResult) {
      throw new AppError(ERROR_CODES.UNAUTHORIZED, 'Agent token required', 401);
    }

    const { id } = request.params as { id: string };
    const agentId = authResult.agentId!;

    // 获取 DM Session
    const dmSession = await queryOne<DMSessionRow & { initiator_name: string; target_name: string }>(
      `SELECT ds.*, 
              a1.name as initiator_name,
              a2.name as target_name
       FROM dm_sessions ds
       JOIN agents a1 ON a1.id = ds.initiator_id
       JOIN agents a2 ON a2.id = ds.target_id
       WHERE ds.id = $1`,
      [id]
    );

    if (!dmSession) {
      throw new AppError(ERROR_CODES.NOT_FOUND, 'DM session not found', 404);
    }

    // 检查是否是参与者
    if (dmSession.initiator_id !== agentId && dmSession.target_id !== agentId) {
      throw new AppError(ERROR_CODES.FORBIDDEN, 'You are not a participant of this DM', 403);
    }

    // 检查并更新过期状态
    if (dmSession.status === 'active' && new Date(dmSession.expires_at) <= new Date()) {
      await query(
        `UPDATE dm_sessions SET status = 'expired', closed_at = NOW(), close_reason = 'timeout' WHERE id = $1`,
        [id]
      );
      dmSession.status = 'expired';
      dmSession.close_reason = 'timeout';
    }

    return reply.send({
      success: true,
      data: {
        dm: {
          id: dmSession.id,
          intent: dmSession.intent,
          status: dmSession.status,
          message_count: dmSession.message_count,
          max_messages: dmSession.max_messages,
          initiator: {
            id: dmSession.initiator_id,
            name: dmSession.initiator_name,
          },
          target: {
            id: dmSession.target_id,
            name: dmSession.target_name,
          },
          created_at: dmSession.created_at,
          closed_at: dmSession.closed_at,
          close_reason: dmSession.close_reason,
          expires_at: dmSession.expires_at,
        },
      },
    });
  });

  // ============================================
  // POST /v1/dm/:id/messages - 发送 DM 消息
  // ============================================
  fastify.post('/v1/dm/:id/messages', async (request: FastifyRequest, reply: FastifyReply) => {
    const authResult = await verifyAgentToken(request);
    if (!authResult) {
      throw new AppError(ERROR_CODES.UNAUTHORIZED, 'Agent token required', 401);
    }

    const { id } = request.params as { id: string };
    const agentId = authResult.agentId!;

    // 解析请求体
    const parseResult = sendDMMessageSchema.safeParse(request.body);
    if (!parseResult.success) {
      throw new AppError(ERROR_CODES.VALIDATION_ERROR, 'Invalid request body', 400);
    }

    const { content, context, question, expected_output } = parseResult.data;

    // 获取 DM Session
    const dmSession = await queryOne<DMSessionRow>(
      `SELECT * FROM dm_sessions WHERE id = $1`,
      [id]
    );

    if (!dmSession) {
      throw new AppError(ERROR_CODES.NOT_FOUND, 'DM session not found', 404);
    }

    // 检查是否是参与者
    if (dmSession.initiator_id !== agentId && dmSession.target_id !== agentId) {
      throw new AppError(ERROR_CODES.FORBIDDEN, 'You are not a participant of this DM', 403);
    }

    // 检查状态
    if (dmSession.status !== 'active') {
      throw new AppError(ERROR_CODES.DM_SESSION_CLOSED, `DM session is ${dmSession.status}`, 400);
    }

    // 检查是否过期
    if (new Date(dmSession.expires_at) <= new Date()) {
      await query(
        `UPDATE dm_sessions SET status = 'expired', closed_at = NOW(), close_reason = 'timeout' WHERE id = $1`,
        [id]
      );
      throw new AppError(ERROR_CODES.DM_SESSION_CLOSED, 'DM session has expired', 400);
    }

    // 检查消息限制
    if (dmSession.message_count >= dmSession.max_messages) {
      throw new AppError(ERROR_CODES.DM_MESSAGE_LIMIT, 'DM message limit reached', 400);
    }

    // 检查首条消息必填字段
    if (dmSession.message_count === 0) {
      if (!context || !question || !expected_output) {
        throw new AppError(ERROR_CODES.DM_INVALID_FIRST_MESSAGE, 
          'First DM message must include context, question, and expected_output', 400);
      }
    }

    // 发送到 Matrix（如果启用）
    let matrixEventId: string | null = null;
    if (dmSession.matrix_room_id && isMatrixEnabled() && isMatrixReady()) {
      const sender = await queryOne<AgentRow>(
        `SELECT id, name, twitter_handle, matrix_user_id, matrix_access_token FROM agents WHERE id = $1`,
        [agentId]
      );
      
      matrixEventId = await sendMessage(dmSession.matrix_room_id, content, {
        agentId: sender!.id,
        agentName: sender!.name,
        agentHandle: sender!.twitter_handle,
        matrixUserId: sender!.matrix_user_id,
        matrixAccessToken: sender!.matrix_access_token,
      });
    }

    // 保存消息
    const dmMessage = await queryOne<DMMessageRow>(
      `INSERT INTO dm_messages (session_id, sender_id, content, context, question, expected_output, matrix_event_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [id, agentId, content, context || null, question || null, expected_output || null, matrixEventId]
    );

    // 获取更新后的 session（trigger 会自动更新 message_count）
    const updatedSession = await queryOne<DMSessionRow>(
      `SELECT message_count, max_messages, status FROM dm_sessions WHERE id = $1`,
      [id]
    );

    return reply.status(201).send({
      success: true,
      data: {
        message: {
          id: dmMessage!.id,
          dm_id: id,
          sender_id: agentId,
          content: dmMessage!.content,
          matrix_event_id: dmMessage!.matrix_event_id,
          created_at: dmMessage!.created_at,
        },
        dm: {
          message_count: updatedSession!.message_count,
          max_messages: updatedSession!.max_messages,
          status: updatedSession!.status,
        },
      },
    });
  });

  // ============================================
  // GET /v1/dm/:id/messages - 获取 DM 消息
  // ============================================
  fastify.get('/v1/dm/:id/messages', async (request: FastifyRequest, reply: FastifyReply) => {
    const authResult = await verifyAgentToken(request);
    if (!authResult) {
      throw new AppError(ERROR_CODES.UNAUTHORIZED, 'Agent token required', 401);
    }

    const { id } = request.params as { id: string };
    const agentId = authResult.agentId!;
    const { limit = '50', before } = request.query as { limit?: string; before?: string };

    // 获取 DM Session
    const dmSession = await queryOne<DMSessionRow>(
      `SELECT * FROM dm_sessions WHERE id = $1`,
      [id]
    );

    if (!dmSession) {
      throw new AppError(ERROR_CODES.NOT_FOUND, 'DM session not found', 404);
    }

    // 检查是否是参与者
    if (dmSession.initiator_id !== agentId && dmSession.target_id !== agentId) {
      throw new AppError(ERROR_CODES.FORBIDDEN, 'You are not a participant of this DM', 403);
    }

    let whereClause = 'WHERE dm.session_id = $1';
    const params: unknown[] = [id];

    if (before) {
      whereClause += ' AND dm.created_at < (SELECT created_at FROM dm_messages WHERE id = $2)';
      params.push(before);
    }

    const messages = await queryMany<DMMessageRow & { sender_name: string }>(
      `SELECT dm.*, a.name as sender_name
       FROM dm_messages dm
       JOIN agents a ON a.id = dm.sender_id
       ${whereClause}
       ORDER BY dm.created_at DESC
       LIMIT ${parseInt(limit, 10)}`,
      params
    );

    return reply.send({
      success: true,
      data: {
        messages: messages.reverse().map(m => ({
          id: m.id,
          sender_id: m.sender_id,
          sender_name: m.sender_name,
          content: m.content,
          context: m.context,
          question: m.question,
          expected_output: m.expected_output,
          created_at: m.created_at,
        })),
      },
    });
  });

  // ============================================
  // POST /v1/dm/:id/close - 关闭 DM
  // ============================================
  fastify.post('/v1/dm/:id/close', async (request: FastifyRequest, reply: FastifyReply) => {
    const authResult = await verifyAgentToken(request);
    if (!authResult) {
      throw new AppError(ERROR_CODES.UNAUTHORIZED, 'Agent token required', 401);
    }

    const { id } = request.params as { id: string };
    const agentId = authResult.agentId!;

    // 解析请求体
    const parseResult = closeDMSchema.safeParse(request.body || {});
    if (!parseResult.success) {
      throw new AppError(ERROR_CODES.VALIDATION_ERROR, 'Invalid request body', 400);
    }

    // 获取 DM Session
    const dmSession = await queryOne<DMSessionRow>(
      `SELECT * FROM dm_sessions WHERE id = $1`,
      [id]
    );

    if (!dmSession) {
      throw new AppError(ERROR_CODES.NOT_FOUND, 'DM session not found', 404);
    }

    // 检查是否是参与者
    if (dmSession.initiator_id !== agentId && dmSession.target_id !== agentId) {
      throw new AppError(ERROR_CODES.FORBIDDEN, 'You are not a participant of this DM', 403);
    }

    // 检查状态
    if (dmSession.status !== 'active') {
      throw new AppError(ERROR_CODES.DM_SESSION_CLOSED, `DM session is already ${dmSession.status}`, 400);
    }

    // 关闭 session
    await query(
      `UPDATE dm_sessions SET status = 'closed', closed_at = NOW(), close_reason = 'manual' WHERE id = $1`,
      [id]
    );

    // 发送系统消息到 Matrix
    if (dmSession.matrix_room_id && isMatrixEnabled() && isMatrixReady()) {
      await sendMessage(dmSession.matrix_room_id, '[system] DM closed: manual', {
        agentId: 'system',
        agentName: 'System',
      });
    }

    return reply.send({
      success: true,
      data: {
        dm: {
          id: dmSession.id,
          status: 'closed',
          closed_at: new Date().toISOString(),
          close_reason: 'manual',
        },
      },
    });
  });

  // ============================================
  // GET /v1/dm - 获取当前 Agent 的所有 DM
  // ============================================
  fastify.get('/v1/dm', async (request: FastifyRequest, reply: FastifyReply) => {
    const authResult = await verifyAgentToken(request);
    if (!authResult) {
      throw new AppError(ERROR_CODES.UNAUTHORIZED, 'Agent token required', 401);
    }

    const agentId = authResult.agentId!;
    const { status } = request.query as { status?: string };

    let whereClause = 'WHERE (ds.initiator_id = $1 OR ds.target_id = $1)';
    const params: unknown[] = [agentId];

    if (status) {
      whereClause += ' AND ds.status = $2';
      params.push(status);
    }

    // 先过期超时的 sessions
    await query(
      `UPDATE dm_sessions SET status = 'expired', closed_at = NOW(), close_reason = 'timeout' 
       WHERE status = 'active' AND expires_at <= NOW()`
    );

    const sessions = await queryMany<DMSessionRow & { initiator_name: string; target_name: string }>(
      `SELECT ds.*, 
              a1.name as initiator_name,
              a2.name as target_name
       FROM dm_sessions ds
       JOIN agents a1 ON a1.id = ds.initiator_id
       JOIN agents a2 ON a2.id = ds.target_id
       ${whereClause}
       ORDER BY ds.created_at DESC
       LIMIT 50`,
      params
    );

    return reply.send({
      success: true,
      data: {
        sessions: sessions.map(s => ({
          id: s.id,
          intent: s.intent,
          status: s.status,
          message_count: s.message_count,
          max_messages: s.max_messages,
          initiator: {
            id: s.initiator_id,
            name: s.initiator_name,
          },
          target: {
            id: s.target_id,
            name: s.target_name,
          },
          created_at: s.created_at,
          expires_at: s.expires_at,
        })),
      },
    });
  });

  // ============================================
  // POST /v1/dm/request-as-owner - Owner 代理 Agent 发起 DM 请求
  // 人类主人通过 session cookie 认证，代理自己的 Agent 发起 DM
  // ============================================
  fastify.post('/v1/dm/request-as-owner', async (request: FastifyRequest, reply: FastifyReply) => {
    const session = await verifyUserSession(request);
    if (!session) {
      throw new AppError(ERROR_CODES.UNAUTHORIZED, 'Please sign in first', 401);
    }

    const bodySchema = z.object({
      to_agent_id: z.string().uuid(),
      intent: z.enum(VALID_INTENTS).default('coordinate'),
      context_ref: z.string().max(500).optional(),
    });

    const parseResult = bodySchema.safeParse(request.body);
    if (!parseResult.success) {
      throw new AppError(ERROR_CODES.VALIDATION_ERROR, 'Invalid request body', 400);
    }

    const { to_agent_id, intent, context_ref } = parseResult.data;

    // Find the owner's agent
    const ownerAgent = await queryOne<{ id: string; name: string }>(
      `SELECT id, name FROM agents WHERE owner_user_id = $1 AND status = 'claimed' LIMIT 1`,
      [session.userId]
    );

    if (!ownerAgent) {
      throw new AppError(ERROR_CODES.FORBIDDEN, 'You need to claim an agent first', 403);
    }

    const fromAgentId = ownerAgent.id;

    // Cannot DM own agent
    if (to_agent_id === fromAgentId) {
      throw new AppError(ERROR_CODES.VALIDATION_ERROR, 'Cannot send DM request to your own agent', 400);
    }

    // Check target agent exists
    const targetAgent = await queryOne<{ id: string; name: string }>(
      `SELECT id, name FROM agents WHERE id = $1`,
      [to_agent_id]
    );

    if (!targetAgent) {
      throw new AppError(ERROR_CODES.NOT_FOUND, 'Target agent not found', 404);
    }

    // Check for existing pending request or active session
    const existing = await queryOne<{ id: string; status: string }>(
      `SELECT id, status FROM dm_requests 
       WHERE from_agent_id = $1 AND to_agent_id = $2 AND status = 'pending'
       LIMIT 1`,
      [fromAgentId, to_agent_id]
    );

    if (existing) {
      throw new AppError(ERROR_CODES.VALIDATION_ERROR, 'Already have an existing pending request', 409);
    }

    const activeSession = await queryOne<{ id: string }>(
      `SELECT id FROM dm_sessions
       WHERE ((initiator_id = $1 AND target_id = $2) OR (initiator_id = $2 AND target_id = $1))
       AND status = 'active'
       LIMIT 1`,
      [fromAgentId, to_agent_id]
    );

    if (activeSession) {
      throw new AppError(ERROR_CODES.VALIDATION_ERROR, 'Already have an active DM session', 409);
    }

    // Create DM request (24 hour expiry)
    const dmRequest = await queryOne<{ id: string; created_at: Date; expires_at: Date }>(
      `INSERT INTO dm_requests (from_agent_id, to_agent_id, intent, context_ref, expires_at)
       VALUES ($1, $2, $3, $4, NOW() + INTERVAL '24 hours')
       RETURNING id, created_at, expires_at`,
      [fromAgentId, to_agent_id, intent, context_ref || null]
    );

    // Notify target agent's owner about the friend request
    const targetOwner = await queryOne<{ owner_user_id: string }>(
      `SELECT owner_user_id FROM agents WHERE id = $1 AND owner_user_id IS NOT NULL`,
      [to_agent_id]
    );
    if (targetOwner) {
      await query(
        `INSERT INTO agent_notifications (owner_user_id, agent_id, type, title, content, metadata)
         VALUES ($1, $2, 'dm_request', $3, $4, $5)`,
        [
          targetOwner.owner_user_id,
          to_agent_id,
          `${ownerAgent.name} wants to be friends`,
          `Agent "${ownerAgent.name}" sent a friend request to your agent "${targetAgent.name}". Approve to start DM conversations.`,
          JSON.stringify({
            request_id: dmRequest!.id,
            from_agent_id: fromAgentId,
            from_agent_name: ownerAgent.name,
            to_agent_id: to_agent_id,
            to_agent_name: targetAgent.name,
            intent,
          }),
        ]
      );
    }

    reply.status(201);
    return {
      success: true,
      data: {
        request: {
          id: dmRequest!.id,
          from_agent: { id: fromAgentId, name: ownerAgent.name },
          to_agent: { id: to_agent_id, name: targetAgent.name },
          intent,
          status: 'pending',
          created_at: dmRequest!.created_at,
          expires_at: dmRequest!.expires_at,
        },
      },
    };
  });

  // ============================================
  // POST /v1/dm/requests/:id/approve - Owner 审批好友请求（接受）
  // ============================================
  fastify.post('/v1/dm/requests/:id/approve', async (request: FastifyRequest, reply: FastifyReply) => {
    const session = await verifyUserSession(request);
    if (!session) {
      throw new AppError(ERROR_CODES.UNAUTHORIZED, 'Please sign in first', 401);
    }

    const { id } = request.params as { id: string };

    // Get the DM request and verify current user owns the target agent
    const dmReq = await queryOne<{
      id: string; from_agent_id: string; to_agent_id: string; intent: string; status: string;
    }>(
      `SELECT dr.id, dr.from_agent_id, dr.to_agent_id, dr.intent, dr.status
       FROM dm_requests dr
       JOIN agents a ON a.id = dr.to_agent_id
       WHERE dr.id = $1 AND a.owner_user_id = $2`,
      [id, session.userId]
    );

    if (!dmReq) {
      throw new AppError(ERROR_CODES.NOT_FOUND, 'Request not found or not yours', 404);
    }

    if (dmReq.status !== 'pending') {
      throw new AppError(ERROR_CODES.VALIDATION_ERROR, `Request already ${dmReq.status}`, 409);
    }

    // Accept the request
    await query(
      `UPDATE dm_requests SET status = 'accepted', responded_at = NOW() WHERE id = $1`,
      [id]
    );

    // Create DM session
    const dmSession = await queryOne<{ id: string; created_at: Date; expires_at: Date }>(
      `INSERT INTO dm_sessions (request_id, initiator_id, target_id, intent, expires_at)
       VALUES ($1, $2, $3, $4, NOW() + INTERVAL '7 days')
       RETURNING id, created_at, expires_at`,
      [id, dmReq.from_agent_id, dmReq.to_agent_id, dmReq.intent]
    );

    // Get agent names for notification
    const fromAgent = await queryOne<{ name: string; owner_user_id: string | null }>(
      `SELECT name, owner_user_id FROM agents WHERE id = $1`,
      [dmReq.from_agent_id]
    );
    const toAgent = await queryOne<{ name: string }>(
      `SELECT name FROM agents WHERE id = $1`,
      [dmReq.to_agent_id]
    );

    // Notify the requester's owner that their request was accepted
    if (fromAgent?.owner_user_id) {
      await query(
        `INSERT INTO agent_notifications (owner_user_id, agent_id, type, title, content, metadata)
         VALUES ($1, $2, 'dm_accepted', $3, $4, $5)`,
        [
          fromAgent.owner_user_id,
          dmReq.from_agent_id,
          `${toAgent?.name || 'Agent'} accepted your friend request!`,
          `Your agent "${fromAgent.name}" can now DM with "${toAgent?.name}".`,
          JSON.stringify({
            request_id: id,
            session_id: dmSession!.id,
            from_agent_name: fromAgent.name,
            to_agent_name: toAgent?.name,
          }),
        ]
      );
    }

    return {
      success: true,
      data: {
        session: {
          id: dmSession!.id,
          initiator_id: dmReq.from_agent_id,
          target_id: dmReq.to_agent_id,
          status: 'active',
          created_at: dmSession!.created_at,
          expires_at: dmSession!.expires_at,
        },
      },
    };
  });

  // ============================================
  // POST /v1/dm/requests/:id/reject - Owner 审批好友请求（拒绝）
  // ============================================
  fastify.post('/v1/dm/requests/:id/reject', async (request: FastifyRequest, reply: FastifyReply) => {
    const session = await verifyUserSession(request);
    if (!session) {
      throw new AppError(ERROR_CODES.UNAUTHORIZED, 'Please sign in first', 401);
    }

    const { id } = request.params as { id: string };
    const { reason } = (request.body as { reason?: string }) || {};

    // Get the DM request and verify ownership
    const dmReq = await queryOne<{
      id: string; from_agent_id: string; to_agent_id: string; status: string;
    }>(
      `SELECT dr.id, dr.from_agent_id, dr.to_agent_id, dr.status
       FROM dm_requests dr
       JOIN agents a ON a.id = dr.to_agent_id
       WHERE dr.id = $1 AND a.owner_user_id = $2`,
      [id, session.userId]
    );

    if (!dmReq) {
      throw new AppError(ERROR_CODES.NOT_FOUND, 'Request not found or not yours', 404);
    }

    if (dmReq.status !== 'pending') {
      throw new AppError(ERROR_CODES.VALIDATION_ERROR, `Request already ${dmReq.status}`, 409);
    }

    await query(
      `UPDATE dm_requests SET status = 'rejected', reject_reason = $2, responded_at = NOW() WHERE id = $1`,
      [id, reason || null]
    );

    // Notify requester's owner
    const fromAgent = await queryOne<{ name: string; owner_user_id: string | null }>(
      `SELECT name, owner_user_id FROM agents WHERE id = $1`,
      [dmReq.from_agent_id]
    );
    const toAgent = await queryOne<{ name: string }>(
      `SELECT name FROM agents WHERE id = $1`,
      [dmReq.to_agent_id]
    );

    if (fromAgent?.owner_user_id) {
      await query(
        `INSERT INTO agent_notifications (owner_user_id, agent_id, type, title, content, metadata)
         VALUES ($1, $2, 'dm_rejected', $3, $4, $5)`,
        [
          fromAgent.owner_user_id,
          dmReq.from_agent_id,
          `Friend request declined`,
          `The owner of "${toAgent?.name}" declined the friend request from your agent "${fromAgent.name}".`,
          JSON.stringify({ request_id: id, from_agent_name: fromAgent.name, to_agent_name: toAgent?.name }),
        ]
      );
    }

    return { success: true, data: { rejected: true } };
  });

  // ============================================
  // POST /v1/dm/sessions/:id/rate - 聊后评分
  // ============================================
  fastify.post('/v1/dm/sessions/:id/rate', async (request: FastifyRequest, reply: FastifyReply) => {
    const session = await verifyUserSession(request);
    if (!session) {
      throw new AppError(ERROR_CODES.UNAUTHORIZED, 'Login required', 401);
    }

    const { id } = request.params as { id: string };
    const rateSchema = z.object({
      rating: z.number().int().min(1).max(5),
      outcome: z.enum(['valuable', 'neutral', 'waste']),
    });

    const parseResult = rateSchema.safeParse(request.body);
    if (!parseResult.success) {
      throw new AppError(ERROR_CODES.VALIDATION_ERROR, 'Invalid request: rating (1-5) and outcome required', 400);
    }

    const { rating, outcome } = parseResult.data;
    const userId = session.userId;

    // Get the session
    const dmSession = await queryOne<DMSessionRow>(
      `SELECT * FROM dm_sessions WHERE id = $1`,
      [id]
    );
    if (!dmSession) {
      throw new AppError(ERROR_CODES.NOT_FOUND, 'DM session not found', 404);
    }

    // Determine which side this user is (initiator or target)
    const initiatorOwner = await queryOne<{ owner_user_id: string }>(
      `SELECT owner_user_id FROM agents WHERE id = $1`, [dmSession.initiator_id]
    );
    const targetOwner = await queryOne<{ owner_user_id: string }>(
      `SELECT owner_user_id FROM agents WHERE id = $1`, [dmSession.target_id]
    );

    const isInitiator = initiatorOwner?.owner_user_id === userId;
    const isTarget = targetOwner?.owner_user_id === userId;

    if (!isInitiator && !isTarget) {
      throw new AppError(ERROR_CODES.FORBIDDEN, 'You are not a participant in this session', 403);
    }

    // Update the appropriate rating column
    if (isInitiator) {
      await query(
        `UPDATE dm_sessions SET post_chat_rating_a = $2, post_chat_outcome = $3 WHERE id = $1`,
        [id, rating, outcome]
      );
    } else {
      await query(
        `UPDATE dm_sessions SET post_chat_rating_b = $2, post_chat_outcome = COALESCE(post_chat_outcome, $3) WHERE id = $1`,
        [id, rating, outcome]
      );
    }

    // Record reputation events for the OTHER party based on the rating
    const otherUserId = isInitiator ? targetOwner?.owner_user_id : initiatorOwner?.owner_user_id;

    if (otherUserId) {
      if (rating >= 4) {
        await recordEvent(otherUserId, 'post_chat_positive', id, { rating, outcome, rated_by: userId });
      } else if (rating <= 2) {
        await recordEvent(otherUserId, 'post_chat_negative', id, { rating, outcome, rated_by: userId });
      }

      // Update avg_post_chat_rating
      await updatePostChatRating(otherUserId);
    }

    return reply.send({
      success: true,
      data: {
        session_id: id,
        rating,
        outcome,
        side: isInitiator ? 'initiator' : 'target',
      },
    });
  });
}
