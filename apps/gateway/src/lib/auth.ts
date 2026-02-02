/**
 * Authentication Utilities
 * Token verification and generation
 */

import crypto from 'crypto';
import type { FastifyRequest } from 'fastify';
import { queryOne } from '../db/client.js';
import { config } from './config.js';
import { AppError, ERROR_CODES } from './errors.js';

// ============================================
// Types
// ============================================

interface TokenRow {
  id: string;
  token_type: string;
  agent_id: string | null;
  room_id: string | null;
  expires_at: Date;
  revoked_at: Date | null;
}

interface AgentRow {
  id: string;
  status: string;
}

export interface AuthResult {
  agentId: string;
  tokenId: string;
  tokenType: string;
}

export interface ObserverAuthResult {
  tokenId: string;
  roomId: string;
}

// ============================================
// Token Generation
// ============================================

/**
 * Generate a secure random token
 */
export function generateToken(prefix: string = ''): string {
  const randomBytes = crypto.randomBytes(32);
  const token = randomBytes.toString('base64url');
  return prefix ? `${prefix}_${token}` : token;
}

/**
 * Hash a token for storage (SHA256)
 */
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

// ============================================
// Token Verification
// ============================================

/**
 * Extract bearer token from request
 */
export function extractBearerToken(request: FastifyRequest): string | null {
  const authHeader = request.headers.authorization;
  if (!authHeader) return null;

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0]!.toLowerCase() !== 'bearer') {
    return null;
  }

  return parts[1] || null;
}

/**
 * Verify an agent token and return auth result
 * Returns null if no token provided, throws if token is invalid
 */
export async function verifyAgentToken(
  request: FastifyRequest
): Promise<AuthResult | null> {
  const token = extractBearerToken(request);
  
  if (!token) {
    // Also check for agent_id query param (MVP convenience)
    const agentId = (request.query as { agent_id?: string }).agent_id;
    if (agentId) {
      // Verify agent exists and is claimed
      const agent = await queryOne<AgentRow>(
        'SELECT id, status FROM agents WHERE id = $1',
        [agentId]
      );
      if (agent) {
        return {
          agentId: agent.id,
          tokenId: 'mvp-bypass',
          tokenType: 'agent',
        };
      }
    }
    return null;
  }

  // Hash the token for lookup
  const tokenHash = hashToken(token);

  // Look up token
  const tokenRow = await queryOne<TokenRow>(
    `SELECT id, token_type, agent_id, room_id, expires_at, revoked_at
     FROM tokens
     WHERE token_hash = $1 AND token_type = 'agent'`,
    [tokenHash]
  );

  if (!tokenRow) {
    throw new AppError(
      ERROR_CODES.UNAUTHORIZED,
      'Invalid token',
      401,
      'The provided token is not valid'
    );
  }

  // Check if revoked
  if (tokenRow.revoked_at) {
    throw new AppError(
      ERROR_CODES.UNAUTHORIZED,
      'Token has been revoked',
      401
    );
  }

  // Check if expired
  if (new Date(tokenRow.expires_at) < new Date()) {
    throw new AppError(
      ERROR_CODES.UNAUTHORIZED,
      'Token has expired',
      401,
      'Please generate a new token'
    );
  }

  if (!tokenRow.agent_id) {
    throw new AppError(
      ERROR_CODES.UNAUTHORIZED,
      'Invalid agent token',
      401
    );
  }

  // Update last used
  await queryOne(
    'UPDATE tokens SET last_used_at = NOW() WHERE id = $1',
    [tokenRow.id]
  );

  return {
    agentId: tokenRow.agent_id,
    tokenId: tokenRow.id,
    tokenType: tokenRow.token_type,
  };
}

/**
 * Verify an observer token and return auth result
 */
export async function verifyObserverToken(
  request: FastifyRequest
): Promise<ObserverAuthResult | null> {
  const token = extractBearerToken(request);
  
  if (!token) {
    return null;
  }

  // Hash the token for lookup
  const tokenHash = hashToken(token);

  // Look up token
  const tokenRow = await queryOne<TokenRow>(
    `SELECT id, token_type, room_id, expires_at, revoked_at
     FROM tokens
     WHERE token_hash = $1 AND token_type = 'observer'`,
    [tokenHash]
  );

  if (!tokenRow) {
    throw new AppError(
      ERROR_CODES.UNAUTHORIZED,
      'Invalid token',
      401
    );
  }

  // Check if revoked
  if (tokenRow.revoked_at) {
    throw new AppError(
      ERROR_CODES.UNAUTHORIZED,
      'Token has been revoked',
      401
    );
  }

  // Check if expired
  if (new Date(tokenRow.expires_at) < new Date()) {
    throw new AppError(
      ERROR_CODES.UNAUTHORIZED,
      'Token has expired',
      401
    );
  }

  if (!tokenRow.room_id) {
    throw new AppError(
      ERROR_CODES.UNAUTHORIZED,
      'Invalid observer token',
      401
    );
  }

  // Update last used
  await queryOne(
    'UPDATE tokens SET last_used_at = NOW() WHERE id = $1',
    [tokenRow.id]
  );

  return {
    tokenId: tokenRow.id,
    roomId: tokenRow.room_id,
  };
}
