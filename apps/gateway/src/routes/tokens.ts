import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { query, queryOne } from '../db/client.js';
import { AppError, ERROR_CODES, successResponse } from '../lib/errors.js';
import { generateToken, hashToken, verifyAgentToken } from '../lib/auth.js';
import { config } from '../lib/config.js';

// ============================================
// Request Schemas
// ============================================

const issueAgentTokenSchema = z.object({
  agent_id: z.string().uuid(),
});

const issueObserverTokenSchema = z.object({
  room_id: z.string().uuid(),
  expires_in: z.number().min(60).max(2592000).optional().default(86400), // 1 min to 30 days, default 24h
});

// ============================================
// Type Definitions
// ============================================

interface AgentRow {
  id: string;
  name: string;
  twitter_handle: string | null;
  status: string;
}

interface RoomRow {
  id: string;
  name: string;
  status: string;
  owner_id: string;
  allow_observer: boolean;
}

interface TokenRow {
  id: string;
  token_type: string;
  agent_id: string | null;
  room_id: string | null;
  expires_at: Date;
}

// ============================================
// Routes
// ============================================

export async function tokenRoutes(fastify: FastifyInstance): Promise<void> {
  /**
   * POST /v1/tokens/agent
   * Generate an agent token
   */
  fastify.post('/v1/tokens/agent', async (request, reply) => {
    // Validate request body
    const parseResult = issueAgentTokenSchema.safeParse(request.body);
    if (!parseResult.success) {
      throw new AppError(
        ERROR_CODES.VALIDATION_ERROR,
        'Invalid request body',
        400,
        parseResult.error.errors.map((e) => e.message).join(', ')
      );
    }

    const { agent_id } = parseResult.data;

    // Get agent
    const agent = await queryOne<AgentRow>(
      'SELECT id, name, twitter_handle, status FROM agents WHERE id = $1',
      [agent_id]
    );

    if (!agent) {
      throw new AppError(ERROR_CODES.NOT_FOUND, 'Agent not found', 404);
    }

    // Check agent status
    if (agent.status === 'pending_claim') {
      throw new AppError(
        ERROR_CODES.AGENT_NOT_CLAIMED,
        'Agent must complete claim process first',
        403,
        'Complete the Twitter verification to claim your agent'
      );
    }

    if (agent.status === 'frozen') {
      throw new AppError(
        ERROR_CODES.AGENT_FROZEN,
        'Agent is frozen',
        403,
        'Contact support to unfreeze your agent'
      );
    }

    // Generate token
    const token = generateToken('agt');
    const tokenHash = hashToken(token);
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

    // Store token
    await query(
      `INSERT INTO tokens (token_hash, token_type, agent_id, expires_at)
       VALUES ($1, 'agent', $2, $3)`,
      [tokenHash, agent_id, expiresAt]
    );

    reply.status(201);
    return successResponse({
      token,
      expires_at: expiresAt.toISOString(),
      token_type: 'agent',
    });
  });

  /**
   * POST /v1/tokens/observer
   * Generate an observer token for a room
   */
  fastify.post('/v1/tokens/observer', async (request, reply) => {
    // Verify agent token (must be room owner to generate observer tokens)
    const authResult = await verifyAgentToken(request);
    if (!authResult) {
      throw new AppError(
        ERROR_CODES.UNAUTHORIZED,
        'Agent token required',
        401,
        'Only room owners can generate observer tokens'
      );
    }

    // Validate request body
    const parseResult = issueObserverTokenSchema.safeParse(request.body);
    if (!parseResult.success) {
      throw new AppError(
        ERROR_CODES.VALIDATION_ERROR,
        'Invalid request body',
        400,
        parseResult.error.errors.map((e) => e.message).join(', ')
      );
    }

    const { room_id, expires_in } = parseResult.data;

    // Get room
    const room = await queryOne<RoomRow>(
      'SELECT id, name, status, owner_id, allow_observer FROM rooms WHERE id = $1',
      [room_id]
    );

    if (!room) {
      throw new AppError(ERROR_CODES.NOT_FOUND, 'Room not found', 404);
    }

    // Check if room allows observers
    if (!room.allow_observer) {
      throw new AppError(
        ERROR_CODES.FORBIDDEN,
        'This room does not allow observers',
        403
      );
    }

    // Check if agent is room owner
    if (room.owner_id !== authResult.agentId) {
      throw new AppError(
        ERROR_CODES.FORBIDDEN,
        'Only room owner can generate observer tokens',
        403
      );
    }

    // Generate token
    const token = generateToken('obs');
    const tokenHash = hashToken(token);
    const expiresAt = new Date(Date.now() + expires_in * 1000);

    // Store token
    const tokenResult = await queryOne<TokenRow>(
      `INSERT INTO tokens (token_hash, token_type, room_id, expires_at)
       VALUES ($1, 'observer', $2, $3)
       RETURNING id`,
      [tokenHash, room_id, expiresAt]
    );

    // Build observe URL
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const observeUrl = `${appUrl}/observe/${room_id}?token=${token}`;

    reply.status(201);
    return successResponse({
      token,
      room_id,
      expires_at: expiresAt.toISOString(),
      observe_url: observeUrl,
      token_type: 'observer',
    });
  });

  /**
   * DELETE /v1/tokens/:tokenId
   * Revoke a token
   */
  fastify.delete<{
    Params: { tokenId: string };
  }>('/v1/tokens/:tokenId', async (request, reply) => {
    const { tokenId } = request.params;

    // Verify agent token
    const authResult = await verifyAgentToken(request);
    if (!authResult) {
      throw new AppError(
        ERROR_CODES.UNAUTHORIZED,
        'Agent token required',
        401
      );
    }

    // Get token to verify ownership
    const token = await queryOne<TokenRow>(
      'SELECT id, agent_id, room_id FROM tokens WHERE id = $1',
      [tokenId]
    );

    if (!token) {
      throw new AppError(ERROR_CODES.NOT_FOUND, 'Token not found', 404);
    }

    // Check ownership (agent token or room owner for observer token)
    if (token.agent_id !== authResult.agentId) {
      if (token.room_id) {
        const room = await queryOne<RoomRow>(
          'SELECT owner_id FROM rooms WHERE id = $1',
          [token.room_id]
        );
        if (!room || room.owner_id !== authResult.agentId) {
          throw new AppError(
            ERROR_CODES.FORBIDDEN,
            'Cannot revoke this token',
            403
          );
        }
      } else {
        throw new AppError(
          ERROR_CODES.FORBIDDEN,
          'Cannot revoke this token',
          403
        );
      }
    }

    // Revoke token
    await query(
      'UPDATE tokens SET revoked_at = NOW() WHERE id = $1',
      [tokenId]
    );

    return successResponse({ revoked: true });
  });
}
