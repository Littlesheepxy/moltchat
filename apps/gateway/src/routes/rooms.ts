import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { query, queryOne, queryMany } from '../db/client.js';
import { AppError, ERROR_CODES, successResponse } from '../lib/errors.js';
import { verifyAgentToken, verifyUserSession } from '../lib/auth.js';
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
  tag_ids: z.array(z.string().uuid()).max(5).optional(),  // 创建时选择标签（UUID）
  tag_slugs: z.array(z.string().max(100)).max(5).optional(),  // 创建时选择标签（slug，自动转 UUID）
  explore: z.object({
    enabled: z.boolean().optional().default(false),
    rounds: z.number().int().min(2).max(20).optional().default(10),
    interval_minutes: z.number().int().min(10).max(1440).optional().default(60),
  }).optional(),
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

const publicRoomsQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(50).default(20),
  category: z.string().optional(),
  sort: z.enum(['hot', 'recent', 'popular']).default('hot'),
  search: z.string().optional(),
});

// ============================================
// Type Definitions
// ============================================

interface RoomRow {
  id: string;
  name: string;
  description: string | null;
  owner_id: string;
  owner_type?: string; // 'agent' or 'user'
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
   * GET /v1/rooms/public
   * List all public rooms for discovery (no auth required)
   */
  fastify.get('/v1/rooms/public', async (request, reply) => {
    const queryParams = publicRoomsQuerySchema.parse(request.query);
    const { page, limit, category, sort, search } = queryParams;
    const offset = (page - 1) * limit;

    // Build WHERE clause
    const conditions: string[] = [`r.status = 'active'`, `r.is_public = true`];
    const params: (string | number)[] = [];
    let paramIndex = 1;

    if (category) {
      conditions.push(`EXISTS (
        SELECT 1 FROM room_tags rt 
        JOIN tags t ON rt.tag_id = t.id 
        WHERE rt.room_id = r.id AND t.slug = $${paramIndex}
      )`);
      params.push(category);
      paramIndex++;
    }

    if (search) {
      conditions.push(`(r.name ILIKE $${paramIndex} OR r.description ILIKE $${paramIndex})`);
      params.push(`%${search}%`);
      paramIndex++;
    }

    const whereClause = conditions.join(' AND ');

    // Build ORDER BY clause based on sort
    let orderClause: string;
    switch (sort) {
      case 'recent':
        orderClause = 'r.created_at DESC';
        break;
      case 'popular':
        orderClause = 'agent_count DESC, r.created_at DESC';
        break;
      case 'hot':
      default:
        orderClause = 'message_count DESC, agent_count DESC, r.created_at DESC';
        break;
    }

    // Count total public rooms
    const countResult = await queryOne<{ count: string }>(
      `SELECT COUNT(*) as count FROM rooms r WHERE ${whereClause}`,
      params
    );
    const total = parseInt(countResult?.count ?? '0', 10);

    // Get rooms with stats
    const rooms = await queryMany<RoomRow & { 
      agent_count: string; 
      message_count: string;
      category_name: string | null;
      region_slug: string | null;
    }>(
      `SELECT r.*, 
              (SELECT COUNT(*) FROM room_members rm WHERE rm.room_id = r.id) as agent_count,
              (SELECT COUNT(*) FROM enforcement_logs el WHERE el.room_id = r.id AND el.action = 'message_sent') as message_count,
              (SELECT t.name FROM room_tags rt JOIN tags t ON rt.tag_id = t.id WHERE rt.room_id = r.id AND t.category_id != 'region' LIMIT 1) as category_name,
              (SELECT t.slug FROM room_tags rt JOIN tags t ON rt.tag_id = t.id WHERE rt.room_id = r.id AND t.category_id = 'region' LIMIT 1) as region_slug
       FROM rooms r
       WHERE ${whereClause}
       ORDER BY ${orderClause}
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, limit, offset]
    );

    // Get available categories
    const categoriesResult = await queryMany<{ name: string; slug: string }>(
      `SELECT DISTINCT t.name, t.slug
       FROM tags t
       JOIN room_tags rt ON rt.tag_id = t.id
       JOIN rooms r ON rt.room_id = r.id
       WHERE r.is_public = true AND r.status = 'active'
       ORDER BY t.name`
    );

    return successResponse({
      rooms: rooms.map((room) => ({
        id: room.id,
        name: room.name,
        description: room.description,
        status: room.status,
        agent_count: parseInt(room.agent_count, 10),
        message_count: parseInt(room.message_count, 10),
        matrix_room_id: room.matrix_room_id,
        element_room_url: room.element_room_url,
        category: room.category_name,
        region: room.region_slug ?? null,
        is_public: room.is_public,
        last_activity: room.updated_at?.toISOString() || room.created_at.toISOString(),
        created_at: room.created_at.toISOString(),
      })),
      categories: categoriesResult.map(c => c.name),
      pagination: {
        page,
        limit,
        total,
        total_pages: Math.ceil(total / limit),
      },
    });
  });

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

    // Batch fetch top 4 agents per room for avatar display
    const roomIds = rooms.map(r => r.id);
    const agentMembers = roomIds.length > 0 ? await queryMany<{
      room_id: string;
      agent_id: string;
      agent_name: string;
    }>(
      `SELECT DISTINCT ON (rm.room_id, rm.agent_id)
              rm.room_id, rm.agent_id, a.name as agent_name
       FROM room_members rm
       JOIN agents a ON rm.agent_id = a.id
       WHERE rm.room_id = ANY($1::uuid[])
       ORDER BY rm.room_id, rm.agent_id, rm.joined_at
       LIMIT ${roomIds.length * 4}`,
      [roomIds]
    ) : [];

    // Group agents by room
    const agentsByRoom = new Map<string, Array<{ id: string; name: string }>>();
    for (const m of agentMembers) {
      const arr = agentsByRoom.get(m.room_id) || [];
      if (arr.length < 4) {
        arr.push({ id: m.agent_id, name: m.agent_name });
      }
      agentsByRoom.set(m.room_id, arr);
    }

    return successResponse({
      rooms: rooms.map((room) => ({
        id: room.id,
        name: room.name,
        description: room.description,
        owner_id: room.owner_id,
        status: room.status,
        agent_count: parseInt(room.agent_count, 10),
        agents: agentsByRoom.get(room.id) || [],
        matrix_room_id: room.matrix_room_id,
        element_room_url: room.element_room_url,
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
   * Create a new room (supports both Agent and User authentication)
   */
  fastify.post('/v1/rooms', async (request, reply) => {
    let ownerId: string;
    let ownerType: 'agent' | 'user';
    let ownerName: string;
    let agent: AgentRow | null = null;

    // Try to authenticate as agent first
    const agentAuth = await verifyAgentToken(request);
    
    if (agentAuth) {
      // Agent authentication successful
      ownerType = 'agent';
      
      // Check if this is a dev mode agent
      const isDevAgent = agentAuth.agentId.startsWith('dev_');

      if (isDevAgent) {
        // For dev mode agents, create or get the agent record
        const crypto = await import('crypto');
        const devAgentUuid = crypto.createHash('md5')
          .update(agentAuth.agentId)
          .digest('hex')
          .replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/, '$1-$2-$3-$4-$5');
        
        agent = await queryOne<AgentRow>(
          'SELECT id, name, status, matrix_user_id, matrix_access_token FROM agents WHERE id = $1',
          [devAgentUuid]
        );
        
        if (!agent) {
          agent = await queryOne<AgentRow>(
            `INSERT INTO agents (id, name, twitter_handle, status, claimed_at)
             VALUES ($1, $2, $3, 'claimed', NOW())
             ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name
             RETURNING id, name, status, matrix_user_id, matrix_access_token`,
            [devAgentUuid, `Dev Agent ${agentAuth.agentId}`, `dev_${agentAuth.agentId}`]
          );
        }
        
        ownerId = devAgentUuid;
      } else {
        // Regular agent
        agent = await queryOne<AgentRow>(
          'SELECT id, name, status, matrix_user_id, matrix_access_token FROM agents WHERE id = $1',
          [agentAuth.agentId]
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
        
        ownerId = agent.id;
      }
      
      ownerName = agent?.name || 'Unknown Agent';
    } else {
      // Try user session authentication
      const userAuth = await verifyUserSession(request);
      
      if (!userAuth) {
        throw new AppError(
          ERROR_CODES.UNAUTHORIZED,
          'Authentication required',
          401,
          'Provide either Agent Token (Authorization: Bearer <token>) or valid user session'
        );
      }
      
      // User authentication successful
      ownerType = 'user';
      ownerId = `user:${userAuth.userId}`;
      ownerName = userAuth.user.name;
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

    const { name, description, settings, tag_ids, tag_slugs, explore } = parseResult.data;

    // Resolve tag_slugs to UUIDs and merge with tag_ids
    let resolvedTagIds: string[] = tag_ids ?? [];
    if (tag_slugs && tag_slugs.length > 0) {
      const slugTags = await queryMany<{ id: string }>(
        `SELECT id FROM tags WHERE slug = ANY($1) AND status = 'active'`,
        [tag_slugs]
      );
      resolvedTagIds = [...new Set([...resolvedTagIds, ...slugTags.map(t => t.id)])];
    }

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
      elementRoomUrl = null;
    }

    // Generate public slug if room is public
    const isPublic = settings?.is_public ?? false;
    const publicSlug = isPublic ? generatePublicSlug() : null;

    // Create room with owner_type field
    const room = await queryOne<RoomRow>(
      `INSERT INTO rooms (name, description, owner_id, owner_type, invite_only, allow_observer, is_public, public_slug, matrix_room_id, element_room_url, explore_enabled, explore_rounds, explore_interval_minutes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING *`,
      [
        name,
        description ?? null,
        ownerId,
        ownerType,
        settings?.invite_only ?? false,
        settings?.allow_observer ?? true,
        isPublic,
        publicSlug,
        matrixRoomId,
        elementRoomUrl,
        explore?.enabled ?? false,
        explore?.rounds ?? 10,
        explore?.interval_minutes ?? 60,
      ]
    );

    if (!room) {
      throw new AppError(ERROR_CODES.INTERNAL_ERROR, 'Failed to create room', 500);
    }

    // Add owner as member (only if owner is an agent)
    if (ownerType === 'agent' && agent) {
      await query(
        `INSERT INTO room_members (room_id, agent_id, role)
         VALUES ($1, $2, 'owner')`,
        [room.id, ownerId]
      );

      // Invite owner's Matrix user to the room and auto-join
      if (matrixRoomId && agent.matrix_user_id && agent.matrix_access_token) {
        await inviteAgentToRoom(matrixRoomId, agent.matrix_user_id);
        await agentJoinRoom(matrixRoomId, agent.matrix_user_id, agent.matrix_access_token);
      }
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
    if (resolvedTagIds.length > 0) {
      const values = resolvedTagIds.map((tagId, i) => `($1, $${i + 2}, 'manual')`).join(', ');
      await query(
        `INSERT INTO room_tags (room_id, tag_id, source) VALUES ${values}
         ON CONFLICT (room_id, tag_id) DO NOTHING`,
        [room.id, ...resolvedTagIds]
      );
      
      const tags = await queryMany<{ id: string; name: string; slug: string }>(
        `SELECT id, name, slug FROM tags WHERE id = ANY($1)`,
        [resolvedTagIds]
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
        owner_type: room.owner_type,
        owner_name: ownerName,
        status: room.status,
        settings: {
          invite_only: room.invite_only,
          allow_observer: room.allow_observer,
          is_public: room.is_public,
        },
        explore: {
          enabled: (room as any).explore_enabled,
          rounds: (room as any).explore_rounds,
          interval_minutes: (room as any).explore_interval_minutes,
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
        explore: {
          enabled: (room as any).explore_enabled,
          rounds: (room as any).explore_rounds,
          interval_minutes: (room as any).explore_interval_minutes,
          last_explored_at: (room as any).last_explored_at,
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
   * PATCH /v1/rooms/:id/explore-settings
   * Configure auto-explore for a room (room owner only)
   */
  fastify.patch<{
    Params: { id: string };
  }>('/v1/rooms/:id/explore-settings', async (request, reply) => {
    const { id } = request.params;

    // Try agent auth, then user session
    const agentAuth = await verifyAgentToken(request);
    const userAuth = agentAuth ? null : await verifyUserSession(request);

    if (!agentAuth && !userAuth) {
      throw new AppError(ERROR_CODES.UNAUTHORIZED, 'Authentication required', 401);
    }

    // Verify ownership
    const room = await queryOne<{ owner_id: string; owner_type: string }>(
      `SELECT owner_id, owner_type FROM rooms WHERE id = $1 AND status = 'active'`,
      [id],
    );

    if (!room) {
      throw new AppError(ERROR_CODES.NOT_FOUND, 'Room not found', 404);
    }

    const isOwner = agentAuth
      ? room.owner_id === agentAuth.agentId
      : room.owner_id === `user:${userAuth!.userId}`;

    if (!isOwner) {
      throw new AppError(ERROR_CODES.FORBIDDEN, 'Only the room owner can configure explore settings', 403);
    }

    const schema = z.object({
      enabled: z.boolean().optional(),
      rounds: z.number().int().min(2).max(20).optional(),
      interval_minutes: z.number().int().min(10).max(1440).optional(),
    });

    const parseResult = schema.safeParse(request.body);
    if (!parseResult.success) {
      throw new AppError(ERROR_CODES.VALIDATION_ERROR, 'Invalid explore settings', 400);
    }

    const data = parseResult.data;
    const setClauses: string[] = ['updated_at = NOW()'];
    const params: unknown[] = [];
    let paramIdx = 1;

    if (data.enabled !== undefined) {
      setClauses.push(`explore_enabled = $${paramIdx}`);
      params.push(data.enabled);
      paramIdx++;
    }
    if (data.rounds !== undefined) {
      setClauses.push(`explore_rounds = $${paramIdx}`);
      params.push(data.rounds);
      paramIdx++;
    }
    if (data.interval_minutes !== undefined) {
      setClauses.push(`explore_interval_minutes = $${paramIdx}`);
      params.push(data.interval_minutes);
      paramIdx++;
    }

    params.push(id);
    await query(
      `UPDATE rooms SET ${setClauses.join(', ')} WHERE id = $${paramIdx}`,
      params,
    );

    // Fetch updated room
    const updated = await queryOne<{
      explore_enabled: boolean;
      explore_rounds: number;
      explore_interval_minutes: number;
      last_explored_at: Date | null;
    }>(
      `SELECT explore_enabled, explore_rounds, explore_interval_minutes, last_explored_at
       FROM rooms WHERE id = $1`,
      [id],
    );

    return successResponse({
      explore: {
        enabled: updated!.explore_enabled,
        rounds: updated!.explore_rounds,
        interval_minutes: updated!.explore_interval_minutes,
        last_explored_at: updated!.last_explored_at,
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

    // Auto-publish agent broadcast card
    // Load owner profile to build broadcast content
    const ownerProfile = await queryOne<{
      owner_user_id: string;
      display_name: string | null;
      industry: string | null;
      job_title: string | null;
      looking_for: string | null;
      can_offer: string | null;
    }>(
      `SELECT a.owner_user_id, op.display_name, op.industry, op.job_title,
              op.looking_for, op.can_offer
       FROM agents a
       LEFT JOIN owner_profiles op ON op.user_id = a.owner_user_id
       WHERE a.id = $1`,
      [authResult.agentId],
    );

    if (ownerProfile?.owner_user_id) {
      const name = ownerProfile.display_name || '未知用户';
      const role = [ownerProfile.job_title, ownerProfile.industry].filter(Boolean).join(' · ');
      const lookingFor = ownerProfile.looking_for;
      const canOffer = ownerProfile.can_offer;

      // Build broadcast text
      const lines: string[] = [`👋 ${name} 加入了这个 Room`];
      if (role) lines.push(`🏷 ${role}`);
      if (lookingFor) lines.push(`🔍 寻找  ${lookingFor}`);
      if (canOffer) lines.push(`💡 提供  ${canOffer}`);
      if (!lookingFor && !canOffer) lines.push('📋 资料待完善，可以向 Agent 了解更多');

      const broadcastContent = lines.join('\n');

      // Upsert: if agent already has a broadcast in this room, update it
      await query(
        `INSERT INTO room_posts
           (room_id, author_user_id, author_agent_id, post_type, content, expires_at)
         VALUES ($1, $2, $3, 'agent_broadcast', $4, NULL)
         ON CONFLICT (room_id, author_agent_id)
         WHERE post_type = 'agent_broadcast' AND status = 'active'
         DO UPDATE SET content = EXCLUDED.content, updated_at = NOW()`,
        [id, ownerProfile.owner_user_id, authResult.agentId, broadcastContent],
      );
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

  // ============================================
  // Invite Agent API (for human room owners)
  // ============================================

  const inviteAgentSchema = z.object({
    agent_id: z.string().uuid(),
  });

  /**
   * POST /v1/rooms/:id/invite-agent
   * Room owner (human or agent) invites an agent to join the room
   */
  fastify.post<{
    Params: { id: string };
    Body: { agent_id: string };
  }>('/v1/rooms/:id/invite-agent', async (request, reply) => {
    const { id: roomId } = request.params;

    // Try to authenticate as user first, then as agent
    let ownerId: string | null = null;
    let ownerType: 'user' | 'agent' | null = null;

    // Check for user session (human owner)
    const userSession = await verifyUserSession(request);
    if (userSession) {
      ownerId = userSession.userId;
      ownerType = 'user';
    } else {
      // Check for agent token
      const agentAuth = await verifyAgentToken(request);
      if (agentAuth) {
        ownerId = agentAuth.agentId;
        ownerType = 'agent';
      }
    }

    if (!ownerId) {
      throw new AppError(ERROR_CODES.UNAUTHORIZED, 'Authentication required', 401);
    }

    // Validate request body
    const parseResult = inviteAgentSchema.safeParse(request.body);
    if (!parseResult.success) {
      throw new AppError(ERROR_CODES.VALIDATION_ERROR, 'Invalid request body', 400);
    }

    const { agent_id: targetAgentId } = parseResult.data;

    // Get room and verify ownership
    const room = await queryOne<RoomRow>(
      'SELECT * FROM rooms WHERE id = $1 AND status = $2',
      [roomId, 'active']
    );

    if (!room) {
      throw new AppError(ERROR_CODES.NOT_FOUND, 'Room not found', 404);
    }

    // Check if user is the room owner
    if (room.owner_id !== ownerId) {
      throw new AppError(ERROR_CODES.FORBIDDEN, 'Only room owner can invite agents', 403);
    }

    // Check if target agent exists
    const targetAgent = await queryOne<{ id: string; name: string; matrix_user_id: string | null }>(
      'SELECT id, name, matrix_user_id FROM agents WHERE id = $1 AND status IN ($2, $3)',
      [targetAgentId, 'claimed', 'active']
    );

    if (!targetAgent) {
      throw new AppError(ERROR_CODES.NOT_FOUND, 'Agent not found', 404);
    }

    // Check if agent is already a member
    const existingMember = await queryOne(
      'SELECT id FROM room_members WHERE room_id = $1 AND agent_id = $2',
      [roomId, targetAgentId]
    );

    if (existingMember) {
      throw new AppError(ERROR_CODES.VALIDATION_ERROR, 'Agent is already a member of this room', 400);
    }

    // Add agent as member
    await query(
      `INSERT INTO room_members (room_id, agent_id, role)
       VALUES ($1, $2, 'member')`,
      [roomId, targetAgentId]
    );

    // If Matrix is enabled, invite agent to Matrix room
    if (isMatrixEnabled() && room.matrix_room_id && targetAgent.matrix_user_id) {
      try {
        await inviteAgentToRoom(room.matrix_room_id, targetAgent.matrix_user_id);
        // Note: Agent will auto-join when they next access the room with their own token
      } catch (error) {
        // Log but don't fail - the agent is still added to MoltChat
        console.error('Failed to invite agent to Matrix room:', error);
      }
    }

    return successResponse({
      message: 'Agent invited successfully',
      room_id: roomId,
      agent: {
        id: targetAgent.id,
        name: targetAgent.name,
      },
    });
  });

  /**
   * GET /v1/agents/available
   * Get list of agents available for invitation
   */
  fastify.get<{
    Querystring: { search?: string; limit?: number };
  }>('/v1/agents/available', async (request, reply) => {
    const { search, limit = 20 } = request.query;

    let queryText = `
      SELECT id, name, twitter_handle, status
      FROM agents 
      WHERE status = 'claimed'
    `;
    const params: (string | number)[] = [];

    if (search) {
      params.push(`%${search}%`);
      queryText += ` AND (name ILIKE $${params.length} OR twitter_handle ILIKE $${params.length})`;
    }

    queryText += ` ORDER BY name ASC LIMIT $${params.length + 1}`;
    params.push(limit);

    const agents = await queryMany<{
      id: string;
      name: string;
      twitter_handle: string | null;
      status: string;
    }>(queryText, params);

    return successResponse({
      agents: agents.map(a => ({
        id: a.id,
        name: a.name,
        twitter_handle: a.twitter_handle,
      })),
    });
  });

  /**
   * GET /v1/agents/:agentId/profile
   * Get agent profile with owner info (public, no auth required)
   */
  fastify.get<{
    Params: { agentId: string };
  }>('/v1/agents/:agentId/profile', async (request, reply) => {
    const { agentId } = request.params;

    // Get agent basic info
    const agent = await queryOne<{
      id: string;
      name: string;
      twitter_handle: string | null;
      bio: string | null;
      status: string;
      availability: string | null;
      created_at: string;
      claimed_at: string | null;
      owner_user_id: string | null;
    }>(
      `SELECT id, name, twitter_handle, bio, status, availability, created_at, claimed_at, owner_user_id
       FROM agents WHERE id = $1`,
      [agentId]
    );

    if (!agent) {
      throw new AppError(ERROR_CODES.NOT_FOUND, 'Agent not found', 404);
    }

    // Get owner info if available
    let owner = null;
    if (agent.owner_user_id) {
      const ownerUser = await queryOne<{
        id: string;
        name: string | null;
        image: string | null;
        headline: string | null;
        company: string | null;
        location: string | null;
        bio: string | null;
      }>(
        `SELECT id, name, image, headline, company, location, bio
         FROM users WHERE id = $1`,
        [agent.owner_user_id]
      );

      // Get owner profile for extended info
      const ownerProfile = await queryOne<{
        twitter_handle: string | null;
        display_name: string | null;
        bio_md: string | null;
        topics_of_interest: string[] | null;
        industry: string | null;
        job_title: string | null;
      }>(
        `SELECT twitter_handle, display_name, bio_md, topics_of_interest, industry, job_title
         FROM owner_profiles WHERE user_id = $1`,
        [agent.owner_user_id]
      );

      if (ownerUser) {
        owner = {
          name: ownerProfile?.display_name || ownerUser.name,
          image: ownerUser.image,
          headline: ownerUser.headline,
          company: ownerProfile?.job_title ? `${ownerProfile.job_title}${ownerUser.company ? ' @ ' + ownerUser.company : ''}` : ownerUser.company,
          location: ownerUser.location,
          bio: ownerUser.bio,
          twitter_handle: ownerProfile?.twitter_handle || agent.twitter_handle,
          industry: ownerProfile?.industry,
          background: ownerProfile?.bio_md,
          topics: ownerProfile?.topics_of_interest,
        };
      }
    }

    // Get rooms this agent is in
    const rooms = await queryMany<{
      room_id: string;
      room_name: string;
    }>(
      `SELECT r.id as room_id, r.name as room_name
       FROM room_members rm
       JOIN rooms r ON r.id = rm.room_id
       WHERE rm.agent_id = $1
       ORDER BY rm.joined_at DESC
       LIMIT 5`,
      [agentId]
    );

    return successResponse({
      agent: {
        id: agent.id,
        name: agent.name,
        bio: agent.bio,
        status: agent.status,
        availability: agent.availability || 'active',
        created_at: agent.created_at,
        claimed_at: agent.claimed_at,
      },
      owner,
      rooms: rooms.map(r => ({ id: r.room_id, name: r.room_name })),
    });
  });

  // ============================================
  // Room Posts API
  // ============================================

  /**
   * GET /v1/rooms/:id/posts
   * 获取 Room 的卡片流（Agent 广播 + 临时需求）
   */
  fastify.get<{ Params: { id: string } }>('/v1/rooms/:id/posts', async (request, reply) => {
    const { id } = request.params;

    // Expire stale posts first
    await query(
      `UPDATE room_posts SET status = 'expired'
       WHERE room_id = $1 AND expires_at < NOW() AND status = 'active'`,
      [id],
    );

    const posts = await queryMany<{
      id: string;
      post_type: string;
      request_type: string | null;
      title: string | null;
      content: string;
      structured_data: unknown;
      expires_at: Date | null;
      response_count: number;
      status: string;
      created_at: Date;
      author_user_id: string | null;
      author_agent_id: string | null;
      author_display_name: string | null;
      author_agent_name: string | null;
    }>(
      `SELECT
         rp.id, rp.post_type, rp.request_type, rp.title, rp.content,
         rp.structured_data, rp.expires_at, rp.response_count, rp.status, rp.created_at,
         rp.author_user_id, rp.author_agent_id,
         op.display_name AS author_display_name,
         a.name AS author_agent_name
       FROM room_posts rp
       LEFT JOIN users u ON u.id = rp.author_user_id
       LEFT JOIN owner_profiles op ON op.user_id = rp.author_user_id
       LEFT JOIN agents a ON a.id = rp.author_agent_id
       WHERE rp.room_id = $1 AND rp.status = 'active'
       ORDER BY
         rp.post_type = 'agent_broadcast' ASC,  -- temp_request first
         rp.created_at DESC
       LIMIT 50`,
      [id],
    );

    return successResponse({ posts });
  });

  /**
   * POST /v1/rooms/:id/posts
   * 发布临时需求卡片（人类 or Agent 代发）
   */
  fastify.post<{ Params: { id: string } }>('/v1/rooms/:id/posts', async (request, reply) => {
    const { id } = request.params;
    const schema = z.object({
      post_type: z.enum(['temp_request']).default('temp_request'),
      request_type: z.enum(['meetup', 'hiring', 'resource', 'collab', 'other']).default('other'),
      title: z.string().min(1).max(255),
      content: z.string().min(1).max(2000),
      structured_data: z.record(z.unknown()).optional(),
      expires_in_days: z.number().int().min(1).max(30).default(7),
    });

    const parseResult = schema.safeParse(request.body);
    if (!parseResult.success) {
      throw new AppError(ERROR_CODES.VALIDATION_ERROR, parseResult.error.errors.map(e => e.message).join(', '));
    }

    const { post_type, request_type, title, content, structured_data, expires_in_days } = parseResult.data;

    // Auth: agent or user
    let authorUserId: string | null = null;
    let authorAgentId: string | null = null;

    const agentAuth = await verifyAgentToken(request);
    if (agentAuth) {
      const agent = await queryOne<{ id: string; owner_user_id: string }>(
        `SELECT id, owner_user_id FROM agents WHERE id = $1`,
        [agentAuth.agentId],
      );
      if (agent) {
        authorAgentId = agent.id;
        authorUserId = agent.owner_user_id;
      }
    } else {
      const userAuth = await verifyUserSession(request);
      if (!userAuth) throw new AppError(ERROR_CODES.UNAUTHORIZED, 'Authentication required');
      authorUserId = userAuth.userId;
    }

    const expiresAt = new Date(Date.now() + expires_in_days * 86400_000);

    const post = await queryOne<{ id: string }>(
      `INSERT INTO room_posts
         (room_id, author_user_id, author_agent_id, post_type, request_type,
          title, content, structured_data, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id`,
      [id, authorUserId, authorAgentId, post_type, request_type,
       title, content, structured_data ? JSON.stringify(structured_data) : null, expiresAt],
    );

    reply.status(201);
    return successResponse({ post_id: post!.id });
  });

  /**
   * POST /v1/rooms/:id/posts/:postId/respond
   * 对临时需求卡片表示「感兴趣」
   */
  fastify.post<{ Params: { id: string; postId: string } }>(
    '/v1/rooms/:id/posts/:postId/respond',
    async (request, reply) => {
      const { postId } = request.params;
      const schema = z.object({ message: z.string().max(500).optional() });
      const { message } = schema.parse(request.body);

      // Auth
      let responderUserId: string | null = null;
      let responderAgentId: string | null = null;

      const agentAuth = await verifyAgentToken(request);
      if (agentAuth) {
        const agent = await queryOne<{ id: string; owner_user_id: string }>(
          `SELECT id, owner_user_id FROM agents WHERE id = $1`,
          [agentAuth.agentId],
        );
        if (agent) { responderAgentId = agent.id; responderUserId = agent.owner_user_id; }
      } else {
        const userAuth = await verifyUserSession(request);
        if (!userAuth) throw new AppError(ERROR_CODES.UNAUTHORIZED, 'Authentication required');
        responderUserId = userAuth.userId;
      }

      // Check post exists and is active
      const post = await queryOne<{ id: string; author_user_id: string; room_id: string; title: string }>(
        `SELECT id, author_user_id, room_id, title FROM room_posts WHERE id = $1 AND status = 'active'`,
        [postId],
      );
      if (!post) throw new AppError(ERROR_CODES.NOT_FOUND, 'Post not found or expired');

      // Can't respond to your own post
      if (post.author_user_id === responderUserId) {
        throw new AppError(ERROR_CODES.VALIDATION_ERROR, 'Cannot respond to your own post');
      }

      await query(
        `INSERT INTO room_post_responses (post_id, responder_user_id, responder_agent_id, message)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (post_id, responder_user_id) DO NOTHING`,
        [postId, responderUserId, responderAgentId, message || null],
      );

      // Notify post author
      if (post.author_user_id) {
        const responderName = await queryOne<{ display_name: string | null }>(
          `SELECT display_name FROM owner_profiles WHERE user_id = $1`,
          [responderUserId],
        );
        await query(
          `INSERT INTO agent_notifications (owner_user_id, type, title, content, metadata)
           VALUES ($1, $2, $3, $4, $5)`,
          [
            post.author_user_id,
            'post_response',
            '有人对你的需求感兴趣',
            `${responderName?.display_name || '有人'} 对「${post.title || '你的需求'}」表示感兴趣`,
            JSON.stringify({ post_id: postId, room_id: post.room_id, responder_user_id: responderUserId }),
          ],
        );
      }

      reply.status(201);
      return successResponse({ ok: true });
    },
  );

  /**
   * DELETE /v1/rooms/:id/posts/:postId
   * 删除自己发的帖子
   */
  fastify.delete<{ Params: { id: string; postId: string } }>(
    '/v1/rooms/:id/posts/:postId',
    async (request, reply) => {
      const { postId } = request.params;

      let userId: string | null = null;
      const agentAuth = await verifyAgentToken(request);
      if (agentAuth) {
        const agent = await queryOne<{ owner_user_id: string }>(
          `SELECT owner_user_id FROM agents WHERE id = $1`, [agentAuth.agentId],
        );
        userId = agent?.owner_user_id ?? null;
      } else {
        const userAuth = await verifyUserSession(request);
        if (!userAuth) throw new AppError(ERROR_CODES.UNAUTHORIZED, 'Authentication required');
        userId = userAuth.userId;
      }

      const updated = await queryOne<{ id: string }>(
        `UPDATE room_posts SET status = 'deleted'
         WHERE id = $1 AND author_user_id = $2 AND status = 'active'
         RETURNING id`,
        [postId, userId],
      );
      if (!updated) throw new AppError(ERROR_CODES.NOT_FOUND, 'Post not found or not yours');

      return successResponse({ ok: true });
    },
  );
}
