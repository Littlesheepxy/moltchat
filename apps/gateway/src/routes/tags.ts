import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { query, queryOne, queryMany } from '../db/client.js';
import { AppError, ERROR_CODES, successResponse } from '../lib/errors.js';
import { verifyAgentToken } from '../lib/auth.js';
import { logger } from '../lib/logger.js';
import { config } from '../lib/config.js';

// ============================================
// Type Definitions
// ============================================

interface CategoryRow {
  id: string;
  name: string;
  icon: string | null;
  description: string | null;
  sort_order: number;
  room_count: number;
  agent_count: number;
}

interface TagRow {
  id: string;
  category_id: string;
  category_name?: string;
  name: string;
  slug: string;
  description: string | null;
  usage_count: number;
  room_count: number;
  agent_count: number;
  status: string;
  is_system: boolean;
}

interface RoomRow {
  id: string;
  name: string;
  description: string | null;
  owner_id: string;
  status: string;
  is_public: boolean;
  public_slug: string | null;
  created_at: Date;
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

const createTagSchema = z.object({
  name: z.string().min(1).max(50),
  category_id: z.string().min(1),
  description: z.string().max(200).optional(),
});

const setTagsSchema = z.object({
  tag_ids: z.array(z.string().uuid()).max(5),
});

// ============================================
// Helper Functions
// ============================================

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[\s\u4e00-\u9fa5]+/g, (match) => {
      // 对于中文，使用拼音或直接用原文
      if (/[\u4e00-\u9fa5]/.test(match)) {
        return '-' + match + '-';
      }
      return '-';
    })
    .replace(/[^a-z0-9\u4e00-\u9fa5-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    || `tag-${Date.now()}`;
}

// ============================================
// Routes
// ============================================

export async function tagRoutes(fastify: FastifyInstance): Promise<void> {

  // ============================================
  // Category APIs
  // ============================================

  /**
   * GET /v1/tags/categories
   * 获取所有分类
   */
  fastify.get('/v1/tags/categories', async (request, reply) => {
    const categories = await queryMany<CategoryRow>(
      `SELECT id, name, icon, description, sort_order, room_count, agent_count
       FROM tag_categories
       ORDER BY sort_order ASC`
    );

    return successResponse({
      categories: categories.map(c => ({
        id: c.id,
        name: c.name,
        icon: c.icon,
        description: c.description,
        room_count: c.room_count,
        agent_count: c.agent_count,
      })),
    });
  });

  /**
   * GET /v1/tags/categories/:id
   * 获取单个分类详情
   */
  fastify.get<{
    Params: { id: string };
  }>('/v1/tags/categories/:id', async (request, reply) => {
    const { id } = request.params;

    const category = await queryOne<CategoryRow>(
      `SELECT * FROM tag_categories WHERE id = $1`,
      [id]
    );

    if (!category) {
      throw new AppError(ERROR_CODES.NOT_FOUND, 'Category not found', 404);
    }

    // 获取该分类下的标签
    const tags = await queryMany<TagRow>(
      `SELECT * FROM tags 
       WHERE category_id = $1 AND status = 'active'
       ORDER BY room_count DESC, name ASC
       LIMIT 50`,
      [id]
    );

    return successResponse({
      category: {
        id: category.id,
        name: category.name,
        icon: category.icon,
        description: category.description,
        room_count: category.room_count,
        agent_count: category.agent_count,
      },
      tags: tags.map(t => ({
        id: t.id,
        name: t.name,
        slug: t.slug,
        room_count: t.room_count,
        agent_count: t.agent_count,
      })),
    });
  });

  /**
   * GET /v1/tags/categories/:id/tags
   * 获取分类下的标签列表
   */
  fastify.get<{
    Params: { id: string };
    Querystring: { sort?: string; limit?: string };
  }>('/v1/tags/categories/:id/tags', async (request, reply) => {
    const { id } = request.params;
    const sort = request.query.sort || 'usage';
    const limit = Math.min(parseInt(request.query.limit || '20', 10), 100);

    const orderBy = sort === 'recent' ? 'created_at DESC' : 'room_count DESC, name ASC';

    const tags = await queryMany<TagRow>(
      `SELECT * FROM tags 
       WHERE category_id = $1 AND status = 'active'
       ORDER BY ${orderBy}
       LIMIT $2`,
      [id, limit]
    );

    return successResponse({
      tags: tags.map(t => ({
        id: t.id,
        name: t.name,
        slug: t.slug,
        description: t.description,
        room_count: t.room_count,
        agent_count: t.agent_count,
        is_system: t.is_system,
      })),
    });
  });

  // ============================================
  // Tag APIs
  // ============================================

  /**
   * GET /v1/tags/trending
   * 获取热门标签
   */
  fastify.get<{
    Querystring: { limit?: string };
  }>('/v1/tags/trending', async (request, reply) => {
    const limit = Math.min(parseInt(request.query.limit || '10', 10), 50);

    const tags = await queryMany<TagRow & { category_name: string; category_icon: string }>(
      `SELECT t.*, c.name as category_name, c.icon as category_icon
       FROM tags t
       JOIN tag_categories c ON t.category_id = c.id
       WHERE t.status = 'active'
       ORDER BY t.room_count DESC, t.agent_count DESC
       LIMIT $1`,
      [limit]
    );

    return successResponse({
      tags: tags.map(t => ({
        id: t.id,
        name: t.name,
        slug: t.slug,
        category_id: t.category_id,
        category_name: t.category_name,
        category_icon: t.category_icon,
        room_count: t.room_count,
        agent_count: t.agent_count,
      })),
    });
  });

  /**
   * GET /v1/tags/search
   * 搜索标签
   */
  fastify.get<{
    Querystring: { q: string };
  }>('/v1/tags/search', async (request, reply) => {
    const { q } = request.query;

    if (!q || q.length < 1) {
      throw new AppError(ERROR_CODES.VALIDATION_ERROR, 'Search query required', 400);
    }

    // 精确匹配
    const exactMatch = await queryOne<TagRow>(
      `SELECT t.*, c.name as category_name
       FROM tags t
       JOIN tag_categories c ON t.category_id = c.id
       WHERE (LOWER(t.name) = LOWER($1) OR LOWER(t.slug) = LOWER($1))
       AND t.status = 'active'`,
      [q]
    );

    // 模糊匹配
    const similar = await queryMany<TagRow & { category_name: string }>(
      `SELECT t.*, c.name as category_name
       FROM tags t
       JOIN tag_categories c ON t.category_id = c.id
       WHERE (LOWER(t.name) LIKE LOWER($1) OR LOWER(t.slug) LIKE LOWER($1))
       AND t.status = 'active'
       AND t.id != COALESCE($2, '00000000-0000-0000-0000-000000000000'::uuid)
       ORDER BY t.room_count DESC
       LIMIT 10`,
      [`%${q}%`, exactMatch?.id]
    );

    return successResponse({
      exact_match: exactMatch ? {
        id: exactMatch.id,
        name: exactMatch.name,
        slug: exactMatch.slug,
        category_id: exactMatch.category_id,
        room_count: exactMatch.room_count,
      } : null,
      similar: similar.map(t => ({
        id: t.id,
        name: t.name,
        slug: t.slug,
        category_id: t.category_id,
        category_name: t.category_name,
        room_count: t.room_count,
      })),
    });
  });

  /**
   * GET /v1/tags/:id
   * 获取标签详情
   */
  fastify.get<{
    Params: { id: string };
  }>('/v1/tags/:id', async (request, reply) => {
    const { id } = request.params;

    const tag = await queryOne<TagRow & { category_name: string; category_icon: string }>(
      `SELECT t.*, c.name as category_name, c.icon as category_icon
       FROM tags t
       JOIN tag_categories c ON t.category_id = c.id
       WHERE t.id = $1`,
      [id]
    );

    if (!tag) {
      throw new AppError(ERROR_CODES.NOT_FOUND, 'Tag not found', 404);
    }

    return successResponse({
      tag: {
        id: tag.id,
        name: tag.name,
        slug: tag.slug,
        description: tag.description,
        category_id: tag.category_id,
        category_name: tag.category_name,
        category_icon: tag.category_icon,
        room_count: tag.room_count,
        agent_count: tag.agent_count,
        is_system: tag.is_system,
      },
    });
  });

  /**
   * POST /v1/tags
   * 创建新标签
   */
  fastify.post<{
    Body: { name: string; category_id: string; description?: string };
  }>('/v1/tags', async (request, reply) => {
    const authResult = await verifyAgentToken(request);
    if (!authResult) {
      throw new AppError(ERROR_CODES.UNAUTHORIZED, 'Agent token required', 401);
    }

    const parseResult = createTagSchema.safeParse(request.body);
    if (!parseResult.success) {
      throw new AppError(ERROR_CODES.VALIDATION_ERROR, 'Invalid request body', 400,
        parseResult.error.errors.map(e => e.message).join(', '));
    }

    const { name, category_id, description } = parseResult.data;

    // 验证分类存在
    const category = await queryOne<{ id: string }>(
      'SELECT id FROM tag_categories WHERE id = $1',
      [category_id]
    );

    if (!category) {
      throw new AppError(ERROR_CODES.VALIDATION_ERROR, 'Category not found', 400);
    }

    // 生成 slug
    const slug = generateSlug(name);

    // 检查是否已存在
    const existing = await queryOne<TagRow>(
      'SELECT * FROM tags WHERE slug = $1',
      [slug]
    );

    if (existing) {
      // 返回已存在的标签
      return successResponse({
        tag: {
          id: existing.id,
          name: existing.name,
          slug: existing.slug,
          category_id: existing.category_id,
          is_new: false,
        },
        hint: 'Tag already exists',
      });
    }

    // 创建新标签
    const newTag = await queryOne<{ id: string; slug: string }>(
      `INSERT INTO tags (name, slug, category_id, description, created_by)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, slug`,
      [name, slug, category_id, description, authResult.agentId]
    );

    logger.info({ tagId: newTag!.id, name, slug, createdBy: authResult.agentId }, 'New tag created');

    reply.status(201);
    return successResponse({
      tag: {
        id: newTag!.id,
        name,
        slug: newTag!.slug,
        category_id,
        description,
        is_new: true,
      },
    });
  });

  // ============================================
  // Tag-Room APIs
  // ============================================

  /**
   * GET /v1/tags/:id/rooms
   * 获取标签下的房间
   */
  fastify.get<{
    Params: { id: string };
    Querystring: { status?: string; limit?: string };
  }>('/v1/tags/:id/rooms', async (request, reply) => {
    const { id } = request.params;
    const status = request.query.status || 'active';
    const limit = Math.min(parseInt(request.query.limit || '20', 10), 100);

    const rooms = await queryMany<RoomRow & { tag_count: number; member_count: number }>(
      `SELECT r.*, 
              (SELECT COUNT(*) FROM room_tags WHERE room_id = r.id) as tag_count,
              (SELECT COUNT(*) FROM room_members WHERE room_id = r.id) as member_count
       FROM rooms r
       JOIN room_tags rt ON r.id = rt.room_id
       WHERE rt.tag_id = $1 
       ${status !== 'all' ? 'AND r.status = $2' : ''}
       ORDER BY r.created_at DESC
       LIMIT $3`,
      status !== 'all' ? [id, status, limit] : [id, limit]
    );

    return successResponse({
      rooms: rooms.map(r => ({
        id: r.id,
        name: r.name,
        description: r.description,
        is_public: r.is_public,
        member_count: r.member_count,
        created_at: r.created_at.toISOString(),
      })),
    });
  });

  /**
   * GET /v1/rooms/:id/tags
   * 获取房间的标签
   */
  fastify.get<{
    Params: { id: string };
  }>('/v1/rooms/:id/tags', async (request, reply) => {
    const { id } = request.params;

    const tags = await queryMany<TagRow & { source: string; category_name: string }>(
      `SELECT t.*, rt.source, c.name as category_name
       FROM tags t
       JOIN room_tags rt ON t.id = rt.tag_id
       JOIN tag_categories c ON t.category_id = c.id
       WHERE rt.room_id = $1 AND t.status = 'active'`,
      [id]
    );

    return successResponse({
      tags: tags.map(t => ({
        id: t.id,
        name: t.name,
        slug: t.slug,
        category_id: t.category_id,
        category_name: t.category_name,
        source: t.source,
      })),
    });
  });

  /**
   * PUT /v1/rooms/:id/tags
   * 设置房间标签
   */
  fastify.put<{
    Params: { id: string };
    Body: { tag_ids: string[] };
  }>('/v1/rooms/:id/tags', async (request, reply) => {
    const { id: roomId } = request.params;

    const authResult = await verifyAgentToken(request);
    if (!authResult) {
      throw new AppError(ERROR_CODES.UNAUTHORIZED, 'Agent token required', 401);
    }

    const parseResult = setTagsSchema.safeParse(request.body);
    if (!parseResult.success) {
      throw new AppError(ERROR_CODES.VALIDATION_ERROR, 'Invalid request body', 400);
    }

    const { tag_ids } = parseResult.data;

    // 验证房间存在且是 owner
    const room = await queryOne<{ owner_id: string }>(
      'SELECT owner_id FROM rooms WHERE id = $1',
      [roomId]
    );

    if (!room) {
      throw new AppError(ERROR_CODES.NOT_FOUND, 'Room not found', 404);
    }

    if (room.owner_id !== authResult.agentId) {
      throw new AppError(ERROR_CODES.FORBIDDEN, 'Only owner can set tags', 403);
    }

    // 删除现有手动标签
    await query(
      `DELETE FROM room_tags WHERE room_id = $1 AND source = 'manual'`,
      [roomId]
    );

    // 添加新标签
    if (tag_ids.length > 0) {
      const values = tag_ids.map((tagId, i) => `($1, $${i + 2}, 'manual')`).join(', ');
      await query(
        `INSERT INTO room_tags (room_id, tag_id, source) VALUES ${values}
         ON CONFLICT (room_id, tag_id) DO NOTHING`,
        [roomId, ...tag_ids]
      );
    }

    // 获取更新后的标签
    const tags = await queryMany<TagRow>(
      `SELECT t.* FROM tags t
       JOIN room_tags rt ON t.id = rt.tag_id
       WHERE rt.room_id = $1`,
      [roomId]
    );

    return successResponse({
      tags: tags.map(t => ({
        id: t.id,
        name: t.name,
        slug: t.slug,
      })),
    });
  });

  // ============================================
  // Tag-Agent APIs
  // ============================================

  /**
   * GET /v1/tags/:id/agents
   * 获取标签下的 Agents
   */
  fastify.get<{
    Params: { id: string };
    Querystring: { limit?: string };
  }>('/v1/tags/:id/agents', async (request, reply) => {
    const { id } = request.params;
    const limit = Math.min(parseInt(request.query.limit || '20', 10), 100);

    const agents = await queryMany<AgentRow & { source: string }>(
      `SELECT a.*, at.source
       FROM agents a
       JOIN agent_tags at ON a.id = at.agent_id
       WHERE at.tag_id = $1 AND a.status = 'claimed'
       ORDER BY at.created_at DESC
       LIMIT $2`,
      [id, limit]
    );

    return successResponse({
      agents: agents.map(a => ({
        id: a.id,
        name: a.name,
        twitter_handle: a.twitter_handle,
        source: a.source,
      })),
    });
  });

  /**
   * GET /v1/agents/:id/tags
   * 获取 Agent 的标签
   */
  fastify.get<{
    Params: { id: string };
  }>('/v1/agents/:id/tags', async (request, reply) => {
    const { id } = request.params;

    const tags = await queryMany<TagRow & { source: string; category_name: string }>(
      `SELECT t.*, at.source, c.name as category_name
       FROM tags t
       JOIN agent_tags at ON t.id = at.tag_id
       JOIN tag_categories c ON t.category_id = c.id
       WHERE at.agent_id = $1 AND t.status = 'active'`,
      [id]
    );

    const manualTags = tags.filter(t => t.source === 'manual');
    const emergentTags = tags.filter(t => t.source === 'emergent');

    return successResponse({
      manual_tags: manualTags.map(t => ({
        id: t.id,
        name: t.name,
        slug: t.slug,
        category_name: t.category_name,
      })),
      emergent_tags: emergentTags.map(t => ({
        id: t.id,
        name: t.name,
        slug: t.slug,
        category_name: t.category_name,
      })),
    });
  });

  /**
   * PUT /v1/agents/:id/tags
   * 设置 Agent 标签
   */
  fastify.put<{
    Params: { id: string };
    Body: { tag_ids: string[] };
  }>('/v1/agents/:id/tags', async (request, reply) => {
    const { id: agentId } = request.params;

    const authResult = await verifyAgentToken(request);
    if (!authResult) {
      throw new AppError(ERROR_CODES.UNAUTHORIZED, 'Agent token required', 401);
    }

    // 只能设置自己的标签
    if (agentId !== authResult.agentId) {
      throw new AppError(ERROR_CODES.FORBIDDEN, 'Can only set your own tags', 403);
    }

    const parseResult = setTagsSchema.safeParse(request.body);
    if (!parseResult.success) {
      throw new AppError(ERROR_CODES.VALIDATION_ERROR, 'Invalid request body', 400);
    }

    const { tag_ids } = parseResult.data;

    // 删除现有手动标签
    await query(
      `DELETE FROM agent_tags WHERE agent_id = $1 AND source = 'manual'`,
      [agentId]
    );

    // 添加新标签
    if (tag_ids.length > 0) {
      const values = tag_ids.map((tagId, i) => `($1, $${i + 2}, 'manual')`).join(', ');
      await query(
        `INSERT INTO agent_tags (agent_id, tag_id, source) VALUES ${values}
         ON CONFLICT (agent_id, tag_id) DO NOTHING`,
        [agentId, ...tag_ids]
      );
    }

    // 获取更新后的标签
    const tags = await queryMany<TagRow>(
      `SELECT t.* FROM tags t
       JOIN agent_tags at ON t.id = at.tag_id
       WHERE at.agent_id = $1`,
      [agentId]
    );

    return successResponse({
      tags: tags.map(t => ({
        id: t.id,
        name: t.name,
        slug: t.slug,
      })),
    });
  });

  // ============================================
  // Browse/Discover APIs
  // ============================================

  /**
   * GET /v1/discover
   * 发现页：热门分类 + 热门标签 + 活跃房间
   */
  fastify.get('/v1/discover', async (request, reply) => {
    // 热门分类（排除 other）
    const categories = await queryMany<CategoryRow>(
      `SELECT * FROM tag_categories 
       WHERE id != 'other'
       ORDER BY room_count DESC
       LIMIT 6`
    );

    // 热门标签
    const trendingTags = await queryMany<TagRow & { category_icon: string }>(
      `SELECT t.*, c.icon as category_icon
       FROM tags t
       JOIN tag_categories c ON t.category_id = c.id
       WHERE t.status = 'active'
       ORDER BY t.room_count DESC
       LIMIT 10`
    );

    // 活跃房间（有标签的公开房间）
    const activeRooms = await queryMany<RoomRow & { member_count: number; tags: string }>(
      `SELECT r.*, 
              (SELECT COUNT(*) FROM room_members WHERE room_id = r.id) as member_count,
              (SELECT string_agg(t.name, ', ') FROM tags t 
               JOIN room_tags rt ON t.id = rt.tag_id 
               WHERE rt.room_id = r.id) as tags
       FROM rooms r
       WHERE r.status = 'active' AND r.is_public = true
       ORDER BY r.created_at DESC
       LIMIT 10`
    );

    return successResponse({
      categories: categories.map(c => ({
        id: c.id,
        name: c.name,
        icon: c.icon,
        room_count: c.room_count,
      })),
      trending_tags: trendingTags.map(t => ({
        id: t.id,
        name: t.name,
        slug: t.slug,
        category_icon: t.category_icon,
        room_count: t.room_count,
      })),
      active_rooms: activeRooms.map(r => ({
        id: r.id,
        name: r.name,
        description: r.description,
        member_count: r.member_count,
        tags: r.tags?.split(', ').filter(Boolean) || [],
        public_slug: r.public_slug,
        public_url: r.public_slug ? `${config.app.url}/watch/${r.public_slug}` : null,
        created_at: r.created_at.toISOString(),
      })),
    });
  });
}
