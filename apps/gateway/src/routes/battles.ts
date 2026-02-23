/**
 * Battle Events Routes
 * 行业配对赛：创建赛事、报名、触发配对、查看结果
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { query, queryOne, queryMany } from '../db/client.js';
import { verifyUserSession, type SessionAuthResult } from '../lib/auth.js';
import { AppError, ERROR_CODES } from '../lib/errors.js';
import { hasAdminAccess } from './admin.js';

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

async function requireBattleAdmin(request: FastifyRequest, theme?: string): Promise<SessionAuthResult> {
  const session = await requireSession(request);
  const ok = await hasAdminAccess(session.userId, 'battles', theme);
  if (!ok) {
    throw new AppError(ERROR_CODES.FORBIDDEN, 'Battle admin access required', 403);
  }
  return session;
}

// ============================================
// Schemas
// ============================================

const createBattleSchema = z.object({
  title: z.string().min(2).max(255),
  description: z.string().max(2000).optional(),
  theme: z.string().max(100).optional(),
  starts_at: z.string().datetime().optional(),
  ends_at: z.string().datetime().optional(),
  max_participants: z.number().int().min(2).max(500).default(100),
});

// ============================================
// Routes
// ============================================

export async function battleRoutes(fastify: FastifyInstance) {

  // GET /v1/battles — 公开，列出赛事
  fastify.get('/v1/battles', async (request: FastifyRequest, reply: FastifyReply) => {
    const { status, limit = '20', offset = '0' } = request.query as {
      status?: string;
      limit?: string;
      offset?: string;
    };

    const limitNum = Math.min(parseInt(limit, 10) || 20, 100);
    const offsetNum = parseInt(offset, 10) || 0;

    const params: unknown[] = [limitNum, offsetNum];
    let whereClause = `WHERE be.status != 'cancelled'`;
    if (status) {
      params.push(status);
      whereClause += ` AND be.status = $${params.length}`;
    }

    const battles = await queryMany<{
      id: string;
      title: string;
      description: string | null;
      theme: string | null;
      status: string;
      starts_at: string | null;
      ends_at: string | null;
      max_participants: number;
      participant_count: number;
      created_at: string;
    }>(
      `SELECT be.id, be.title, be.description, be.theme, be.status,
              be.starts_at, be.ends_at, be.max_participants, be.created_at,
              COUNT(DISTINCT bee.id)::int AS participant_count
       FROM battle_events be
       LEFT JOIN battle_event_entries bee ON bee.event_id = be.id
       ${whereClause}
       GROUP BY be.id
       ORDER BY be.created_at DESC
       LIMIT $1 OFFSET $2`,
      params
    );

    return reply.send({ battles });
  });

  // GET /v1/battles/:id — 公开，赛事详情
  fastify.get('/v1/battles/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };

    const battle = await queryOne<{
      id: string;
      title: string;
      description: string | null;
      theme: string | null;
      status: string;
      starts_at: string | null;
      ends_at: string | null;
      max_participants: number;
      created_at: string;
    }>(
      `SELECT id, title, description, theme, status, starts_at, ends_at, max_participants, created_at
       FROM battle_events WHERE id = $1 AND status != 'cancelled'`,
      [id]
    );

    if (!battle) {
      throw new AppError(ERROR_CODES.NOT_FOUND, 'Battle not found', 404);
    }

    const participants = await queryMany<{
      owner_id: string;
      display_name: string | null;
      agent_name: string | null;
      joined_at: string;
    }>(
      `SELECT bee.owner_id, op.display_name, a.name AS agent_name, bee.joined_at
       FROM battle_event_entries bee
       LEFT JOIN owner_profiles op ON op.user_id = bee.owner_id
       LEFT JOIN agents a ON a.id = bee.agent_id
       WHERE bee.event_id = $1
       ORDER BY bee.joined_at ASC`,
      [id]
    );

    return reply.send({ battle, participants });
  });

  // GET /v1/battles/:id/results — 公开，配对结果排行
  fastify.get('/v1/battles/:id/results', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };

    const battle = await queryOne<{ id: string; status: string }>(
      `SELECT id, status FROM battle_events WHERE id = $1`,
      [id]
    );
    if (!battle) {
      throw new AppError(ERROR_CODES.NOT_FOUND, 'Battle not found', 404);
    }

    // 查找该赛事触发的所有 exploration（通过 battle_event_id 关联）
    const results = await queryMany<{
      exploration_id: string;
      agent_a_name: string | null;
      agent_b_name: string | null;
      owner_a_name: string | null;
      owner_b_name: string | null;
      match_score: number | null;
      status: string;
      decision_a: string;
      decision_b: string;
      is_public: boolean;
      completed_at: string | null;
    }>(
      `SELECT ae.id AS exploration_id,
              a_agent.name AS agent_a_name,
              b_agent.name AS agent_b_name,
              a_owner.display_name AS owner_a_name,
              b_owner.display_name AS owner_b_name,
              ae.match_score,
              ae.status,
              ae.decision_a,
              ae.decision_b,
              ae.is_public,
              ae.completed_at
       FROM ai_explorations ae
       LEFT JOIN agents a_agent ON a_agent.id = ae.agent_a_id
       LEFT JOIN agents b_agent ON b_agent.id = ae.agent_b_id
       LEFT JOIN owner_profiles a_owner ON a_owner.user_id = ae.user_a_id
       LEFT JOIN owner_profiles b_owner ON b_owner.user_id = ae.user_b_id
       WHERE ae.battle_event_id = $1
         AND ae.status = 'completed'
       ORDER BY ae.match_score DESC NULLS LAST`,
      [id]
    );

    return reply.send({ results });
  });

  // POST /v1/battles — 创建赛事（管理员）
  fastify.post('/v1/battles', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = createBattleSchema.parse(request.body);
    const session = await requireBattleAdmin(request, body.theme);

    const battle = await queryOne<{ id: string; title: string; status: string; created_at: string }>(
      `INSERT INTO battle_events (title, description, theme, starts_at, ends_at, max_participants, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, title, status, created_at`,
      [
        body.title,
        body.description ?? null,
        body.theme ?? null,
        body.starts_at ?? null,
        body.ends_at ?? null,
        body.max_participants,
        session.userId,
      ]
    );

    return reply.status(201).send({ battle });
  });

  // PATCH /v1/battles/:id — 编辑赛事（管理员）
  fastify.patch('/v1/battles/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };

    const battle = await queryOne<{ theme: string | null }>(
      `SELECT theme FROM battle_events WHERE id = $1`,
      [id]
    );
    if (!battle) throw new AppError(ERROR_CODES.NOT_FOUND, 'Battle not found', 404);

    await requireBattleAdmin(request, battle.theme ?? undefined);

    const body = createBattleSchema.partial().parse(request.body);

    const fields: string[] = [];
    const params: unknown[] = [];

    if (body.title !== undefined) { params.push(body.title); fields.push(`title = $${params.length}`); }
    if (body.description !== undefined) { params.push(body.description); fields.push(`description = $${params.length}`); }
    if (body.theme !== undefined) { params.push(body.theme); fields.push(`theme = $${params.length}`); }
    if (body.starts_at !== undefined) { params.push(body.starts_at); fields.push(`starts_at = $${params.length}`); }
    if (body.ends_at !== undefined) { params.push(body.ends_at); fields.push(`ends_at = $${params.length}`); }
    if (body.max_participants !== undefined) { params.push(body.max_participants); fields.push(`max_participants = $${params.length}`); }

    if (!fields.length) return reply.send({ success: true });

    params.push(id);
    await query(
      `UPDATE battle_events SET ${fields.join(', ')}, updated_at = NOW() WHERE id = $${params.length}`,
      params
    );

    return reply.send({ success: true });
  });

  // POST /v1/battles/:id/join — 报名参赛（需登录）
  fastify.post('/v1/battles/:id/join', async (request: FastifyRequest, reply: FastifyReply) => {
    const session = await requireSession(request);
    const { id } = request.params as { id: string };

    const battle = await queryOne<{ id: string; status: string; max_participants: number }>(
      `SELECT id, status, max_participants FROM battle_events WHERE id = $1`,
      [id]
    );
    if (!battle) throw new AppError(ERROR_CODES.NOT_FOUND, 'Battle not found', 404);
    if (battle.status !== 'open') {
      throw new AppError(ERROR_CODES.FORBIDDEN, 'Battle is not open for registration', 400);
    }

    // 检查人数上限
    const countRow = await queryOne<{ cnt: string }>(
      `SELECT COUNT(*)::text AS cnt FROM battle_event_entries WHERE event_id = $1`,
      [id]
    );
    if (parseInt(countRow?.cnt ?? '0', 10) >= battle.max_participants) {
      throw new AppError(ERROR_CODES.FORBIDDEN, 'Battle is full', 400);
    }

    // 获取用户的 agent
    const agent = await queryOne<{ id: string }>(
      `SELECT id FROM agents WHERE owner_user_id = $1 AND status = 'active' LIMIT 1`,
      [session.userId]
    );

    await query(
      `INSERT INTO battle_event_entries (event_id, owner_id, agent_id)
       VALUES ($1, $2, $3)
       ON CONFLICT (event_id, owner_id) DO NOTHING`,
      [id, session.userId, agent?.id ?? null]
    );

    return reply.status(201).send({ success: true });
  });

  // DELETE /v1/battles/:id/join — 取消报名
  fastify.delete('/v1/battles/:id/join', async (request: FastifyRequest, reply: FastifyReply) => {
    const session = await requireSession(request);
    const { id } = request.params as { id: string };

    await query(
      `DELETE FROM battle_event_entries WHERE event_id = $1 AND owner_id = $2`,
      [id, session.userId]
    );

    return reply.status(204).send();
  });

  // POST /v1/battles/:id/match — 触发配对（管理员）
  fastify.post('/v1/battles/:id/match', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };

    const battle = await queryOne<{ id: string; status: string; theme: string | null }>(
      `SELECT id, status, theme FROM battle_events WHERE id = $1`,
      [id]
    );
    if (!battle) throw new AppError(ERROR_CODES.NOT_FOUND, 'Battle not found', 404);
    if (battle.status !== 'open') {
      throw new AppError(ERROR_CODES.FORBIDDEN, 'Battle must be in open status to trigger matching', 400);
    }

    await requireBattleAdmin(request, battle.theme ?? undefined);

    // 获取所有报名者（有 agent 的）
    const entries = await queryMany<{
      owner_id: string;
      agent_id: string | null;
    }>(
      `SELECT owner_id, agent_id FROM battle_event_entries WHERE event_id = $1 AND agent_id IS NOT NULL`,
      [id]
    );

    if (entries.length < 2) {
      throw new AppError(ERROR_CODES.FORBIDDEN, 'Need at least 2 participants with agents to match', 400);
    }

    // 更新赛事状态为 matching
    await query(`UPDATE battle_events SET status = 'matching', updated_at = NOW() WHERE id = $1`, [id]);

    // 两两配对创建 explorations（随机打乱后顺序配对）
    const shuffled = [...entries].sort(() => Math.random() - 0.5);
    let created = 0;

    for (let i = 0; i + 1 < shuffled.length; i += 2) {
      const a = shuffled[i]!;
      const b = shuffled[i + 1]!;

      // 检查是否已有配对
      const existing = await queryOne<{ id: string }>(
        `SELECT id FROM ai_explorations
         WHERE battle_event_id = $1
           AND ((user_a_id = $2 AND user_b_id = $3) OR (user_a_id = $3 AND user_b_id = $2))`,
        [id, a.owner_id, b.owner_id]
      );
      if (existing) continue;

      await query(
        `INSERT INTO ai_explorations
           (user_a_id, user_b_id, agent_a_id, agent_b_id, source, battle_event_id, status)
         VALUES ($1, $2, $3, $4, 'battle', $5, 'pending')`,
        [a.owner_id, b.owner_id, a.agent_id, b.agent_id, id]
      );
      created++;
    }

    return reply.send({ created, total_participants: entries.length });
  });

  // POST /v1/battles/:id/complete — 结束赛事（管理员）
  fastify.post('/v1/battles/:id/complete', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };

    const battle = await queryOne<{ theme: string | null }>(
      `SELECT theme FROM battle_events WHERE id = $1`,
      [id]
    );
    if (!battle) throw new AppError(ERROR_CODES.NOT_FOUND, 'Battle not found', 404);

    await requireBattleAdmin(request, battle.theme ?? undefined);

    await query(
      `UPDATE battle_events SET status = 'completed', updated_at = NOW() WHERE id = $1`,
      [id]
    );

    return reply.send({ success: true });
  });
}
