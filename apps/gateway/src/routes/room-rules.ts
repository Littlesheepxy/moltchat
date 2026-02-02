import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { query, queryOne, queryMany } from '../db/client.js';
import { AppError, ERROR_CODES, successResponse } from '../lib/errors.js';
import { verifyAgentToken } from '../lib/auth.js';
import { logger } from '../lib/logger.js';

// ============================================
// Type Definitions
// ============================================

interface RoomRow {
  id: string;
  name: string;
  description: string | null;
  owner_id: string;
  status: string;
  matrix_room_id: string | null;
}

interface RoomPolicyRow {
  id: string;
  room_id: string;
  goal: string | null;
  context_window: number;
  consecutive_limit: number;
  speak_triggers: string[];
  auto_summary_enabled: boolean;
  summary_interval_minutes: number;
  summary_message_threshold: number;
}

interface RoomRoleRow {
  id: string;
  room_id: string;
  agent_id: string;
  role: string;
  agent_name?: string;
}

interface RoomMessageRow {
  id: string;
  room_id: string;
  sender_id: string;
  sender_name: string;
  sender_handle: string | null;
  content: string;
  message_type: string;
  created_at: Date;
}

interface RoomSummaryRow {
  id: string;
  content: string;
  created_at: Date;
  is_pinned: boolean;
}

interface InviteRequestRow {
  id: string;
  room_id: string;
  room_name: string;
  inviter_agent_id: string;
  inviter_name: string;
  target_agent_id: string;
  target_name: string;
  target_owner_handle: string | null;
  reason: string;
  status: string;
  created_at: Date;
  expires_at: Date;
}

interface AgentRow {
  id: string;
  name: string;
  twitter_handle: string | null;
  status: string;
}

// ============================================
// Validation Schemas
// ============================================

const contextQuerySchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(50),
});

const assignRoleSchema = z.object({
  facilitator_id: z.string().uuid().optional(),
  scribe_id: z.string().uuid().optional(),
});

const inviteRequestSchema = z.object({
  target_agent_id: z.string().uuid(),
  reason: z.string().min(10).max(500),
});

const respondInviteSchema = z.object({
  reason: z.string().max(500).optional(),
});

const createSummarySchema = z.object({
  content: z.string().min(50).max(5000),
  is_pinned: z.boolean().optional().default(false),
});

const updatePolicySchema = z.object({
  goal: z.string().max(500).optional(),
  context_window: z.number().min(10).max(100).optional(),
  consecutive_limit: z.number().min(1).max(5).optional(),
  speak_triggers: z.array(z.string()).optional(),
});

// ============================================
// Routes
// ============================================

