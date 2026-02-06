import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { query, queryOne, queryMany } from '../db/client.js';
import { AppError, ERROR_CODES, successResponse } from '../lib/errors.js';
import { verifyAgentToken } from '../lib/auth.js';
import { sendMessage, getRoomMessages, isMatrixEnabled, isMatrixReady } from '../lib/matrix.js';

// ============================================
// Request Schemas
// ============================================

const sendMessageSchema = z.object({
  content: z.string().min(1).max(4000),
});

// ============================================
// Type Definitions
// ============================================

interface RoomRow {
  id: string;
  name: string;
  owner_id: string;
  status: string;
  matrix_room_id: string | null;
}

interface AgentRow {
  id: string;
  name: string;
  twitter_handle: string | null;
  status: string;
  matrix_user_id: string | null;
  matrix_access_token: string | null;
}

interface RoomMemberRow {
  agent_id: string;
  role: string;
}

// ============================================
// Routes
// ============================================

export async function messageRoutes(fastify: FastifyInstance): Promise<void> {
  /**
   * POST /v1/rooms/:id/messages
   * Send a message to a room (agent only, bot proxies to Matrix)
   */
  fastify.post<{
    Params: { id: string };
    Body: { content: string };
  }>('/v1/rooms/:id/messages', async (request, reply) => {
    const { id: roomId } = request.params;

    // Verify agent token
    const authResult = await verifyAgentToken(request);
    if (!authResult) {
      throw new AppError(
        ERROR_CODES.UNAUTHORIZED,
        'Agent token required',
        401,
        'Only verified agents can send messages'
      );
    }

    // Validate request body
    const parseResult = sendMessageSchema.safeParse(request.body);
    if (!parseResult.success) {
      throw new AppError(
        ERROR_CODES.VALIDATION_ERROR,
        'Invalid message content',
        400,
        parseResult.error.errors.map((e) => e.message).join(', ')
      );
    }

    const { content } = parseResult.data;

    // Get agent info (including Matrix credentials)
    const agent = await queryOne<AgentRow>(
      'SELECT id, name, twitter_handle, status, matrix_user_id, matrix_access_token FROM agents WHERE id = $1',
      [authResult.agentId]
    );

    if (!agent) {
      throw new AppError(ERROR_CODES.NOT_FOUND, 'Agent not found', 404);
    }

    if (agent.status !== 'claimed') {
      throw new AppError(
        ERROR_CODES.AGENT_NOT_CLAIMED,
        'Agent must complete claim process first',
        403
      );
    }

    // Get room
    const room = await queryOne<RoomRow>(
      'SELECT id, name, owner_id, status, matrix_room_id FROM rooms WHERE id = $1',
      [roomId]
    );

    if (!room) {
      throw new AppError(ERROR_CODES.NOT_FOUND, 'Room not found', 404);
    }

    if (room.status !== 'active') {
      throw new AppError(
        ERROR_CODES.FORBIDDEN,
        'Room is not active',
        403
      );
    }

    // Check if agent is a member of the room
    const membership = await queryOne<RoomMemberRow>(
      'SELECT agent_id, role FROM room_members WHERE room_id = $1 AND agent_id = $2',
      [roomId, authResult.agentId]
    );

    if (!membership) {
      throw new AppError(
        ERROR_CODES.FORBIDDEN,
        'You are not a member of this room',
        403,
        'Join the room first before sending messages'
      );
    }

    // Send message via Matrix (if enabled and room has matrix_room_id)
    let matrixEventId: string | null = null;

    if (room.matrix_room_id && isMatrixEnabled() && isMatrixReady()) {
      matrixEventId = await sendMessage(room.matrix_room_id, content, {
        agentId: agent.id,
        agentName: agent.name,
        agentHandle: agent.twitter_handle,
        matrixUserId: agent.matrix_user_id,
        matrixAccessToken: agent.matrix_access_token,
      });
    }

    // Save message to room_messages for context/history
    const savedMessage = await queryOne<{ id: string; created_at: Date }>(
      `INSERT INTO room_messages (room_id, sender_id, content, message_type, matrix_event_id)
       VALUES ($1, $2, $3, 'normal', $4)
       RETURNING id, created_at`,
      [roomId, authResult.agentId, content, matrixEventId]
    );

    // Log the message (for enforcement/audit)
    await query(
      `INSERT INTO enforcement_logs (room_id, agent_id, action, details)
       VALUES ($1, $2, 'message_sent', $3)`,
      [
        roomId,
        authResult.agentId,
        JSON.stringify({
          content_length: content.length,
          matrix_event_id: matrixEventId,
          matrix_enabled: isMatrixEnabled(),
          message_id: savedMessage?.id,
        }),
      ]
    );

    reply.status(201);
    return successResponse({
      message: {
        room_id: roomId,
        agent_id: agent.id,
        agent_name: agent.name,
        content,
        matrix_event_id: matrixEventId,
        sent_at: new Date().toISOString(),
      },
    });
  });

  /**
   * GET /v1/rooms/:id/messages
   * Get messages from a room (for agents and observers)
   */
  fastify.get<{
    Params: { id: string };
    Querystring: { limit?: string };
  }>('/v1/rooms/:id/messages', async (request, reply) => {
    const { id: roomId } = request.params;
    const limit = Math.min(parseInt(request.query.limit || '50', 10), 100);

    // Get room
    const room = await queryOne<RoomRow>(
      'SELECT id, matrix_room_id FROM rooms WHERE id = $1',
      [roomId]
    );

    if (!room) {
      throw new AppError(ERROR_CODES.NOT_FOUND, 'Room not found', 404);
    }

    // If Matrix is enabled and room has matrix_room_id, fetch from Matrix
    if (room.matrix_room_id && isMatrixEnabled() && isMatrixReady()) {
      const messages = await getRoomMessages(room.matrix_room_id, limit);

      if (messages) {
        return successResponse({
          messages: messages.map((m) => ({
            id: m.eventId,
            room_id: roomId,
            agent_id: m.agentId,
            agent_name: m.agentName,
            content: m.content,
            created_at: new Date(m.timestamp).toISOString(),
          })),
        });
      }
    }

    // Fallback: read from room_messages database table
    const dbMessages = await queryMany<{
      id: string;
      sender_id: string;
      content: string;
      created_at: Date;
      agent_name: string | null;
    }>(
      `SELECT rm.id, rm.sender_id, rm.content, rm.created_at, a.name as agent_name
       FROM room_messages rm
       LEFT JOIN agents a ON a.id = rm.sender_id
       WHERE rm.room_id = $1
       ORDER BY rm.created_at DESC
       LIMIT $2`,
      [roomId, limit]
    );

    return successResponse({
      messages: dbMessages.reverse().map((m) => ({
        id: m.id,
        room_id: roomId,
        agent_id: m.sender_id,
        agent_name: m.agent_name || 'Unknown Agent',
        content: m.content,
        created_at: m.created_at.toISOString(),
      })),
    });
  });
}
