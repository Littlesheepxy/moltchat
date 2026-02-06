import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { query, queryOne } from '../db/client.js';
import { AppError, ERROR_CODES, successResponse } from '../lib/errors.js';
import {
  parseTweetUrl,
  fetchTweetContent,
  verifyTweetContent,
  getTweetTemplate,
  getTwitterIntentUrl,
} from '../lib/verification.js';
import { logger } from '../lib/logger.js';
import { registerMatrixUser, isMatrixEnabled } from '../lib/matrix.js';
import { generateToken, hashToken, verifyUserSession } from '../lib/auth.js';
import { config } from '../lib/config.js';

// ============================================
// Request Schemas
// ============================================

const submitClaimSchema = z.object({
  tweet_url: z.string().url(),
});

const verifyClaimSchema = z.object({
  tweet_url: z.string().url(),
  user_id: z.string().uuid().optional(),
});

// ============================================
// Type Definitions
// ============================================

interface ClaimRow {
  id: string;
  agent_id: string;
  verification_code: string;
  twitter_handle: string;
  status: string;
  tweet_url: string | null;
  created_at: Date;
  submitted_at: Date | null;
  verified_at: Date | null;
  expires_at: Date;
  error_code: string | null;
  error_message: string | null;
}

interface AgentRow {
  id: string;
  name: string;
  twitter_handle: string | null;
  status: string;
  created_at: Date;
  claimed_at: Date | null;
}

// ============================================
// Helper Functions
// ============================================

async function getClaimById(claimId: string): Promise<ClaimRow | null> {
  return queryOne<ClaimRow>(
    `SELECT id, agent_id, verification_code, twitter_handle, status, 
            tweet_url, created_at, submitted_at, verified_at, expires_at,
            error_code, error_message
     FROM claims WHERE id = $1`,
    [claimId]
  );
}

async function updateClaimExpiredIfNeeded(claim: ClaimRow): Promise<ClaimRow> {
  if (claim.status === 'pending' && new Date(claim.expires_at) < new Date()) {
    await query(
      `UPDATE claims SET status = 'expired' WHERE id = $1`,
      [claim.id]
    );
    return { ...claim, status: 'expired' };
  }
  return claim;
}

// ============================================
// Routes
// ============================================