export async function roomRulesRoutes(fastify: FastifyInstance): Promise<void> {
  
  // ============================================
  // Context API (爬楼)
  // ============================================
  
  /**
   * GET /v1/rooms/:id/context
   * 获取房间上下文（爬楼）
   */
  fastify.get<{
    Params: { id: string };
    Querystring: { limit?: string };
  }>('/v1/rooms/:id/context', async (request, reply) => {
    const { id: roomId } = request.params;
    
    // 验证 agent token
    const authResult = await verifyAgentToken(request);
    if (!authResult) {
      throw new AppError(ERROR_CODES.UNAUTHORIZED, 'Agent token required', 401);
    }

    // 验证查询参数
    const parseResult = contextQuerySchema.safeParse(request.query);
    if (!parseResult.success) {
      throw new AppError(ERROR_CODES.VALIDATION_ERROR, 'Invalid query parameters', 400);
    }
    const { limit } = parseResult.data;

    // 获取房间信息
    const room = await queryOne<RoomRow>(
      'SELECT id, name, description, owner_id, status, matrix_room_id FROM rooms WHERE id = $1',
      [roomId]
    );

    if (!room) {
      throw new AppError(ERROR_CODES.NOT_FOUND, 'Room not found', 404);
    }

    // 检查是否是房间成员
    const membership = await queryOne(
      'SELECT id FROM room_members WHERE room_id = $1 AND agent_id = $2',
      [roomId, authResult.agentId]
    );

    if (!membership) {
      throw new AppError(ERROR_CODES.FORBIDDEN, 'Not a member of this room', 403);
    }

    // 获取房间策略
    let policy = await queryOne<RoomPolicyRow>(
      'SELECT * FROM room_policies WHERE room_id = $1',
      [roomId]
    );

    // 如果没有策略，创建默认策略
    if (!policy) {
      await query(
        `INSERT INTO room_policies (room_id) VALUES ($1)`,
        [roomId]
      );
      policy = await queryOne<RoomPolicyRow>(
        'SELECT * FROM room_policies WHERE room_id = $1',
        [roomId]
      );
    }

    // 获取房间角色
    const roles = await queryMany<RoomRoleRow>(
      `SELECT rr.*, a.name as agent_name 
       FROM room_roles rr 
       JOIN agents a ON rr.agent_id = a.id 
       WHERE rr.room_id = $1`,
      [roomId]
    );

    const facilitator = roles.find(r => r.role === 'facilitator');
    const scribe = roles.find(r => r.role === 'scribe');

    // 获取最新的 pinned 摘要
    const pinnedSummary = await queryOne<RoomSummaryRow>(
      `SELECT id, content, created_at, is_pinned 
       FROM room_summaries 
       WHERE room_id = $1 AND is_pinned = true 
       ORDER BY created_at DESC 
       LIMIT 1`,
      [roomId]
    );

    // 获取最近消息
    const messages = await queryMany<RoomMessageRow>(
      `SELECT rm.id, rm.room_id, rm.sender_id, rm.content, rm.message_type, rm.created_at,
              a.name as sender_name, a.twitter_handle as sender_handle
       FROM room_messages rm
       JOIN agents a ON rm.sender_id = a.id
       WHERE rm.room_id = $1
       ORDER BY rm.created_at DESC
       LIMIT $2`,
      [roomId, limit]
    );

    // 反转消息顺序（从旧到新）
    messages.reverse();

    return successResponse({
      room: {
        id: room.id,
        name: room.name,
        description: room.description,
        goal: policy?.goal || null,
        owner_id: room.owner_id,
      },
      policy: {
        context_window: policy?.context_window || 50,
        consecutive_limit: policy?.consecutive_limit || 2,
        speak_triggers: policy?.speak_triggers || ['mentioned', 'facilitator_assign'],
      },
      roles: {
        facilitator: facilitator ? {
          agent_id: facilitator.agent_id,
          agent_name: facilitator.agent_name,
        } : null,
        scribe: scribe ? {
          agent_id: scribe.agent_id,
          agent_name: scribe.agent_name,
        } : null,
      },
      pinned: {
        latest_summary: pinnedSummary?.content || null,
        summary_updated_at: pinnedSummary?.created_at?.toISOString() || null,
      },
      recent_messages: messages.map(m => ({
        id: m.id,
        sender_id: m.sender_id,
        sender_name: m.sender_name,
        sender_handle: m.sender_handle,
        content: m.content,
        type: m.message_type,
        created_at: m.created_at.toISOString(),
      })),
      message_count: messages.length,
    });
  });

  // ============================================
  // Role Management API
  // ============================================

  /**
   * GET /v1/rooms/:id/roles
   * 获取房间角色
   */
  fastify.get<{
    Params: { id: string };
  }>('/v1/rooms/:id/roles', async (request, reply) => {
    const { id: roomId } = request.params;

    const authResult = await verifyAgentToken(request);
    if (!authResult) {
      throw new AppError(ERROR_CODES.UNAUTHORIZED, 'Agent token required', 401);
    }

    // 获取房间
    const room = await queryOne<RoomRow>(
      'SELECT id, owner_id FROM rooms WHERE id = $1',
      [roomId]
    );

    if (!room) {
      throw new AppError(ERROR_CODES.NOT_FOUND, 'Room not found', 404);
    }

    // 获取角色
    const roles = await queryMany<RoomRoleRow & { agent_name: string }>(
      `SELECT rr.*, a.name as agent_name 
       FROM room_roles rr 
       JOIN agents a ON rr.agent_id = a.id 
       WHERE rr.room_id = $1`,
      [roomId]
    );

    // 获取 owner 信息
    const owner = await queryOne<AgentRow>(
      'SELECT id, name FROM agents WHERE id = $1',
      [room.owner_id]
    );

    // 获取所有成员
    const members = await queryMany<{ agent_id: string; role: string; agent_name: string }>(
      `SELECT rm.agent_id, rm.role, a.name as agent_name
       FROM room_members rm
       JOIN agents a ON rm.agent_id = a.id
       WHERE rm.room_id = $1`,
      [roomId]
    );

    const facilitator = roles.find(r => r.role === 'facilitator');
    const scribe = roles.find(r => r.role === 'scribe');

    return successResponse({
      owner: {
        agent_id: room.owner_id,
        agent_name: owner?.name,
      },
      facilitator: facilitator ? {
        agent_id: facilitator.agent_id,
        agent_name: facilitator.agent_name,
      } : null,
      scribe: scribe ? {
        agent_id: scribe.agent_id,
        agent_name: scribe.agent_name,
      } : null,
      members: members.map(m => ({
        agent_id: m.agent_id,
        agent_name: m.agent_name,
        role: m.role,
      })),
    });
  });

  /**
   * PATCH /v1/rooms/:id/roles
   * 分配房间角色（仅 owner）
   */
  fastify.patch<{
    Params: { id: string };
    Body: { facilitator_id?: string; scribe_id?: string };
  }>('/v1/rooms/:id/roles', async (request, reply) => {
    const { id: roomId } = request.params;

    const authResult = await verifyAgentToken(request);
    if (!authResult) {
      throw new AppError(ERROR_CODES.UNAUTHORIZED, 'Agent token required', 401);
    }

    const parseResult = assignRoleSchema.safeParse(request.body);
    if (!parseResult.success) {
      throw new AppError(ERROR_CODES.VALIDATION_ERROR, 'Invalid request body', 400);
    }

    const { facilitator_id, scribe_id } = parseResult.data;

    // 获取房间并验证 owner
    const room = await queryOne<RoomRow>(
      'SELECT id, owner_id FROM rooms WHERE id = $1',
      [roomId]
    );

    if (!room) {
      throw new AppError(ERROR_CODES.NOT_FOUND, 'Room not found', 404);
    }

    if (room.owner_id !== authResult.agentId) {
      throw new AppError(ERROR_CODES.FORBIDDEN, 'Only owner can assign roles', 403);
    }

    // 验证被分配角色的 agent 是房间成员
    if (facilitator_id) {
      const isMember = await queryOne(
        'SELECT id FROM room_members WHERE room_id = $1 AND agent_id = $2',
        [roomId, facilitator_id]
      );
      if (!isMember) {
        throw new AppError(ERROR_CODES.VALIDATION_ERROR, 'Facilitator must be a room member', 400);
      }

      // 更新或插入 facilitator 角色
      await query(
        `INSERT INTO room_roles (room_id, agent_id, role, assigned_by)
         VALUES ($1, $2, 'facilitator', $3)
         ON CONFLICT (room_id, role) DO UPDATE SET agent_id = $2, assigned_by = $3, updated_at = NOW()`,
        [roomId, facilitator_id, authResult.agentId]
      );
    }

    if (scribe_id) {
      const isMember = await queryOne(
        'SELECT id FROM room_members WHERE room_id = $1 AND agent_id = $2',
        [roomId, scribe_id]
      );
      if (!isMember) {
        throw new AppError(ERROR_CODES.VALIDATION_ERROR, 'Scribe must be a room member', 400);
      }

      // 更新或插入 scribe 角色
      await query(
        `INSERT INTO room_roles (room_id, agent_id, role, assigned_by)
         VALUES ($1, $2, 'scribe', $3)
         ON CONFLICT (room_id, role) DO UPDATE SET agent_id = $2, assigned_by = $3, updated_at = NOW()`,
        [roomId, scribe_id, authResult.agentId]
      );
    }

    // 获取更新后的角色
    const roles = await queryMany<RoomRoleRow & { agent_name: string }>(
      `SELECT rr.*, a.name as agent_name 
       FROM room_roles rr 
       JOIN agents a ON rr.agent_id = a.id 
       WHERE rr.room_id = $1`,
      [roomId]
    );

    const facilitator = roles.find(r => r.role === 'facilitator');
    const scribe = roles.find(r => r.role === 'scribe');

    return successResponse({
      facilitator: facilitator ? {
        agent_id: facilitator.agent_id,
        agent_name: facilitator.agent_name,
      } : null,
      scribe: scribe ? {
        agent_id: scribe.agent_id,
        agent_name: scribe.agent_name,
      } : null,
    });
  });

  // ============================================
  // Invite Request API
  // ============================================

  /**
   * POST /v1/rooms/:id/invite-request
   * Agent 发起邀请请求（需要 Owner 审批）
   */
  fastify.post<{
    Params: { id: string };
    Body: { target_agent_id: string; reason: string };
  }>('/v1/rooms/:id/invite-request', async (request, reply) => {
    const { id: roomId } = request.params;

    const authResult = await verifyAgentToken(request);
    if (!authResult) {
      throw new AppError(ERROR_CODES.UNAUTHORIZED, 'Agent token required', 401);
    }

    const parseResult = inviteRequestSchema.safeParse(request.body);
    if (!parseResult.success) {
      throw new AppError(ERROR_CODES.VALIDATION_ERROR, 'Invalid request body', 400,
        parseResult.error.errors.map(e => e.message).join(', '));
    }

    const { target_agent_id, reason } = parseResult.data;

    // 验证房间存在
    const room = await queryOne<RoomRow>(
      'SELECT id, name, status FROM rooms WHERE id = $1',
      [roomId]
    );

    if (!room) {
      throw new AppError(ERROR_CODES.NOT_FOUND, 'Room not found', 404);
    }

    if (room.status !== 'active') {
      throw new AppError(ERROR_CODES.FORBIDDEN, 'Room is not active', 403);
    }

    // 验证邀请者是房间成员
    const inviterMembership = await queryOne(
      'SELECT id FROM room_members WHERE room_id = $1 AND agent_id = $2',
      [roomId, authResult.agentId]
    );

    if (!inviterMembership) {
      throw new AppError(ERROR_CODES.FORBIDDEN, 'You are not a member of this room', 403);
    }

    // 验证目标 agent 存在且已 claimed
    const targetAgent = await queryOne<AgentRow>(
      'SELECT id, name, status, twitter_handle FROM agents WHERE id = $1',
      [target_agent_id]
    );

    if (!targetAgent) {
      throw new AppError(ERROR_CODES.NOT_FOUND, 'Target agent not found', 404);
    }

    if (targetAgent.status !== 'claimed') {
      throw new AppError(ERROR_CODES.VALIDATION_ERROR, 'Target agent must be claimed', 400);
    }

    // 检查目标 agent 是否已经是成员
    const existingMembership = await queryOne(
      'SELECT id FROM room_members WHERE room_id = $1 AND agent_id = $2',
      [roomId, target_agent_id]
    );

    if (existingMembership) {
      throw new AppError(ERROR_CODES.VALIDATION_ERROR, 'Agent is already a member', 400);
    }

    // 检查是否有 pending 的邀请请求
    const existingRequest = await queryOne(
      `SELECT id FROM invite_requests 
       WHERE room_id = $1 AND target_agent_id = $2 
       AND status IN ('pending_owner_approval', 'approved')`,
      [roomId, target_agent_id]
    );

    if (existingRequest) {
      throw new AppError(ERROR_CODES.VALIDATION_ERROR, 'An invite request is already pending', 400);
    }

    // 获取邀请者信息
    const inviter = await queryOne<AgentRow>(
      'SELECT id, name FROM agents WHERE id = $1',
      [authResult.agentId]
    );

    // 创建邀请请求（72 小时过期）
    const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000);

    const inviteRequest = await queryOne<{ id: string }>(
      `INSERT INTO invite_requests (room_id, inviter_agent_id, target_agent_id, reason, expires_at)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [roomId, authResult.agentId, target_agent_id, reason, expiresAt]
    );

    logger.info({
      inviteRequestId: inviteRequest!.id,
      roomId,
      inviterId: authResult.agentId,
      targetAgentId: target_agent_id,
    }, 'Invite request created');

    // TODO: 通知 target agent 的 owner（webhook / email）

    reply.status(201);
    return successResponse({
      invite_request: {
        id: inviteRequest!.id,
        room_id: roomId,
        room_name: room.name,
        inviter: {
          agent_id: authResult.agentId,
          agent_name: inviter?.name,
        },
        target: {
          agent_id: target_agent_id,
          agent_name: targetAgent.name,
        },
        reason,
        status: 'pending_owner_approval',
        expires_at: expiresAt.toISOString(),
      },
    });
  });

  /**
   * GET /v1/invite-requests
   * 获取邀请请求列表
   */
  fastify.get<{
    Querystring: { status?: string; as_owner?: string };
  }>('/v1/invite-requests', async (request, reply) => {
    const authResult = await verifyAgentToken(request);
    if (!authResult) {
      throw new AppError(ERROR_CODES.UNAUTHORIZED, 'Agent token required', 401);
    }

    const { status, as_owner } = request.query;
    const isOwnerView = as_owner === 'true';

    let requests: InviteRequestRow[];

    if (isOwnerView) {
      // 查看需要审批的请求（作为 Owner）
      // 由于 MVP 没有 Owner 模型，这里用 twitter_handle 匹配
      // 实际应该是：target agent 的 owner 等于当前用户
      // 这里简化为：target agent 就是当前 agent（用于测试）
      requests = await queryMany<InviteRequestRow>(
        `SELECT ir.*, r.name as room_name,
                inv.name as inviter_name,
                tgt.name as target_name,
                tgt.twitter_handle as target_owner_handle
         FROM invite_requests ir
         JOIN rooms r ON ir.room_id = r.id
         JOIN agents inv ON ir.inviter_agent_id = inv.id
         JOIN agents tgt ON ir.target_agent_id = tgt.id
         WHERE ir.target_agent_id = $1
         ${status ? 'AND ir.status = $2' : ''}
         ORDER BY ir.created_at DESC`,
        status ? [authResult.agentId, status] : [authResult.agentId]
      );
    } else {
      // 查看自己发出的邀请请求
      requests = await queryMany<InviteRequestRow>(
        `SELECT ir.*, r.name as room_name,
                inv.name as inviter_name,
                tgt.name as target_name,
                tgt.twitter_handle as target_owner_handle
         FROM invite_requests ir
         JOIN rooms r ON ir.room_id = r.id
         JOIN agents inv ON ir.inviter_agent_id = inv.id
         JOIN agents tgt ON ir.target_agent_id = tgt.id
         WHERE ir.inviter_agent_id = $1
         ${status ? 'AND ir.status = $2' : ''}
         ORDER BY ir.created_at DESC`,
        status ? [authResult.agentId, status] : [authResult.agentId]
      );
    }

    return successResponse({
      requests: requests.map(r => ({
        id: r.id,
        room_id: r.room_id,
        room_name: r.room_name,
        inviter: {
          agent_id: r.inviter_agent_id,
          agent_name: r.inviter_name,
        },
        target: {
          agent_id: r.target_agent_id,
          agent_name: r.target_name,
        },
        reason: r.reason,
        status: r.status,
        created_at: r.created_at.toISOString(),
        expires_at: r.expires_at.toISOString(),
      })),
    });
  });

  /**
   * POST /v1/invite-requests/:id/approve
   * Owner 批准邀请请求
   */
  fastify.post<{
    Params: { id: string };
  }>('/v1/invite-requests/:id/approve', async (request, reply) => {
    const { id: requestId } = request.params;

    const authResult = await verifyAgentToken(request);
    if (!authResult) {
      throw new AppError(ERROR_CODES.UNAUTHORIZED, 'Agent token required', 401);
    }

    // 获取邀请请求
    const inviteRequest = await queryOne<InviteRequestRow>(
      `SELECT ir.*, r.name as room_name
       FROM invite_requests ir
       JOIN rooms r ON ir.room_id = r.id
       WHERE ir.id = $1`,
      [requestId]
    );

    if (!inviteRequest) {
      throw new AppError(ERROR_CODES.NOT_FOUND, 'Invite request not found', 404);
    }

    // 验证是 target agent（或其 owner）
    // MVP 简化：target agent 自己可以 approve
    if (inviteRequest.target_agent_id !== authResult.agentId) {
      throw new AppError(ERROR_CODES.FORBIDDEN, 'Only target agent owner can approve', 403);
    }

    if (inviteRequest.status !== 'pending_owner_approval') {
      throw new AppError(ERROR_CODES.VALIDATION_ERROR, 
        `Cannot approve request with status: ${inviteRequest.status}`, 400);
    }

    // 检查是否过期
    if (new Date(inviteRequest.expires_at) < new Date()) {
      await query(
        `UPDATE invite_requests SET status = 'expired' WHERE id = $1`,
        [requestId]
      );
      throw new AppError(ERROR_CODES.VALIDATION_ERROR, 'Invite request has expired', 400);
    }

    // 更新状态为 approved
    await query(
      `UPDATE invite_requests SET status = 'approved', responded_at = NOW() WHERE id = $1`,
      [requestId]
    );

    // MVP 简化：直接将 agent 加入房间（跳过 agent accept 步骤）
    await query(
      `INSERT INTO room_members (room_id, agent_id, role)
       VALUES ($1, $2, 'member')
       ON CONFLICT (room_id, agent_id) DO NOTHING`,
      [inviteRequest.room_id, inviteRequest.target_agent_id]
    );

    // 更新邀请状态为 accepted
    await query(
      `UPDATE invite_requests SET status = 'accepted' WHERE id = $1`,
      [requestId]
    );

    logger.info({
      inviteRequestId: requestId,
      roomId: inviteRequest.room_id,
      targetAgentId: inviteRequest.target_agent_id,
    }, 'Invite request approved and agent joined');

    return successResponse({
      invite_request: {
        id: requestId,
        status: 'accepted',
        room_id: inviteRequest.room_id,
        room_name: inviteRequest.room_name,
      },
      joined: true,
    });
  });

  /**
   * POST /v1/invite-requests/:id/reject
   * Owner 拒绝邀请请求
   */
  fastify.post<{
    Params: { id: string };
    Body: { reason?: string };
  }>('/v1/invite-requests/:id/reject', async (request, reply) => {
    const { id: requestId } = request.params;

    const authResult = await verifyAgentToken(request);
    if (!authResult) {
      throw new AppError(ERROR_CODES.UNAUTHORIZED, 'Agent token required', 401);
    }

    const parseResult = respondInviteSchema.safeParse(request.body);
    const rejectReason = parseResult.success ? parseResult.data.reason : undefined;

    // 获取邀请请求
    const inviteRequest = await queryOne<InviteRequestRow>(
      `SELECT * FROM invite_requests WHERE id = $1`,
      [requestId]
    );

    if (!inviteRequest) {
      throw new AppError(ERROR_CODES.NOT_FOUND, 'Invite request not found', 404);
    }

    // 验证是 target agent（或其 owner）
    if (inviteRequest.target_agent_id !== authResult.agentId) {
      throw new AppError(ERROR_CODES.FORBIDDEN, 'Only target agent owner can reject', 403);
    }

    if (inviteRequest.status !== 'pending_owner_approval') {
      throw new AppError(ERROR_CODES.VALIDATION_ERROR,
        `Cannot reject request with status: ${inviteRequest.status}`, 400);
    }

    // 更新状态
    await query(
      `UPDATE invite_requests SET status = 'rejected', reject_reason = $1, responded_at = NOW() WHERE id = $2`,
      [rejectReason, requestId]
    );

    logger.info({
      inviteRequestId: requestId,
      targetAgentId: inviteRequest.target_agent_id,
      reason: rejectReason,
    }, 'Invite request rejected');

    return successResponse({
      invite_request: {
        id: requestId,
        status: 'rejected',
        reject_reason: rejectReason,
      },
    });
  });

  // ============================================
  // Summary API
  // ============================================

  /**
   * POST /v1/rooms/:id/summary
   * 创建房间摘要（scribe 或 facilitator）
   */
  fastify.post<{
    Params: { id: string };
    Body: { content: string; is_pinned?: boolean };
  }>('/v1/rooms/:id/summary', async (request, reply) => {
    const { id: roomId } = request.params;

    const authResult = await verifyAgentToken(request);
    if (!authResult) {
      throw new AppError(ERROR_CODES.UNAUTHORIZED, 'Agent token required', 401);
    }

    const parseResult = createSummarySchema.safeParse(request.body);
    if (!parseResult.success) {
      throw new AppError(ERROR_CODES.VALIDATION_ERROR, 'Invalid request body', 400,
        parseResult.error.errors.map(e => e.message).join(', '));
    }

    const { content, is_pinned } = parseResult.data;

    // 验证房间存在
    const room = await queryOne<RoomRow>(
      'SELECT id, owner_id FROM rooms WHERE id = $1',
      [roomId]
    );

    if (!room) {
      throw new AppError(ERROR_CODES.NOT_FOUND, 'Room not found', 404);
    }

    // 验证是 scribe、facilitator 或 owner
    const role = await queryOne<{ role: string }>(
      `SELECT role FROM room_roles WHERE room_id = $1 AND agent_id = $2`,
      [roomId, authResult.agentId]
    );

    const isOwner = room.owner_id === authResult.agentId;
    const isScribe = role?.role === 'scribe';
    const isFacilitator = role?.role === 'facilitator';

    if (!isOwner && !isScribe && !isFacilitator) {
      throw new AppError(ERROR_CODES.FORBIDDEN, 
        'Only owner, scribe or facilitator can create summaries', 403);
    }

    // 如果设置为 pinned，先取消其他 pinned
    if (is_pinned) {
      await query(
        `UPDATE room_summaries SET is_pinned = false WHERE room_id = $1 AND is_pinned = true`,
        [roomId]
      );
    }

    // 获取最新消息数量
    const messageCount = await queryOne<{ count: string }>(
      `SELECT COUNT(*) as count FROM room_messages WHERE room_id = $1`,
      [roomId]
    );

    // 创建摘要
    const summary = await queryOne<{ id: string; created_at: Date }>(
      `INSERT INTO room_summaries (room_id, author_id, content, message_count, is_pinned, summary_type)
       VALUES ($1, $2, $3, $4, $5, 'periodic')
       RETURNING id, created_at`,
      [roomId, authResult.agentId, content, parseInt(messageCount?.count || '0'), is_pinned]
    );

    // 同时发送一条系统消息到房间
    await query(
      `INSERT INTO room_messages (room_id, sender_id, content, message_type)
       VALUES ($1, $2, $3, 'summary')`,
      [roomId, authResult.agentId, content]
    );

    logger.info({
      summaryId: summary!.id,
      roomId,
      authorId: authResult.agentId,
      isPinned: is_pinned,
    }, 'Room summary created');

    reply.status(201);
    return successResponse({
      summary: {
        id: summary!.id,
        room_id: roomId,
        content,
        is_pinned,
        created_at: summary!.created_at.toISOString(),
      },
    });
  });

  /**
   * GET /v1/rooms/:id/summaries
   * 获取房间摘要历史
   */
  fastify.get<{
    Params: { id: string };
    Querystring: { limit?: string };
  }>('/v1/rooms/:id/summaries', async (request, reply) => {
    const { id: roomId } = request.params;
    const limit = Math.min(parseInt(request.query.limit || '10', 10), 50);

    const authResult = await verifyAgentToken(request);
    if (!authResult) {
      throw new AppError(ERROR_CODES.UNAUTHORIZED, 'Agent token required', 401);
    }

    // 验证房间存在且是成员
    const membership = await queryOne(
      'SELECT id FROM room_members WHERE room_id = $1 AND agent_id = $2',
      [roomId, authResult.agentId]
    );

    if (!membership) {
      throw new AppError(ERROR_CODES.FORBIDDEN, 'Not a member of this room', 403);
    }

    const summaries = await queryMany<RoomSummaryRow & { author_name: string }>(
      `SELECT rs.*, a.name as author_name
       FROM room_summaries rs
       JOIN agents a ON rs.author_id = a.id
       WHERE rs.room_id = $1
       ORDER BY rs.created_at DESC
       LIMIT $2`,
      [roomId, limit]
    );

    return successResponse({
      summaries: summaries.map(s => ({
        id: s.id,
        content: s.content,
        is_pinned: s.is_pinned,
        created_at: s.created_at.toISOString(),
      })),
    });
  });

  // ============================================
  // Room Policy API
  // ============================================

  /**
   * GET /v1/rooms/:id/policy
   * 获取房间策略
   */
  fastify.get<{
    Params: { id: string };
  }>('/v1/rooms/:id/policy', async (request, reply) => {
    const { id: roomId } = request.params;

    const authResult = await verifyAgentToken(request);
    if (!authResult) {
      throw new AppError(ERROR_CODES.UNAUTHORIZED, 'Agent token required', 401);
    }

    const policy = await queryOne<RoomPolicyRow>(
      'SELECT * FROM room_policies WHERE room_id = $1',
      [roomId]
    );

    if (!policy) {
      // 返回默认策略
      return successResponse({
        policy: {
          goal: null,
          context_window: 50,
          consecutive_limit: 2,
          speak_triggers: ['mentioned', 'facilitator_assign'],
          auto_summary_enabled: false,
        },
      });
    }

    return successResponse({
      policy: {
        goal: policy.goal,
        context_window: policy.context_window,
        consecutive_limit: policy.consecutive_limit,
        speak_triggers: policy.speak_triggers,
        auto_summary_enabled: policy.auto_summary_enabled,
        summary_interval_minutes: policy.summary_interval_minutes,
        summary_message_threshold: policy.summary_message_threshold,
      },
    });
  });

  /**
   * PATCH /v1/rooms/:id/policy
   * 更新房间策略（仅 owner）
   */
  fastify.patch<{
    Params: { id: string };
    Body: { goal?: string; context_window?: number; consecutive_limit?: number; speak_triggers?: string[] };
  }>('/v1/rooms/:id/policy', async (request, reply) => {
    const { id: roomId } = request.params;

    const authResult = await verifyAgentToken(request);
    if (!authResult) {
      throw new AppError(ERROR_CODES.UNAUTHORIZED, 'Agent token required', 401);
    }

    const parseResult = updatePolicySchema.safeParse(request.body);
    if (!parseResult.success) {
      throw new AppError(ERROR_CODES.VALIDATION_ERROR, 'Invalid request body', 400);
    }

    // 验证是 owner
    const room = await queryOne<RoomRow>(
      'SELECT owner_id FROM rooms WHERE id = $1',
      [roomId]
    );

    if (!room) {
      throw new AppError(ERROR_CODES.NOT_FOUND, 'Room not found', 404);
    }

    if (room.owner_id !== authResult.agentId) {
      throw new AppError(ERROR_CODES.FORBIDDEN, 'Only owner can update policy', 403);
    }

    const { goal, context_window, consecutive_limit, speak_triggers } = parseResult.data;

    // 更新或创建策略
    await query(
      `INSERT INTO room_policies (room_id, goal, context_window, consecutive_limit, speak_triggers)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (room_id) DO UPDATE SET
         goal = COALESCE($2, room_policies.goal),
         context_window = COALESCE($3, room_policies.context_window),
         consecutive_limit = COALESCE($4, room_policies.consecutive_limit),
         speak_triggers = COALESCE($5, room_policies.speak_triggers)`,
      [roomId, goal, context_window, consecutive_limit, speak_triggers ? JSON.stringify(speak_triggers) : null]
    );

    const policy = await queryOne<RoomPolicyRow>(
      'SELECT * FROM room_policies WHERE room_id = $1',
      [roomId]
    );

    return successResponse({
      policy: {
        goal: policy?.goal,
        context_window: policy?.context_window,
        consecutive_limit: policy?.consecutive_limit,
        speak_triggers: policy?.speak_triggers,
      },
    });
  });
}
