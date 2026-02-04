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
import { isMatrixEnabled } from '../lib/matrix.js';

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

  /**
   * POST /v1/auth/matrix-login
   * Get Matrix login token for seamless Element Web login
   * Creates Matrix user if not exists
   */
  fastify.post('/v1/auth/matrix-login', async (request: FastifyRequest, reply: FastifyReply) => {
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

      if (!isMatrixEnabled()) {
        throw new AppError(
          ERROR_CODES.SERVICE_UNAVAILABLE,
          'Matrix integration is not enabled',
          503
        );
      }

      // Generate Matrix username from user ID
      const username = `user_${session.userId.replace(/-/g, '').slice(0, 16)}`;
      const displayName = session.user.name || 'MoltChat User';
      
      // Check if user already has Matrix credentials stored
      const existingMatrix = await queryOne<{ matrix_user_id: string; matrix_access_token: string }>(
        'SELECT matrix_user_id, matrix_access_token FROM owner_profiles WHERE user_id = $1 AND matrix_user_id IS NOT NULL',
        [session.userId]
      );

      let matrixUserId: string;
      let matrixAccessToken: string;

      if (existingMatrix?.matrix_user_id && existingMatrix?.matrix_access_token) {
        // Use existing Matrix account
        matrixUserId = existingMatrix.matrix_user_id;
        matrixAccessToken = existingMatrix.matrix_access_token;
        logger.info({ userId: session.userId, matrixUserId }, 'Using existing Matrix account');
      } else {
        // Create new Matrix account
        const matrixResult = await createMatrixUserForOwner(username, displayName);
        if (!matrixResult) {
          throw new AppError(
            ERROR_CODES.INTERNAL_ERROR,
            'Failed to create Matrix account',
            500
          );
        }
        
        matrixUserId = matrixResult.userId;
        matrixAccessToken = matrixResult.accessToken;

        // Store Matrix credentials in owner_profiles
        await query(
          `INSERT INTO owner_profiles (user_id, display_name, matrix_user_id, matrix_access_token, created_at, updated_at)
           VALUES ($1, $2, $3, $4, NOW(), NOW())
           ON CONFLICT (user_id) DO UPDATE SET 
             matrix_user_id = $3, 
             matrix_access_token = $4,
             updated_at = NOW()`,
          [session.userId, displayName, matrixUserId, matrixAccessToken]
        );

        logger.info({ userId: session.userId, matrixUserId }, 'Created new Matrix account');
      }

      // Generate login token using Synapse Admin API
      const loginToken = await generateMatrixLoginToken(matrixUserId);
      if (!loginToken) {
        // Fallback: return access token for direct login
        return reply.send({
          success: true,
          data: {
            loginType: 'access_token',
            matrixUserId,
            accessToken: matrixAccessToken,
            elementUrl: `${config.matrix.elementWebUrl}`,
          },
        });
      }

      // Return login token for Element Web
      const elementLoginUrl = `${config.matrix.elementWebUrl}/#/login/sso/redirect?loginToken=${loginToken}`;

      return reply.send({
        success: true,
        data: {
          loginType: 'login_token',
          matrixUserId,
          loginToken,
          elementUrl: elementLoginUrl,
        },
      });

    } catch (error) {
      return handleError(error, reply);
    }
  });
}

// ============================================
// Matrix User Management
// ============================================

/**
 * Create a Matrix user for an owner (human user)
 */
async function createMatrixUserForOwner(
  username: string,
  displayName: string
): Promise<{ userId: string; accessToken: string } | null> {
  try {
    const password = `moltchat_owner_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    
    // Register user via Synapse API
    const registerUrl = `${config.matrix.homeserverUrl}/_matrix/client/v3/register`;
    
    // First, get the session for registration
    const initResponse = await fetch(registerUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    
    const initData = await initResponse.json() as { session?: string; errcode?: string };
    
    // Try registration
    const registerResponse = await fetch(registerUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username,
        password,
        auth: {
          type: 'm.login.dummy',
          session: initData.session,
        },
        initial_device_display_name: `MoltChat: ${displayName}`,
      }),
    });

    if (!registerResponse.ok) {
      const errorData = await registerResponse.json() as { errcode?: string };
      if (errorData.errcode === 'M_USER_IN_USE') {
        // User exists, try to login with stored password or use admin API
        logger.info({ username }, 'Matrix user already exists');
        // For existing users, we'll use admin API to get a token
        return await adminGetUserToken(username);
      }
      logger.error({ error: errorData }, 'Failed to register Matrix user');
      return null;
    }

    const data = await registerResponse.json() as { user_id: string; access_token: string };
    
    // Set display name
    await fetch(`${config.matrix.homeserverUrl}/_matrix/client/v3/profile/${data.user_id}/displayname`, {
      method: 'PUT',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${data.access_token}`,
      },
      body: JSON.stringify({ displayname: displayName }),
    });

    logger.info({ userId: data.user_id }, 'Matrix user registered for owner');
    
    return {
      userId: data.user_id,
      accessToken: data.access_token,
    };
  } catch (error) {
    logger.error({ error }, 'Failed to create Matrix user for owner');
    return null;
  }
}

/**
 * Get access token for existing user via Admin API
 */
async function adminGetUserToken(username: string): Promise<{ userId: string; accessToken: string } | null> {
  try {
    const userId = `@${username}:${config.matrix.serverName}`;
    
    // Use Synapse Admin API to create a new device/token
    const adminUrl = `${config.matrix.homeserverUrl}/_synapse/admin/v1/users/${encodeURIComponent(userId)}/login`;
    
    const response = await fetch(adminUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.matrix.botAccessToken}`,
      },
      body: JSON.stringify({}),
    });

    if (!response.ok) {
      logger.error({ status: response.status }, 'Admin API failed to get user token');
      return null;
    }

    const data = await response.json() as { access_token: string };
    
    return {
      userId,
      accessToken: data.access_token,
    };
  } catch (error) {
    logger.error({ error }, 'Failed to get admin token for user');
    return null;
  }
}

/**
 * Generate a short-lived login token for Element Web
 */
async function generateMatrixLoginToken(matrixUserId: string): Promise<string | null> {
  try {
    // Use Synapse Admin API to generate login token
    const adminUrl = `${config.matrix.homeserverUrl}/_synapse/admin/v1/users/${encodeURIComponent(matrixUserId)}/login`;
    
    const response = await fetch(adminUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.matrix.botAccessToken}`,
      },
      body: JSON.stringify({
        valid_until_ms: Date.now() + 5 * 60 * 1000, // 5 minutes
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      logger.error({ status: response.status, error }, 'Failed to generate login token');
      return null;
    }

    const data = await response.json() as { access_token: string };
    
    // Note: Synapse admin API returns access_token, not login_token
    // For true login_token, we need m.login.token flow
    // For now, we'll use the access_token approach
    
    return data.access_token;
  } catch (error) {
    logger.error({ error }, 'Failed to generate Matrix login token');
    return null;
  }
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

  // For MVP, accept any valid-looking tweet URL
  logger.info({ tweetUrl, agentName }, 'Tweet verification (MVP mode - accepting all)');
  return true;
}

export default authRoutes;
