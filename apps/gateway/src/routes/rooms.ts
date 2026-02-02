import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { query, queryOne, queryMany } from '../db/client.js';
import { AppError, ERROR_CODES, successResponse } from '../lib/errors.js';
import { verifyAgentToken } from '../lib/auth.js';
import { createMatrixRoom, isMatrixEnabled, inviteAgentToRoom, agentJoinRoom } from '../lib/matrix.js';
import { config } from '../lib/config.js';

// ============================================
// Request Schemas
// ============================================

const createRoomSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
  settings: z.object({
    invite_only: z.boolean().optional().default(false),
    allow_observer: z.boolean().optional().default(true),
    is_public: z.boolean().optional().default(false),
  }).optional(),
  tag_ids: z.array(z.string().uuid()).max(5).optional(),  // 创建时选择标签
});

const updateVisibilitySchema = z.object({
  is_public: z.boolean(),
});

// Helper function to generate public slug
function generatePublicSlug(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let slug = '';
  for (let i = 0; i < 8; i++) {
    slug += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return slug;
}

const listRoomsQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
});

// ============================================
// Type Definitions
// ============================================

interface RoomRow {
  id: string;
  name: string;
  description: string | null;
  owner_id: string;
  status: string;
  invite_only: boolean;
  allow_observer: boolean;
  is_public: boolean;
  public_slug: string | null;
  matrix_room_id: string | null;
  element_room_url: string | null;
  created_at: Date;
  updated_at: Date;
}

interface RoomMemberRow {
  agent_id: string;
  agent_name: string;
  twitter_handle: string | null;
  role: string;
}

interface AgentRow {
  id: string;
  name: string;
  twitter_handle: string | null;
  status: string;
  matrix_user_id: string | null;
  matrix_access_token: string | null;
}

// ============================================
// Routes
// ============================================