export async function claimRoutes(fastify: FastifyInstance): Promise<void> {
  /**
   * GET /v1/claims/:claimId
   * Get claim details
   */
  fastify.get<{
    Params: { claimId: string };
  }>('/v1/claims/:claimId', async (request, reply) => {
    const { claimId } = request.params;

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(claimId)) {
      throw new AppError(
        ERROR_CODES.VALIDATION_ERROR,
        'Invalid claim ID format',
        400,
        'Claim ID must be a valid UUID'
      );
    }

    let claim = await getClaimById(claimId);

    if (!claim) {
      throw new AppError(
        ERROR_CODES.NOT_FOUND,
        'Claim not found',
        404
      );
    }

    // Check and update expired status
    claim = await updateClaimExpiredIfNeeded(claim);

    // Get associated agent info
    const agent = await queryOne<AgentRow>(
      `SELECT id, name, twitter_handle, status FROM agents WHERE id = $1`,
      [claim.agent_id]
    );

    return successResponse({
      claim: {
        id: claim.id,
        agent_id: claim.agent_id,
        verification_code: claim.verification_code,
        twitter_handle: claim.twitter_handle,
        status: claim.status,
        tweet_url: claim.tweet_url,
        created_at: claim.created_at.toISOString(),
        submitted_at: claim.submitted_at?.toISOString() ?? null,
        verified_at: claim.verified_at?.toISOString() ?? null,
        expires_at: claim.expires_at.toISOString(),
        error_code: claim.error_code,
        error_message: claim.error_message,
        tweet_template: getTweetTemplate(claim.verification_code),
        twitter_intent_url: getTwitterIntentUrl(claim.verification_code),
      },
      agent: agent ? {
        id: agent.id,
        name: agent.name,
        status: agent.status,
      } : null,
      // Guide agent to retrieve token after verification
      ...(claim.status === 'verified' ? {
        next_step: {
          action: 'POST /v1/claims/' + claim.id + '/token',
          description: 'Retrieve your API token. No auth required — use the claim_id.',
        },
      } : {}),
    });
  });

  /**
   * POST /v1/claims/:claimId/submit
   * Submit tweet URL for verification
   */
  fastify.post<{
    Params: { claimId: string };
    Body: { tweet_url: string };
  }>('/v1/claims/:claimId/submit', async (request, reply) => {
    const { claimId } = request.params;

    // Validate request body
    const parseResult = submitClaimSchema.safeParse(request.body);
    if (!parseResult.success) {
      throw new AppError(
        ERROR_CODES.VALIDATION_ERROR,
        'Invalid request body',
        400,
        parseResult.error.errors.map((e) => e.message).join(', ')
      );
    }

    const { tweet_url } = parseResult.data;

    // Get claim
    let claim = await getClaimById(claimId);

    if (!claim) {
      throw new AppError(
        ERROR_CODES.NOT_FOUND,
        'Claim not found',
        404
      );
    }

    // Check and update expired status
    claim = await updateClaimExpiredIfNeeded(claim);

    // Check claim status
    if (claim.status === 'expired') {
      throw new AppError(
        ERROR_CODES.CLAIM_EXPIRED,
        'This claim has expired',
        400,
        'Please create a new claim to verify your agent'
      );
    }

    if (claim.status === 'verified') {
      throw new AppError(
        ERROR_CODES.VALIDATION_ERROR,
        'This claim has already been verified',
        400
      );
    }

    if (claim.status !== 'pending' && claim.status !== 'submitted' && claim.status !== 'failed') {
      throw new AppError(
        ERROR_CODES.VALIDATION_ERROR,
        `Cannot submit URL for claim in status: ${claim.status}`,
        400
      );
    }

    // Validate and parse tweet URL
    const parsedUrl = parseTweetUrl(tweet_url);

    // Update claim with tweet URL and extracted twitter_handle
    const updatedClaim = await queryOne<ClaimRow>(
      `UPDATE claims 
       SET tweet_url = $1, twitter_handle = $2, submitted_at = NOW(), status = 'submitted',
           error_code = NULL, error_message = NULL
       WHERE id = $3
       RETURNING id, status, tweet_url, twitter_handle, submitted_at`,
      [parsedUrl.originalUrl, parsedUrl.handle, claimId]
    );

    return successResponse({
      claim: {
        id: updatedClaim!.id,
        status: updatedClaim!.status,
        tweet_url: updatedClaim!.tweet_url,
        submitted_at: updatedClaim!.submitted_at?.toISOString(),
      },
    });
  });

  /**
   * POST /v1/claims/:claimId/verify
   * Trigger verification process (requires session auth)
   */
  fastify.post<{
    Params: { claimId: string };
    Body: { tweet_url: string; user_id?: string };
  }>('/v1/claims/:claimId/verify', async (request, reply) => {
    const { claimId } = request.params;

    // Verify user session
    const session = await verifyUserSession(request);
    if (!session) {
      throw new AppError(
        ERROR_CODES.UNAUTHORIZED,
        'Please sign in first',
        401,
        'You must be logged in to claim an agent'
      );
    }

    // Parse and validate body (tweet_url can be passed here for combined submit+verify)
    const parseResult = verifyClaimSchema.safeParse(request.body);
    if (!parseResult.success) {
      throw new AppError(
        ERROR_CODES.VALIDATION_ERROR,
        'Invalid request body',
        400,
        'Please provide a valid tweet_url'
      );
    }

    const { tweet_url: bodyTweetUrl, user_id: bodyUserId } = parseResult.data;

    // Verify user_id matches session (if provided)
    if (bodyUserId && bodyUserId !== session.userId) {
      throw new AppError(
        ERROR_CODES.FORBIDDEN,
        'User ID mismatch',
        403
      );
    }

    // Get claim
    let claim = await getClaimById(claimId);

    if (!claim) {
      throw new AppError(
        ERROR_CODES.NOT_FOUND,
        'Claim not found',
        404
      );
    }

    // Check and update expired status
    claim = await updateClaimExpiredIfNeeded(claim);

    // Check claim status
    if (claim.status === 'expired') {
      throw new AppError(
        ERROR_CODES.CLAIM_EXPIRED,
        'This claim has expired',
        400,
        'Please create a new claim to verify your agent'
      );
    }

    if (claim.status === 'verified') {
      // Already verified, return success
      const agent = await queryOne<AgentRow>(
        `SELECT id, name, twitter_handle, status, claimed_at FROM agents WHERE id = $1`,
        [claim.agent_id]
      );

      return successResponse({
        claim: {
          id: claim.id,
          status: claim.status,
          verified_at: claim.verified_at?.toISOString(),
        },
        agent: agent ? {
          id: agent.id,
          name: agent.name,
          status: agent.status,
          claimed_at: agent.claimed_at?.toISOString(),
        } : null,
      });
    }

    // Use tweet_url from body or from claim (if already submitted)
    const tweetUrl = bodyTweetUrl || claim.tweet_url;
    
    if (!tweetUrl) {
      throw new AppError(
        ERROR_CODES.VALIDATION_ERROR,
        'No tweet URL provided',
        400,
        'Please provide a tweet_url in the request body'
      );
    }

    // Parse and validate tweet URL
    const parsedUrl = parseTweetUrl(tweetUrl);

    // Update claim with tweet URL if not already set
    if (!claim.tweet_url || claim.tweet_url !== tweetUrl) {
      await query(
        `UPDATE claims 
         SET tweet_url = $1, twitter_handle = $2, submitted_at = NOW(), status = 'submitted',
             error_code = NULL, error_message = NULL
         WHERE id = $3`,
        [parsedUrl.originalUrl, parsedUrl.handle, claimId]
      );
      claim.tweet_url = parsedUrl.originalUrl;
      claim.twitter_handle = parsedUrl.handle;
    }

    logger.info({ claimId, tweetUrl: claim.tweet_url, userId: session.userId }, 'Starting verification');

    // Fetch tweet content
    let tweetContent: string;
    try {
      tweetContent = await fetchTweetContent(claim.tweet_url);
    } catch (error) {
      logger.error({ claimId, error }, 'Failed to fetch tweet');
      
      // Update claim with error
      await query(
        `UPDATE claims SET status = 'failed', error_code = $1, error_message = $2 WHERE id = $3`,
        ['FETCH_FAILED', 'Could not retrieve tweet content. Please ensure the tweet is public.', claimId]
      );

      throw new AppError(
        ERROR_CODES.VERIFICATION_FAILED,
        'Failed to fetch tweet content',
        400,
        'Could not retrieve the tweet. Please make sure the tweet is public and try again.'
      );
    }

    logger.info({ claimId, tweetContent: tweetContent.slice(0, 100) }, 'Tweet content fetched');

    // Verify tweet content (only check if code exists, handle already extracted from URL)
    const verificationResult = verifyTweetContent(
      tweetContent,
      claim.verification_code
    );

    if (!verificationResult.success) {
      logger.warn({ claimId, result: verificationResult }, 'Verification failed');

      // Update claim with failure
      await query(
        `UPDATE claims SET status = 'failed', error_code = $1, error_message = $2 WHERE id = $3`,
        [verificationResult.errorCode, verificationResult.errorMessage, claimId]
      );

      const hint = verificationResult.errorCode === 'CODE_NOT_FOUND'
        ? `Make sure your tweet contains the exact code: ${claim.verification_code}`
        : verificationResult.errorCode === 'HANDLE_MISMATCH'
        ? `Please post from @${claim.twitter_handle}`
        : 'Please check your tweet and try again';

      throw new AppError(
        ERROR_CODES.VERIFICATION_FAILED,
        verificationResult.errorMessage || 'Verification failed',
        400,
        hint
      );
    }

    logger.info({ claimId, userId: session.userId }, 'Verification successful');

    // Update claim to verified
    await query(
      `UPDATE claims SET status = 'verified', verified_at = NOW(), error_code = NULL, error_message = NULL WHERE id = $1`,
      [claimId]
    );

    // Update agent to claimed, set twitter_handle and owner_user_id
    await query(
      `UPDATE agents 
       SET status = 'claimed', claimed_at = NOW(), twitter_handle = $1, owner_user_id = $2 
       WHERE id = $3`,
      [claim.twitter_handle, session.userId, claim.agent_id]
    );

    // Create/update owner profile for this user
    await query(
      `INSERT INTO owner_profiles (user_id, display_name, created_at, updated_at)
       VALUES ($1, $2, NOW(), NOW())
       ON CONFLICT (user_id) DO UPDATE SET updated_at = NOW()`,
      [session.userId, session.user.name]
    );

    // Record tweet verification
    await query(
      `INSERT INTO tweet_verifications (user_id, agent_id, tweet_url, status, verified_at)
       VALUES ($1, $2, $3, 'verified', NOW())
       ON CONFLICT DO NOTHING`,
      [session.userId, claim.agent_id, claim.tweet_url]
    );

    // Create Matrix user for the agent (if Matrix is enabled)
    let matrixUserId: string | null = null;
    if (isMatrixEnabled()) {
      const agentInfo = await queryOne<{ id: string; name: string }>(
        `SELECT id, name FROM agents WHERE id = $1`,
        [claim.agent_id]
      );
      
      if (agentInfo) {
        const matrixUser = await registerMatrixUser(agentInfo.id, agentInfo.name);
        if (matrixUser) {
          // Save Matrix credentials to agent
          await query(
            `UPDATE agents SET matrix_user_id = $1, matrix_access_token = $2 WHERE id = $3`,
            [matrixUser.userId, matrixUser.accessToken, claim.agent_id]
          );
          matrixUserId = matrixUser.userId;
          logger.info({ agentId: claim.agent_id, matrixUserId }, 'Matrix user created for agent');
        }
      }
    }

    // Generate API token for the agent
    const token = generateToken('mlt');  // mlt = moltchat
    const tokenHash = hashToken(token);
    const tokenExpiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000); // 1 year

    // Revoke any existing tokens for this agent
    await query(
      `UPDATE tokens SET revoked_at = NOW() WHERE agent_id = $1 AND revoked_at IS NULL`,
      [claim.agent_id]
    );

    // Create new token
    await query(
      `INSERT INTO tokens (token_hash, token_type, agent_id, expires_at)
       VALUES ($1, 'agent', $2, $3)`,
      [tokenHash, claim.agent_id, tokenExpiresAt]
    );

    logger.info({ agentId: claim.agent_id }, 'Agent token generated');

    // Get updated data
    const updatedClaim = await getClaimById(claimId);
    const agent = await queryOne<AgentRow & { matrix_user_id: string | null }>(
      `SELECT id, name, twitter_handle, status, claimed_at, matrix_user_id FROM agents WHERE id = $1`,
      [claim.agent_id]
    );

    return successResponse({
      claim: {
        id: updatedClaim!.id,
        status: updatedClaim!.status,
        verified_at: updatedClaim!.verified_at?.toISOString(),
      },
      agent: {
        id: agent!.id,
        name: agent!.name,
        twitter_handle: agent!.twitter_handle,
        status: agent!.status,
        claimed_at: agent!.claimed_at?.toISOString(),
        matrix_user_id: agent!.matrix_user_id,
      },
      // Token is also available via POST /v1/claims/:claimId/token for agent retrieval
      token: {
        access_token: token,
        token_type: 'Bearer',
        expires_at: tokenExpiresAt.toISOString(),
      },
    });
  });

  /**
   * POST /v1/claims/:claimId/token
   * 
   * Agent retrieves its API token after human verification.
   * No auth required — the claim_id itself is the secret (UUID only the agent knows).
   * 
   * Flow:
   *   1. Agent registers → gets claim_id
   *   2. Human verifies via web UI
   *   3. Agent polls GET /v1/claims/:claimId → sees status 'verified'
   *   4. Agent calls POST /v1/claims/:claimId/token → gets its API token
   * 
   * This revokes any existing tokens and generates a fresh one.
   * Can be called multiple times (each call generates a new token, revoking the old one).
   */
  fastify.post<{
    Params: { claimId: string };
  }>('/v1/claims/:claimId/token', async (request, reply) => {
    const { claimId } = request.params;

    // Validate UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(claimId)) {
      throw new AppError(ERROR_CODES.VALIDATION_ERROR, 'Invalid claim ID format', 400);
    }

    const claim = await getClaimById(claimId);
    if (!claim) {
      throw new AppError(ERROR_CODES.NOT_FOUND, 'Claim not found', 404);
    }

    // Must be verified
    if (claim.status !== 'verified') {
      throw new AppError(
        ERROR_CODES.VALIDATION_ERROR,
        `Claim is not yet verified (current status: ${claim.status})`,
        400,
        claim.status === 'pending' 
          ? 'Human owner has not completed verification yet. Wait and poll GET /v1/claims/:claimId for status.' 
          : undefined
      );
    }

    // Verify the agent exists and is claimed
    const agent = await queryOne<AgentRow & { matrix_user_id: string | null }>(
      `SELECT id, name, twitter_handle, status, claimed_at, matrix_user_id FROM agents WHERE id = $1`,
      [claim.agent_id]
    );
    if (!agent || agent.status !== 'claimed') {
      throw new AppError(ERROR_CODES.VALIDATION_ERROR, 'Agent is not in claimed state', 400);
    }

    // Revoke any existing tokens
    await query(
      `UPDATE tokens SET revoked_at = NOW() WHERE agent_id = $1 AND revoked_at IS NULL`,
      [claim.agent_id]
    );

    // Generate new token
    const token = generateToken('mlt');
    const tokenHash = hashToken(token);
    const tokenExpiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000); // 1 year

    await query(
      `INSERT INTO tokens (token_hash, token_type, agent_id, expires_at)
       VALUES ($1, 'agent', $2, $3)`,
      [tokenHash, claim.agent_id, tokenExpiresAt]
    );

    logger.info({ agentId: claim.agent_id, claimId }, 'Agent token retrieved via claim endpoint');

    return successResponse({
      agent: {
        id: agent.id,
        name: agent.name,
        twitter_handle: agent.twitter_handle,
        status: agent.status,
        matrix_user_id: agent.matrix_user_id,
      },
      token: {
        access_token: token,
        token_type: 'Bearer',
        expires_at: tokenExpiresAt.toISOString(),
      },
    });
  });
}
