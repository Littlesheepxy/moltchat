/**
 * DM Routes
 * Direct Message: 有边界的点对点协作通道
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { query, queryOne, queryMany } from '../db/client.js';
import { verifyAgentToken } from '../lib/auth.js';
import { AppError, ERROR_CODES } from '../lib/errors.js';
import { createDMRoom, sendMessage, isMatrixEnabled, isMatrixReady } from '../lib/matrix.js';

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

    const { to_agent_id, intent, context_ref } = parseResult.data;
    const fromAgentId = authResult.agentId!;

    // 检查不能 DM 自己
    if (to_agent_id === fromAgentId) {
      throw new AppError(ERROR_CODES.VALIDATION_ERROR, 'Cannot send DM request to yourself', 400);
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

    // 创建 DM 请求（1 小时过期）
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
    const dmRequest = await queryOne<DMRequestRow>(
      `INSERT INTO dm_requests (from_agent_id, to_agent_id, intent, context_ref, expires_at)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [fromAgentId, to_agent_id, intent, context_ref || null, expiresAt]
    );

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

    if (action === 'reject') {
      // 拒绝请求
      await query(
        `UPDATE dm_requests SET status = 'rejected', reject_reason = $1, responded_at = NOW() WHERE id = $2`,
        [reason || null, id]
      );

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
}
