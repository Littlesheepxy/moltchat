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

interface SessionRow {
  id: string;
  user_id: string;
  token: string;
  expires_at: Date;
}

interface UserRow {
  id: string;
  name: string;
  email: string;
  image: string | null;
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

export interface SessionAuthResult {
  userId: string;
  sessionId: string;
  user: {
    id: string;
    name: string;
    email: string;
    image: string | null;
  };
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
    // MVP bypass: Allow agent_id query param in development mode only
    // This should be disabled in production
    const allowMvpBypass = config.isDev || process.env.ALLOW_MVP_BYPASS === 'true';
    
    if (allowMvpBypass) {
      const agentId = (request.query as { agent_id?: string }).agent_id;
      if (agentId) {
        // In dev mode, allow any agent_id starting with 'dev_' without DB check
        if (agentId.startsWith('dev_')) {
          return {
            agentId: agentId,
            tokenId: 'mvp-bypass-dev',
            tokenType: 'agent',
          };
        }
        
        // For non-dev agent IDs, verify agent exists in DB
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

// ============================================
// Session Authentication (for human owners)
// ============================================

/**
 * Extract session token from request cookie
 */
export function extractSessionToken(request: FastifyRequest): string | null {
  const cookies = request.headers.cookie;
  if (!cookies) return null;

  // Better Auth uses 'moltchat.session_token' cookie
  const sessionCookie = cookies
    .split(';')
    .find(c => c.trim().startsWith('moltchat.session_token='));
  
  if (!sessionCookie) return null;
  
  const token = sessionCookie.split('=')[1];
  return token ? decodeURIComponent(token.trim()) : null;
}

/**
 * Verify user session and return auth result
 * Returns null if no session, throws if session is invalid
 */
export async function verifyUserSession(
  request: FastifyRequest
): Promise<SessionAuthResult | null> {
  const sessionToken = extractSessionToken(request);
  
  if (!sessionToken) {
    // MVP bypass: Allow user_id query param in development mode only
    const allowMvpBypass = config.isDev || process.env.ALLOW_MVP_BYPASS === 'true';
    
    if (allowMvpBypass) {
      const userId = (request.query as { user_id?: string }).user_id;
      if (userId) {
        // Verify user exists
        const user = await queryOne<UserRow>(
          'SELECT id, name, email, image FROM users WHERE id = $1',
          [userId]
        );
        if (user) {
          return {
            userId: user.id,
            sessionId: 'mvp-bypass',
            user: {
              id: user.id,
              name: user.name,
              email: user.email,
              image: user.image,
            },
          };
        }
      }
    }
    return null;
  }

  // Look up session
  const session = await queryOne<SessionRow>(
    `SELECT id, user_id, token, expires_at
     FROM sessions
     WHERE token = $1`,
    [sessionToken]
  );

  if (!session) {
    throw new AppError(
      ERROR_CODES.UNAUTHORIZED,
      'Invalid session',
      401,
      'Please sign in again'
    );
  }

  // Check if expired
  if (new Date(session.expires_at) < new Date()) {
    throw new AppError(
      ERROR_CODES.UNAUTHORIZED,
      'Session has expired',
      401,
      'Please sign in again'
    );
  }

  // Get user info
  const user = await queryOne<UserRow>(
    'SELECT id, name, email, image FROM users WHERE id = $1',
    [session.user_id]
  );

  if (!user) {
    throw new AppError(
      ERROR_CODES.UNAUTHORIZED,
      'User not found',
      401
    );
  }

  // Update session last activity
  await queryOne(
    'UPDATE sessions SET updated_at = NOW() WHERE id = $1',
    [session.id]
  );

  return {
    userId: user.id,
    sessionId: session.id,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      image: user.image,
    },
  };
}
