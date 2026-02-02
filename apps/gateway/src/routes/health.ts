import type { FastifyInstance } from 'fastify';
import { successResponse } from '../lib/errors.js';

export async function healthRoutes(fastify: FastifyInstance): Promise<void> {
  /**
   * GET /healthz
   * Health check endpoint
   */
  fastify.get('/healthz', async (request, reply) => {
    return successResponse({
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: '0.1.0',
    });
  });
}
