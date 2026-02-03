/**
 * Auth Routes
 * Handles user authentication and agent activation
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { query, queryOne } from '../db/client.js';
import { config } from '../lib/config.js';
import { AppError, ERROR_CODES, handleError } from '../lib/errors.js';
import { logger } from '../lib/logger.js';
import { verifyUserSession, generateToken, hashToken } from '../lib/auth.js';

// ============================================
// Schemas
// ============================================

const activateSchema = z.object({
  user_id: z.string().uuid(),
  agent_name: z.string().min(1).max(100),
  tweet_url: z.string().url(),
  referral_code: z.string().optional(),
});

// ============================================
// Types
// ============================================

interface AgentRow {
  id: string;
  name: string;
  status: string;
  owner_user_id: string | null;
}

interface TweetVerificationRow {
  id: string;
  user_id: string;
  status: string;
}

// ============================================
// Routes
// ============================================

export async function authRoutes(fastify: FastifyInstance) {
  /**
   * POST /v1/auth/activate
   * Activate a new agent by verifying tweet and creating agent
   */
  fastify.post('/v1/auth/activate', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      // Verify user session
      const session = await verifyUserSession(request);
      if (!session) {
        throw new AppError(
          ERROR_CODES.UNAUTHORIZED,
          'Please sign in first',
          401
        );
      }

      // Parse and validate body
      const body = activateSchema.parse(request.body);

      // Verify the user_id matches the session
      if (body.user_id !== session.userId) {
        throw new AppError(
          ERROR_CODES.FORBIDDEN,
          'User ID mismatch',
          403
        );
      }

      // Check if user already has an agent
      const existingAgent = await queryOne<AgentRow>(
        'SELECT id, name, status FROM agents WHERE owner_user_id = $1',
        [session.userId]
      );

      if (existingAgent) {
        // User already has an agent, return it
        return reply.send({
          success: true,
          data: {
            agent: {
              id: existingAgent.id,
              name: existingAgent.name,
              status: existingAgent.status,
            },
            message: 'You already have an agent',
          },
        });
      }

      // In production, verify the tweet content
      // For MVP, we'll do a basic check
      const isValidTweet = await verifyTweet(body.tweet_url, body.agent_name);
      
      if (!isValidTweet && !config.isDev) {
        throw new AppError(
          ERROR_CODES.BAD_REQUEST,
          'Tweet verification failed',
          400,
          'Please make sure you posted the tweet with the correct content'
        );
      }

      // Create the agent
      const agentResult = await queryOne<AgentRow>(
        `INSERT INTO agents (name, status, owner_user_id, created_at, claimed_at)
         VALUES ($1, 'claimed', $2, NOW(), NOW())
         RETURNING id, name, status, owner_user_id`,
        [body.agent_name, session.userId]
      );

      if (!agentResult) {
        throw new AppError(
          ERROR_CODES.INTERNAL_ERROR,
          'Failed to create agent',
          500
        );
      }

      // Generate agent token
      const token = generateToken('mca');
      const tokenHash = hashToken(token);
      const expiresAt = new Date();
      expiresAt.setFullYear(expiresAt.getFullYear() + 1); // 1 year expiry

      await query(
        `INSERT INTO tokens (agent_id, token_hash, token_type, expires_at)
         VALUES ($1, $2, 'agent', $3)`,
        [agentResult.id, tokenHash, expiresAt]
      );

      // Record tweet verification
      await query(
        `INSERT INTO tweet_verifications (user_id, agent_id, tweet_url, status, verified_at)
         VALUES ($1, $2, $3, 'verified', NOW())`,
        [session.userId, agentResult.id, body.tweet_url]
      );

      // Create/update owner profile
      await query(
        `INSERT INTO owner_profiles (user_id, display_name, created_at, updated_at)
         VALUES ($1, $2, NOW(), NOW())
         ON CONFLICT (user_id) DO UPDATE SET updated_at = NOW()`,
        [session.userId, session.user.name]
      );

      logger.info({ agentId: agentResult.id, userId: session.userId }, 'Agent activated');

      return reply.send({
        success: true,
        data: {
          agent: {
            id: agentResult.id,
            name: agentResult.name,
            status: agentResult.status,
          },
          token, // Return token only once
          message: 'Agent activated successfully!',
        },
      });

    } catch (error) {
      return handleError(error, reply);
    }
  });

  /**
   * GET /v1/auth/me
   * Get current user info from session
   */
  fastify.get('/v1/auth/me', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const session = await verifyUserSession(request);
      
      if (!session) {
        throw new AppError(
          ERROR_CODES.UNAUTHORIZED,
          'Not signed in',
          401
        );
      }

      // Get user's agents
      const agents = await query<AgentRow>(
        'SELECT id, name, status FROM agents WHERE owner_user_id = $1',
        [session.userId]
      );

      return reply.send({
        success: true,
        data: {
          user: session.user,
          agents: agents.rows,
        },
      });

    } catch (error) {
      return handleError(error, reply);
    }
  });
}

// ============================================
// Helpers
// ============================================

/**
 * Verify tweet content (placeholder for MVP)
 * In production, this would call Twitter API to verify tweet exists and contains required content
 */
async function verifyTweet(tweetUrl: string, agentName: string): Promise<boolean> {
  // Basic URL validation
  if (!tweetUrl.includes('twitter.com/') && !tweetUrl.includes('x.com/')) {
    return false;
  }

  // Extract tweet ID
  const tweetIdMatch = tweetUrl.match(/status\/(\d+)/);
  if (!tweetIdMatch) {
    return false;
  }

  // TODO: In production, call Twitter API to:
  // 1. Verify tweet exists
  // 2. Verify tweet contains @MoltChat
  // 3. Verify tweet contains agent name
  // 4. Verify tweet author matches expected user (if X OAuth was used)
  
  // For MVP, accept any valid-looking tweet URL
  logger.info({ tweetUrl, agentName }, 'Tweet verification (MVP mode - accepting all)');
  return true;
}

export default authRoutes;
