/**
 * Admin Routes
 * 超级管理员 + 方向管理员授权系统
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { query, queryOne, queryMany } from '../db/client.js';
import { verifyUserSession, type SessionAuthResult } from '../lib/auth.js';
import { AppError, ERROR_CODES } from '../lib/errors.js';

// ============================================
// Helpers
// ============================================

async function requireSession(request: FastifyRequest): Promise<SessionAuthResult> {
  const session = await verifyUserSession(request);
  if (!session) {
    throw new AppError(ERROR_CODES.UNAUTHORIZED, 'Please sign in first', 401);
  }
  return session;
}

async function requireSuperAdmin(request: FastifyRequest): Promise<SessionAuthResult> {
  const session = await requireSession(request);
  const user = await queryOne<{ is_admin: boolean }>(
    `SELECT is_admin FROM users WHERE id = $1`,
    [session.userId]
  );
  if (!user?.is_admin) {
    throw new AppError(ERROR_CODES.FORBIDDEN, 'Super admin access required', 403);
  }
  return session;
}

// 检查用户是否有某 scope 的管理权限（超级 admin 或方向 admin）
export async function hasAdminAccess(
  userId: string,
  scope: string,
  theme?: string
): Promise<boolean> {
  const user = await queryOne<{ is_admin: boolean }>(
    `SELECT is_admin FROM users WHERE id = $1`,
    [userId]
  );
  if (user?.is_admin) return true;

  const grant = await queryOne<{ id: string }>(
    `SELECT id FROM admin_grants
     WHERE user_id = $1
       AND (scope = $2 OR scope = 'all')
       AND (theme IS NULL OR theme = $3)`,
    [userId, scope, theme ?? null]
  );
  return !!grant;
}

// ============================================
// Schemas
// ============================================

const grantSchema = z.object({
  user_id: z.string().uuid(),
  scope: z.enum(['battles', 'rooms', 'all']).default('battles'),
  theme: z.string().max(100).optional(),
});

// ============================================
// Routes
// ============================================

export async function adminRoutes(fastify: FastifyInstance) {

  // GET /v1/admin/me — 获取当前用户的管理权限
  fastify.get('/v1/admin/me', async (request: FastifyRequest, reply: FastifyReply) => {
    const session = await requireSession(request);

    const user = await queryOne<{ is_admin: boolean; name: string | null; email: string | null }>(
      `SELECT is_admin, name, email FROM users WHERE id = $1`,
      [session.userId]
    );

    const grants = await queryMany<{
      id: string;
      scope: string;
      theme: string | null;
      created_at: string;
    }>(
      `SELECT id, scope, theme, created_at FROM admin_grants WHERE user_id = $1 ORDER BY created_at DESC`,
      [session.userId]
    );

    return reply.send({
      success: true,
      data: {
        is_super_admin: user?.is_admin ?? false,
        grants,
      },
    });
  });

  // GET /v1/admin/users?q= — 搜索用户（超级 admin 专用）
  fastify.get('/v1/admin/users', async (request: FastifyRequest, reply: FastifyReply) => {
    await requireSuperAdmin(request);

    const { q, limit = '20' } = request.query as { q?: string; limit?: string };
    const limitNum = Math.min(parseInt(limit, 10) || 20, 100);

    let rows;
    if (q) {
      rows = await queryMany<{
        id: string;
        name: string | null;
        email: string | null;
        is_admin: boolean;
        created_at: string;
      }>(
        `SELECT id, name, email, is_admin, created_at
         FROM users
         WHERE name ILIKE $1 OR email ILIKE $1
         ORDER BY created_at DESC
         LIMIT $2`,
        [`%${q}%`, limitNum]
      );
    } else {
      rows = await queryMany<{
        id: string;
        name: string | null;
        email: string | null;
        is_admin: boolean;
        created_at: string;
      }>(
        `SELECT id, name, email, is_admin, created_at
         FROM users
         ORDER BY created_at DESC
         LIMIT $1`,
        [limitNum]
      );
    }

    return reply.send({ success: true, data: { users: rows } });
  });

  // GET /v1/admin/grants — 查看所有授权（超级 admin 专用）
  fastify.get('/v1/admin/grants', async (request: FastifyRequest, reply: FastifyReply) => {
    await requireSuperAdmin(request);

    const grants = await queryMany<{
      id: string;
      user_id: string;
      user_name: string | null;
      user_email: string | null;
      scope: string;
      theme: string | null;
      created_at: string;
    }>(
      `SELECT ag.id, ag.user_id, u.name AS user_name, u.email AS user_email,
              ag.scope, ag.theme, ag.created_at
       FROM admin_grants ag
       JOIN users u ON u.id = ag.user_id
       ORDER BY ag.created_at DESC`
    );

    return reply.send({ success: true, data: { grants } });
  });

  // POST /v1/admin/grants — 授权某用户为方向管理员（超级 admin 专用）
  fastify.post('/v1/admin/grants', async (request: FastifyRequest, reply: FastifyReply) => {
    const session = await requireSuperAdmin(request);

    const body = grantSchema.parse(request.body);

    // 检查目标用户存在
    const targetUser = await queryOne<{ id: string; name: string | null }>(
      `SELECT id, name FROM users WHERE id = $1`,
      [body.user_id]
    );
    if (!targetUser) {
      throw new AppError(ERROR_CODES.NOT_FOUND, 'User not found', 404);
    }

    const grant = await queryOne<{ id: string; scope: string; theme: string | null; created_at: string }>(
      `INSERT INTO admin_grants (user_id, granted_by, scope, theme)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id, scope, theme) DO UPDATE SET granted_by = EXCLUDED.granted_by
       RETURNING id, scope, theme, created_at`,
      [body.user_id, session.userId, body.scope, body.theme ?? null]
    );

    return reply.status(201).send({
      success: true,
      data: { grant, user: targetUser },
    });
  });

  // DELETE /v1/admin/grants/:id — 撤销授权（超级 admin 专用）
  fastify.delete('/v1/admin/grants/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    await requireSuperAdmin(request);

    const { id } = request.params as { id: string };

    const result = await query(
      `DELETE FROM admin_grants WHERE id = $1 RETURNING id`,
      [id]
    );

    if (!result.rows.length) {
      throw new AppError(ERROR_CODES.NOT_FOUND, 'Grant not found', 404);
    }

    return reply.status(204).send();
  });

  // POST /v1/admin/set-super — 设置超级管理员（仅限已有超级 admin 操作）
  fastify.post('/v1/admin/set-super', async (request: FastifyRequest, reply: FastifyReply) => {
    await requireSuperAdmin(request);

    const { user_id, is_admin } = request.body as { user_id: string; is_admin: boolean };

    await query(
      `UPDATE users SET is_admin = $1 WHERE id = $2`,
      [is_admin, user_id]
    );

    return reply.send({ success: true });
  });
}
