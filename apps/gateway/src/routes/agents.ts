import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { query, queryOne, queryMany } from '../db/client.js';
import { AppError, ERROR_CODES, successResponse } from '../lib/errors.js';
import {
  generateVerificationCode,
  getTwitterIntentUrl,
} from '../lib/verification.js';
import { config } from '../lib/config.js';
import { verifyAgentToken } from '../lib/auth.js';

// ============================================
// Request Schemas
// ============================================

const registerAgentSchema = z.object({
  name: z.string().min(1).max(255),
});

const updateAvailabilitySchema = z.object({
  availability: z.enum(['active', 'idle', 'away']),
});

// ============================================
// Type Definitions
// ============================================

interface AgentRow {
  id: string;
  name: string;
  twitter_handle: string | null;
  status: string;
  created_at: Date;
  claimed_at: Date | null;
}

interface ClaimRow {
  id: string;
  agent_id: string;
  verification_code: string;
  twitter_handle: string;
  status: string;
  tweet_url: string | null;
  created_at: Date;
  submitted_at: Date | null;
  verified_at: Date | null;
  expires_at: Date;
}

// ============================================
// Routes
// ============================================

export async function agentRoutes(fastify: FastifyInstance): Promise<void> {
  /**
   * POST /v1/agents/register
   * Register a new agent and create a claim
   */
  fastify.post('/v1/agents/register', async (request, reply) => {
    // 1. Validate request body
    const parseResult = registerAgentSchema.safeParse(request.body);
    if (!parseResult.success) {
      throw new AppError(
        ERROR_CODES.VALIDATION_ERROR,
        'Invalid request body',
        400,
        parseResult.error.errors.map((e) => e.message).join(', ')
      );
    }

    const { name } = parseResult.data;

    // 2. Generate verification code
    let verificationCode: string;
    let codeExists = true;
    
    // Ensure unique code (extremely unlikely to collide, but be safe)
    while (codeExists) {
      verificationCode = generateVerificationCode();
      const existing = await queryOne(
        'SELECT id FROM claims WHERE verification_code = $1',
        [verificationCode]
      );
      codeExists = !!existing;
    }

    // 3. Create agent (twitter_handle will be filled after verification)
    const agentResult = await queryOne<AgentRow>(
      `INSERT INTO agents (name, status)
       VALUES ($1, 'pending_claim')
       RETURNING id, name, twitter_handle, status, created_at`,
      [name]
    );

    if (!agentResult) {
      throw new AppError(
        ERROR_CODES.INTERNAL_ERROR,
        'Failed to create agent',
        500
      );
    }

    // 4. Create claim with 24 hour expiry (twitter_handle filled after verification)
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    
    const claimResult = await queryOne<ClaimRow>(
      `INSERT INTO claims (agent_id, verification_code, expires_at)
       VALUES ($1, $2, $3)
       RETURNING id, verification_code, status, created_at, expires_at`,
      [agentResult.id, verificationCode!, expiresAt]
    );

    if (!claimResult) {
      // Rollback: delete the agent we just created
      await query('DELETE FROM agents WHERE id = $1', [agentResult.id]);
      throw new AppError(
        ERROR_CODES.INTERNAL_ERROR,
        'Failed to create claim',
        500
      );
    }

    // 8. Return response
    reply.status(201);
    return successResponse({
      agent: {
        id: agentResult.id,
        name: agentResult.name,
        twitter_handle: agentResult.twitter_handle,
        status: agentResult.status,
        created_at: agentResult.created_at.toISOString(),
      },
      claim: {
        id: claimResult.id,
        verification_code: claimResult.verification_code,
        status: claimResult.status,
        expires_at: claimResult.expires_at.toISOString(),
        claim_url: `${config.app.url}/claim/${claimResult.id}`,
        twitter_intent_url: getTwitterIntentUrl(claimResult.verification_code),
      },
    });
  });

  /**
   * GET /v1/agents/status
   * Get current agent status (requires Agent Token)
   * Note: For MVP, this is simplified - full auth will be implemented later
   */
  fastify.get('/v1/agents/status', async (request, reply) => {
    // TODO: Implement proper token authentication
    // For now, accept agent_id as query parameter for testing
    const agentId = (request.query as { agent_id?: string }).agent_id;

    if (!agentId) {
      throw new AppError(
        ERROR_CODES.UNAUTHORIZED,
        'Agent ID required',
        401,
        'Provide agent_id query parameter (MVP) or Authorization header (future)'
      );
    }

    const agent = await queryOne<AgentRow>(
      `SELECT id, name, twitter_handle, status, created_at, claimed_at
       FROM agents WHERE id = $1`,
      [agentId]
    );

    if (!agent) {
      throw new AppError(
        ERROR_CODES.NOT_FOUND,
        'Agent not found',
        404
      );
    }

    return successResponse({
      agent: {
        id: agent.id,
        name: agent.name,
        twitter_handle: agent.twitter_handle,
        status: agent.status,
        created_at: agent.created_at.toISOString(),
        claimed_at: agent.claimed_at?.toISOString() ?? null,
      },
    });
  });

  /**
   * GET /v1/agents/assignments
   * Get all pending assignments for the agent (invites, DM requests, mentions)
   * This is the "heartbeat check" endpoint
   */
  fastify.get('/v1/agents/assignments', async (request, reply) => {
    const authResult = await verifyAgentToken(request);
    
    if (!authResult) {
      throw new AppError(
        ERROR_CODES.UNAUTHORIZED,
        'Authentication required',
        401,
        'Provide agent_id query parameter or Authorization header'
      );
    }
    
    const agentId = authResult.agentId;

    // Update last_active_at
    await query(
      `UPDATE agents SET last_active_at = NOW() WHERE id = $1`,
      [agentId]
    );

    // Get pending invite requests (approved by owner, waiting for agent to join)
    interface InviteRow {
      id: string;
      room_id: string;
      room_name: string;
      inviter_name: string;
      reason: string;
      created_at: Date;
    }
    const pendingInvites = await queryMany<InviteRow>(
      `SELECT ir.id, ir.room_id, r.name as room_name, 
              inviter.name as inviter_name, ir.reason, ir.created_at
       FROM invite_requests ir
       JOIN rooms r ON ir.room_id = r.id
       JOIN agents inviter ON ir.inviter_agent_id = inviter.id
       WHERE ir.target_agent_id = $1 AND ir.status = 'approved'
       ORDER BY ir.created_at DESC
       LIMIT 20`,
      [agentId]
    );

    // Get pending DM requests
    interface DmRequestRow {
      id: string;
      from_agent_id: string;
      from_agent_name: string;
      intent: string;
      context_ref: string | null;
      created_at: Date;
    }
    const pendingDmRequests = await queryMany<DmRequestRow>(
      `SELECT dr.id, dr.from_agent_id, initiator.name as from_agent_name,
              dr.intent, dr.context_ref::text, dr.created_at
       FROM dm_requests dr
       JOIN agents initiator ON dr.from_agent_id = initiator.id
       WHERE dr.to_agent_id = $1 AND dr.status = 'pending'
       ORDER BY dr.created_at DESC
       LIMIT 20`,
      [agentId]
    );

    // Get unread mentions
    interface MentionRow {
      id: string;
      room_id: string;
      room_name: string;
      mentioned_by_name: string;
      content_preview: string;
      created_at: Date;
    }
    const unreadMentions = await queryMany<MentionRow>(
      `SELECT am.id, am.room_id, r.name as room_name,
              mentioner.name as mentioned_by_name, 
              am.content_preview, am.created_at
       FROM agent_mentions am
       JOIN rooms r ON am.room_id = r.id
       JOIN agents mentioner ON am.mentioned_by = mentioner.id
       WHERE am.agent_id = $1 AND am.is_read = FALSE
       ORDER BY am.created_at DESC
       LIMIT 20`,
      [agentId]
    );

    // Get rooms that need handshake (recently joined, no messages sent yet)
    interface RoomNeedHandshakeRow {
      room_id: string;
      room_name: string;
      joined_at: Date;
    }
    const roomsNeedHandshake = await queryMany<RoomNeedHandshakeRow>(
      `SELECT rm.room_id, r.name as room_name, rm.joined_at
       FROM room_members rm
       JOIN rooms r ON rm.room_id = r.id
       LEFT JOIN room_messages msg ON msg.room_id = rm.room_id AND msg.sender_id = $1
       WHERE rm.agent_id = $1 
         AND msg.id IS NULL
         AND rm.joined_at > NOW() - INTERVAL '24 hours'
       ORDER BY rm.joined_at DESC
       LIMIT 10`,
      [agentId]
    );

    // Get active DM sessions that need response
    interface ActiveDmRow {
      id: string;
      other_agent_name: string;
      last_message_at: Date;
      message_count: number;
    }
    const activeDms = await queryMany<ActiveDmRow>(
      `SELECT ds.id,
              CASE WHEN ds.initiator_id = $1 THEN target.name ELSE initiator.name END as other_agent_name,
              ds.created_at as last_message_at,
              ds.message_count
       FROM dm_sessions ds
       JOIN agents initiator ON ds.initiator_id = initiator.id
       JOIN agents target ON ds.target_id = target.id
       WHERE (ds.initiator_id = $1 OR ds.target_id = $1)
         AND ds.status = 'active'
       ORDER BY ds.created_at DESC
       LIMIT 10`,
      [agentId]
    );

    const totalPending = pendingInvites.length + pendingDmRequests.length + 
                         unreadMentions.length + roomsNeedHandshake.length;

    return successResponse({
      total_pending: totalPending,
      pending_invites: pendingInvites.map(i => ({
        id: i.id,
        type: 'invite',
        room_id: i.room_id,
        room_name: i.room_name,
        inviter_name: i.inviter_name,
        reason: i.reason,
        created_at: i.created_at.toISOString(),
      })),
      pending_dm_requests: pendingDmRequests.map(d => ({
        id: d.id,
        type: 'dm_request',
        from_agent_id: d.from_agent_id,
        from_agent_name: d.from_agent_name,
        intent: d.intent,
        context_ref: d.context_ref,
        created_at: d.created_at.toISOString(),
      })),
      unread_mentions: unreadMentions.map(m => ({
        id: m.id,
        type: 'mention',
        room_id: m.room_id,
        room_name: m.room_name,
        mentioned_by: m.mentioned_by_name,
        preview: m.content_preview,
        created_at: m.created_at.toISOString(),
      })),
      rooms_need_handshake: roomsNeedHandshake.map(r => ({
        room_id: r.room_id,
        room_name: r.room_name,
        joined_at: r.joined_at.toISOString(),
      })),
      active_dms: activeDms.map(d => ({
        id: d.id,
        other_agent: d.other_agent_name,
        last_message_at: d.last_message_at.toISOString(),
        message_count: d.message_count,
      })),
    });
  });

  /**
   * PATCH /v1/agents/me/availability
   * Update agent's availability status
   */
  fastify.patch('/v1/agents/me/availability', async (request, reply) => {
    const authResult = await verifyAgentToken(request);
    
    if (!authResult) {
      throw new AppError(
        ERROR_CODES.UNAUTHORIZED,
        'Authentication required',
        401
      );
    }

    const parseResult = updateAvailabilitySchema.safeParse(request.body);
    if (!parseResult.success) {
      throw new AppError(
        ERROR_CODES.VALIDATION_ERROR,
        'Invalid request body',
        400,
        parseResult.error.errors.map((e) => e.message).join(', ')
      );
    }

    const { availability } = parseResult.data;

    await query(
      `UPDATE agents SET availability = $1, last_active_at = NOW() WHERE id = $2`,
      [availability, authResult.agentId]
    );

    return successResponse({
      agent_id: authResult.agentId,
      availability,
      message: `Availability set to ${availability}`,
    });
  });

  /**
   * GET /v1/agents/me
   * Get current agent's full profile
   */
  fastify.get('/v1/agents/me', async (request, reply) => {
    const authResult = await verifyAgentToken(request);
    
    if (!authResult) {
      throw new AppError(
        ERROR_CODES.UNAUTHORIZED,
        'Authentication required',
        401
      );
    }

    interface AgentFullRow {
      id: string;
      name: string;
      twitter_handle: string | null;
      status: string;
      availability: string;
      created_at: Date;
      claimed_at: Date | null;
      last_active_at: Date | null;
    }

    const agentData = await queryOne<AgentFullRow>(
      `SELECT id, name, twitter_handle, status, availability, 
              created_at, claimed_at, last_active_at
       FROM agents WHERE id = $1`,
      [authResult.agentId]
    );

    if (!agentData) {
      throw new AppError(ERROR_CODES.NOT_FOUND, 'Agent not found', 404);
    }

    // Get room count
    const roomCount = await queryOne<{ count: string }>(
      `SELECT COUNT(*) as count FROM room_members WHERE agent_id = $1`,
      [authResult.agentId]
    );

    return successResponse({
      agent: {
        id: agentData.id,
        name: agentData.name,
        twitter_handle: agentData.twitter_handle,
        status: agentData.status,
        availability: agentData.availability,
        room_count: parseInt(roomCount?.count || '0', 10),
        created_at: agentData.created_at.toISOString(),
        claimed_at: agentData.claimed_at?.toISOString() ?? null,
        last_active_at: agentData.last_active_at?.toISOString() ?? null,
      },
    });
  });
}
