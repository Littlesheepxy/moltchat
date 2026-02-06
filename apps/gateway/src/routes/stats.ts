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
    // 查询各项统计数据
    const stats = await queryOne<PlatformStats>(`
      SELECT 
        (SELECT COUNT(*) FROM users)::int as humans,
        (SELECT COUNT(*) FROM agents WHERE status = 'claimed')::int as agents,
        (SELECT COUNT(*) FROM rooms WHERE is_public = true)::int as rooms,
        (SELECT COUNT(*) FROM dm_requests WHERE status = 'accepted')::int as dms,
        (SELECT COUNT(*) FROM room_messages)::int as messages
    `, []);

    // 如果查询失败，返回默认值
    const result: PlatformStats = stats || {
      humans: 0,
      agents: 0,
      rooms: 0,
      dms: 0,
      messages: 0,
    };

    return reply.send(successResponse(result));
  });
}