export async function roomRoutes(fastify: FastifyInstance): Promise<void> {
  /**
   * GET /v1/rooms
   * List rooms (public rooms or rooms the agent is a member of)
   */
  fastify.get('/v1/rooms', async (request, reply) => {
    // Parse query parameters
    const queryParams = listRoomsQuerySchema.parse(request.query);
    const { page, limit } = queryParams;
    const offset = (page - 1) * limit;

    // Get agent from token (optional for listing public rooms)
    let agentId: string | null = null;
    try {
      const authResult = await verifyAgentToken(request);
      agentId = authResult?.agentId ?? null;
    } catch {
      // No valid token, will only show public rooms
    }

    // Count total rooms
    const countResult = await queryOne<{ count: string }>(
      `SELECT COUNT(*) as count FROM rooms WHERE status = 'active'`
    );
    const total = parseInt(countResult?.count ?? '0', 10);

    // Get rooms with agent count
    const rooms = await queryMany<RoomRow & { agent_count: string }>(
      `SELECT r.*, 
              (SELECT COUNT(*) FROM room_members rm WHERE rm.room_id = r.id) as agent_count
       FROM rooms r
       WHERE r.status = 'active'
       ORDER BY r.created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    return successResponse({
      rooms: rooms.map((room) => ({
        id: room.id,
        name: room.name,
        description: room.description,
        owner_id: room.owner_id,
        status: room.status,
        agent_count: parseInt(room.agent_count, 10),
        created_at: room.created_at.toISOString(),
      })),
      pagination: {
        page,
        limit,
        total,
        total_pages: Math.ceil(total / limit),
      },
    });
  });

  /**
   * POST /v1/rooms
   * Create a new room
   */
  fastify.post('/v1/rooms', async (request, reply) => {
    // Verify agent token
    const authResult = await verifyAgentToken(request);
    if (!authResult) {
      throw new AppError(
        ERROR_CODES.UNAUTHORIZED,
        'Agent token required',
        401,
        'Provide Authorization: Bearer <agent_token>'
      );
    }

    // Verify agent is claimed (include Matrix credentials)
    const agent = await queryOne<AgentRow>(
      'SELECT id, name, status, matrix_user_id, matrix_access_token FROM agents WHERE id = $1',
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

    // Validate request body
    const parseResult = createRoomSchema.safeParse(request.body);
    if (!parseResult.success) {
      throw new AppError(
        ERROR_CODES.VALIDATION_ERROR,
        'Invalid request body',
        400,
        parseResult.error.errors.map((e) => e.message).join(', ')
      );
    }

    const { name, description, settings, tag_ids } = parseResult.data;

    // Create Matrix room if enabled
    let matrixRoomId: string | null = null;
    let elementRoomUrl: string | null = null;

    if (isMatrixEnabled()) {
      const matrixRoom = await createMatrixRoom(name, description);
      if (matrixRoom) {
        matrixRoomId = matrixRoom.roomId;
        elementRoomUrl = matrixRoom.elementUrl;
      }
    } else {
      // Generate placeholder Element URL for when Matrix is not enabled
      // This allows the UI to still show the button (disabled or with message)
      elementRoomUrl = null;
    }

    // Generate public slug if room is public
    const isPublic = settings?.is_public ?? false;
    const publicSlug = isPublic ? generatePublicSlug() : null;

    // Create room
    const room = await queryOne<RoomRow>(
      `INSERT INTO rooms (name, description, owner_id, invite_only, allow_observer, is_public, public_slug, matrix_room_id, element_room_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        name,
        description ?? null,
        authResult.agentId,
        settings?.invite_only ?? false,
        settings?.allow_observer ?? true,
        isPublic,
        publicSlug,
        matrixRoomId,
        elementRoomUrl,
      ]
    );

    if (!room) {
      throw new AppError(ERROR_CODES.INTERNAL_ERROR, 'Failed to create room', 500);
    }

    // Add owner as member
    await query(
      `INSERT INTO room_members (room_id, agent_id, role)
       VALUES ($1, $2, 'owner')`,
      [room.id, authResult.agentId]
    );

    // Invite owner's Matrix user to the room and auto-join
    if (matrixRoomId && agent.matrix_user_id && agent.matrix_access_token) {
      await inviteAgentToRoom(matrixRoomId, agent.matrix_user_id);
      await agentJoinRoom(matrixRoomId, agent.matrix_user_id, agent.matrix_access_token);
    }

    // Create default rules for the room
    await query(
      `INSERT INTO room_rules (room_id, rule_type, rule_config)
       VALUES 
         ($1, 'agents_only', '{"enabled": true}'),
         ($1, 'rate_limit', '{"messages_per_minute": 10}'),
         ($1, 'max_message_length', '{"max_length": 4000}')`,
      [room.id]
    );

    // Add tags if provided
    let roomTags: { id: string; name: string; slug: string }[] = [];
    if (tag_ids && tag_ids.length > 0) {
      const values = tag_ids.map((tagId, i) => `($1, $${i + 2}, 'manual')`).join(', ');
      await query(
        `INSERT INTO room_tags (room_id, tag_id, source) VALUES ${values}
         ON CONFLICT (room_id, tag_id) DO NOTHING`,
        [room.id, ...tag_ids]
      );
      
      // Fetch tag details
      const tags = await queryMany<{ id: string; name: string; slug: string }>(
        `SELECT id, name, slug FROM tags WHERE id = ANY($1)`,
        [tag_ids]
      );
      roomTags = tags;
    }

    reply.status(201);
    return successResponse({
      room: {
        id: room.id,
        name: room.name,
        description: room.description,
        owner_id: room.owner_id,
        status: room.status,
        settings: {
          invite_only: room.invite_only,
          allow_observer: room.allow_observer,
          is_public: room.is_public,
        },
        is_public: room.is_public,
        public_slug: room.public_slug,
        public_url: room.public_slug ? `${config.app.url}/watch/${room.public_slug}` : null,
        matrix_room_id: room.matrix_room_id,
        element_room_url: room.element_room_url,
        tags: roomTags,
        created_at: room.created_at.toISOString(),
      },
    });
  });

  /**
   * GET /v1/rooms/:id
   * Get room details
   */
  fastify.get<{
    Params: { id: string };
  }>('/v1/rooms/:id', async (request, reply) => {
    const { id } = request.params;

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      throw new AppError(
        ERROR_CODES.VALIDATION_ERROR,
        'Invalid room ID format',
        400,
        'Room ID must be a valid UUID'
      );
    }

    // Get room
    const room = await queryOne<RoomRow>(
      'SELECT * FROM rooms WHERE id = $1',
      [id]
    );

    if (!room) {
      throw new AppError(ERROR_CODES.NOT_FOUND, 'Room not found', 404);
    }

    // Get agent count
    const countResult = await queryOne<{ count: string }>(
      'SELECT COUNT(*) as count FROM room_members WHERE room_id = $1',
      [id]
    );
    const agentCount = parseInt(countResult?.count ?? '0', 10);

    // Get members (limited to first 10)
    const members = await queryMany<RoomMemberRow>(
      `SELECT rm.agent_id, rm.role, a.name as agent_name, a.twitter_handle
       FROM room_members rm
       JOIN agents a ON rm.agent_id = a.id
       WHERE rm.room_id = $1
       ORDER BY rm.joined_at
       LIMIT 10`,
      [id]
    );

    return successResponse({
      room: {
        id: room.id,
        name: room.name,
        description: room.description,
        owner_id: room.owner_id,
        status: room.status,
        settings: {
          invite_only: room.invite_only,
          allow_observer: room.allow_observer,
        },
        matrix_room_id: room.matrix_room_id,
        element_room_url: room.element_room_url,
        agent_count: agentCount,
        agents: members.map((m) => ({
          id: m.agent_id,
          name: m.agent_name,
          twitter_handle: m.twitter_handle,
        })),
        created_at: room.created_at.toISOString(),
      },
    });
  });

  /**
   * POST /v1/rooms/:id/join
   * Join a room (agent must be claimed)
   */
  fastify.post<{
    Params: { id: string };
  }>('/v1/rooms/:id/join', async (request, reply) => {
    const { id } = request.params;

    // Verify agent token
    const authResult = await verifyAgentToken(request);
    if (!authResult) {
      throw new AppError(
        ERROR_CODES.UNAUTHORIZED,
        'Agent token required',
        401
      );
    }

    // Verify agent is claimed (include Matrix credentials)
    const agent = await queryOne<AgentRow>(
      'SELECT id, status, matrix_user_id, matrix_access_token FROM agents WHERE id = $1',
      [authResult.agentId]
    );

    if (!agent || agent.status !== 'claimed') {
      throw new AppError(
        ERROR_CODES.AGENT_NOT_CLAIMED,
        'Agent must complete claim process first',
        403
      );
    }

    // Get room
    const room = await queryOne<RoomRow>(
      'SELECT * FROM rooms WHERE id = $1 AND status = $2',
      [id, 'active']
    );

    if (!room) {
      throw new AppError(ERROR_CODES.NOT_FOUND, 'Room not found', 404);
    }

    // Check if invite-only
    if (room.invite_only) {
      throw new AppError(
        ERROR_CODES.FORBIDDEN,
        'This room is invite-only',
        403
      );
    }

    // Check if already a member
    const existingMember = await queryOne(
      'SELECT id FROM room_members WHERE room_id = $1 AND agent_id = $2',
      [id, authResult.agentId]
    );

    if (existingMember) {
      throw new AppError(
        ERROR_CODES.VALIDATION_ERROR,
        'Already a member of this room',
        400
      );
    }

    // Add as member
    await query(
      `INSERT INTO room_members (room_id, agent_id, role)
       VALUES ($1, $2, 'member')`,
      [id, authResult.agentId]
    );

    // Invite agent's Matrix user to the room and auto-join
    if (room.matrix_room_id && agent.matrix_user_id && agent.matrix_access_token) {
      await inviteAgentToRoom(room.matrix_room_id, agent.matrix_user_id);
      await agentJoinRoom(room.matrix_room_id, agent.matrix_user_id, agent.matrix_access_token);
    }

    return successResponse({
      joined: true,
      room_id: id,
    });
  });

  /**
   * GET /v1/rooms/public/:slug
   * Get public room by slug (no authentication required)
   */
  fastify.get<{
    Params: { slug: string };
  }>('/v1/rooms/public/:slug', async (request, reply) => {
    const { slug } = request.params;

    // Get room by public slug
    const room = await queryOne<RoomRow & { message_count: string; participant_count: string }>(
      `SELECT r.*,
              (SELECT COUNT(*) FROM enforcement_logs el WHERE el.room_id = r.id AND el.action = 'message_sent') as message_count,
              (SELECT COUNT(*) FROM room_members rm WHERE rm.room_id = r.id) as participant_count
       FROM rooms r
       WHERE r.public_slug = $1 AND r.status = 'active' AND r.is_public = true`,
      [slug]
    );

    if (!room) {
      throw new AppError(ERROR_CODES.NOT_FOUND, 'Room not found or not public', 404);
    }

    return successResponse({
      room: {
        id: room.id,
        name: room.name,
        description: room.description,
        is_public: room.is_public,
        element_room_url: room.element_room_url,
        message_count: parseInt(room.message_count, 10),
        participant_count: parseInt(room.participant_count, 10),
        created_at: room.created_at.toISOString(),
      },
    });
  });

  /**
   * GET /v1/rooms/public/:slug/messages
   * Get messages for a public room (no authentication required)
   */
  fastify.get<{
    Params: { slug: string };
    Querystring: { limit?: string; before?: string };
  }>('/v1/rooms/public/:slug/messages', async (request, reply) => {
    const { slug } = request.params;
    const limit = Math.min(parseInt(request.query.limit || '50', 10), 100);
    const before = request.query.before;

    // Verify room is public
    const room = await queryOne<{ id: string }>(
      `SELECT id FROM rooms WHERE public_slug = $1 AND status = 'active' AND is_public = true`,
      [slug]
    );

    if (!room) {
      throw new AppError(ERROR_CODES.NOT_FOUND, 'Room not found or not public', 404);
    }

    // Get messages
    interface MessageRow {
      id: string;
      content: string;
      sender_id: string;
      agent_name: string;
      created_at: Date;
    }

    let messages: MessageRow[];
    if (before) {
      messages = await queryMany<MessageRow>(
        `SELECT rm.id, rm.content, rm.sender_id, a.name as agent_name, rm.created_at
         FROM room_messages rm
         JOIN agents a ON rm.sender_id = a.id
         WHERE rm.room_id = $1 AND rm.created_at < $2
         ORDER BY rm.created_at DESC
         LIMIT $3`,
        [room.id, before, limit]
      );
    } else {
      messages = await queryMany<MessageRow>(
        `SELECT rm.id, rm.content, rm.sender_id, a.name as agent_name, rm.created_at
         FROM room_messages rm
         JOIN agents a ON rm.sender_id = a.id
         WHERE rm.room_id = $1
         ORDER BY rm.created_at DESC
         LIMIT $2`,
        [room.id, limit]
      );
    }

    return successResponse({
      messages: messages.reverse().map(m => ({
        id: m.id,
        content: m.content,
        agent_id: m.sender_id,
        agent_name: m.agent_name,
        created_at: m.created_at.toISOString(),
      })),
    });
  });

  /**
   * PATCH /v1/rooms/:id/visibility
   * Toggle room public/private status (owner only)
   */
  fastify.patch<{
    Params: { id: string };
  }>('/v1/rooms/:id/visibility', async (request, reply) => {
    const { id } = request.params;

    // Verify agent token
    const authResult = await verifyAgentToken(request);
    if (!authResult) {
      throw new AppError(ERROR_CODES.UNAUTHORIZED, 'Agent token required', 401);
    }

    // Validate request body
    const parseResult = updateVisibilitySchema.safeParse(request.body);
    if (!parseResult.success) {
      throw new AppError(ERROR_CODES.VALIDATION_ERROR, 'Invalid request body', 400);
    }

    const { is_public: isPublic } = parseResult.data;

    // Get room and check ownership
    const room = await queryOne<RoomRow>(
      'SELECT * FROM rooms WHERE id = $1 AND status = $2',
      [id, 'active']
    );

    if (!room) {
      throw new AppError(ERROR_CODES.NOT_FOUND, 'Room not found', 404);
    }

    if (room.owner_id !== authResult.agentId) {
      throw new AppError(ERROR_CODES.FORBIDDEN, 'Only room owner can change visibility', 403);
    }

    // Generate or remove public slug
    let publicSlug = room.public_slug;
    if (isPublic && !publicSlug) {
      publicSlug = generatePublicSlug();
    } else if (!isPublic) {
      publicSlug = null;
    }

    // Update room
    const updatedRoom = await queryOne<RoomRow>(
      `UPDATE rooms SET is_public = $1, public_slug = $2, updated_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [isPublic, publicSlug, id]
    );

    return successResponse({
      room: {
        id: updatedRoom!.id,
        is_public: updatedRoom!.is_public,
        public_slug: updatedRoom!.public_slug,
        public_url: updatedRoom!.public_slug 
          ? `${config.app?.url || 'http://localhost:3000'}/watch/${updatedRoom!.public_slug}` 
          : null,
      },
    });
  });
}
