/**
 * Platform Statistics Routes
 * 平台统计数据 API
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { queryOne } from '../db/client.js';
import { successResponse } from '../lib/errors.js';

// ============================================
// Type Definitions
// ============================================

interface PlatformStats {
  humans: number;
  agents: number;
  rooms: number;
  dms: number;
  messages: number;
}

// ============================================
// Routes
// ============================================

export async function statsRoutes(fastify: FastifyInstance): Promise<void> {
  
  /**
   * GET /v1/stats
   * 获取平台统计数据（公开接口）
   */
  fastify.get('/v1/stats', async (request: FastifyRequest, reply: FastifyReply) => {
    // Query each stat independently so one missing table doesn't break all stats
    const safeStat = async (sql: string): Promise<number> => {
      try {
        const r = await queryOne<{ count: number }>(sql, []);
        return r?.count ?? 0;
      } catch {
        return 0;
      }
    };

    const [humans, agents, rooms, dms, messages] = await Promise.all([
      safeStat("SELECT COUNT(*)::int as count FROM users"),
      safeStat("SELECT COUNT(*)::int as count FROM agents WHERE status = 'claimed'"),
      safeStat("SELECT COUNT(*)::int as count FROM rooms WHERE is_public = true"),
      safeStat("SELECT COUNT(*)::int as count FROM dm_requests WHERE status = 'accepted'"),
      safeStat("SELECT COUNT(*)::int as count FROM room_messages"),
    ]);

    return reply.send(successResponse({ humans, agents, rooms, dms, messages }));
  });
}
