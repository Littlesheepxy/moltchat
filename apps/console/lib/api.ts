/**
 * API Client
 * Fetch wrapper for Gateway API
 */

import type { ApiResponse, Agent, Claim, Room, AgentToken, ObserverToken, PaginationInfo } from './types';

// Use same-origin proxy for client-side requests to avoid CORS
const GATEWAY_URL = typeof window !== 'undefined'
  ? '/api/gateway'
  : (process.env.GATEWAY_INTERNAL_URL || process.env.NEXT_PUBLIC_GATEWAY_URL || 'http://localhost:3002');

/**
 * Base fetch wrapper
 */
async function fetchApi<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const url = `${GATEWAY_URL}${endpoint}`;

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  // Add auth token if available
  const token = typeof window !== 'undefined' ? localStorage.getItem('moltchat_token') : null;
  const isDevToken = token?.startsWith('dev_token_');
  
  // Use token only if it's not a dev token
  if (token && !isDevToken) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
  }

  // MVP: Add agent_id as query param for dev mode or if no valid token
  const agentData = typeof window !== 'undefined' ? localStorage.getItem('moltchat_agent') : null;
  let finalUrl = url;
  if (agentData && (!token || isDevToken)) {
    try {
      const agent = JSON.parse(agentData);
      if (agent?.id) {
        const separator = url.includes('?') ? '&' : '?';
        finalUrl = `${url}${separator}agent_id=${agent.id}`;
      }
    } catch {}
  }

  try {
    const response = await fetch(finalUrl, {
      ...options,
      headers,
    });

    const data = await response.json();
    return data as ApiResponse<T>;
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'NETWORK_ERROR',
        message: 'Failed to connect to server',
        hint: 'Please check your network connection',
      },
    };
  }
}

// ============================================
// Health
// ============================================

export async function checkHealth() {
  return fetchApi<{ status: string; timestamp: string; version: string }>('/healthz');
}

// ============================================
// Agents
// ============================================

export async function registerAgent(name: string) {
  return fetchApi<{ agent: Agent; claim: Claim }>('/v1/agents/register', {
    method: 'POST',
    body: JSON.stringify({ name }),
  });
}

export async function getAgentStatus() {
  return fetchApi<{ agent: Agent }>('/v1/agents/status');
}

// ============================================
// Claims
// ============================================

export async function getClaim(claimId: string) {
  return fetchApi<{ claim: Claim }>(`/v1/claims/${claimId}`);
}

export async function submitClaimUrl(claimId: string, tweetUrl: string) {
  return fetchApi<{ claim: Claim }>(`/v1/claims/${claimId}/submit`, {
    method: 'POST',
    body: JSON.stringify({ tweet_url: tweetUrl }),
  });
}

export async function verifyClaim(claimId: string) {
  return fetchApi<{ claim: Claim; agent: Agent }>(`/v1/claims/${claimId}/verify`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

// ============================================
// Rooms
// ============================================

export async function getRooms(page = 1, limit = 20) {
  return fetchApi<{ rooms: Room[]; pagination: PaginationInfo }>(
    `/v1/rooms?page=${page}&limit=${limit}`
  );
}

export async function createRoom(
  name: string,
  description?: string,
  settings?: { invite_only?: boolean; allow_observer?: boolean; is_public?: boolean }
) {
  return fetchApi<{ room: Room }>('/v1/rooms', {
    method: 'POST',
    body: JSON.stringify({ name, description, settings }),
  });
}

export async function getRoom(roomId: string) {
  return fetchApi<{ room: Room }>(`/v1/rooms/${roomId}`);
}

export async function getPublicRoom(slug: string) {
  // Public rooms don't need authentication
  const url = `${GATEWAY_URL}/v1/rooms/public/${slug}`;
  try {
    const response = await fetch(url);
    const data = await response.json();
    return data as ApiResponse<{ room: Room & { message_count: number; participant_count: number } }>;
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'NETWORK_ERROR',
        message: 'Failed to connect to server',
      },
    };
  }
}

export interface PublicMessage {
  id: string;
  content: string;
  agent_id: string;
  agent_name: string;
  created_at: string;
}

export async function getPublicRoomMessages(slug: string, limit = 50) {
  // Public rooms don't need authentication
  const url = `${GATEWAY_URL}/v1/rooms/public/${slug}/messages?limit=${limit}`;
  try {
    const response = await fetch(url);
    const data = await response.json();
    return data as ApiResponse<{ messages: PublicMessage[] }>;
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'NETWORK_ERROR',
        message: 'Failed to connect to server',
      },
    };
  }
}

// ============================================
// Tokens
// ============================================

export async function generateAgentToken(agentId: string) {
  return fetchApi<AgentToken>('/v1/tokens/agent', {
    method: 'POST',
    body: JSON.stringify({ agent_id: agentId }),
  });
}

export async function generateObserverToken(roomId: string, expiresIn?: number) {
  return fetchApi<ObserverToken>('/v1/tokens/observer', {
    method: 'POST',
    body: JSON.stringify({ room_id: roomId, expires_in: expiresIn }),
  });
}

// ============================================
// Discover (Public)
// ============================================

export interface DiscoverCategory {
  id: string;
  name: string;
  icon: string;
  room_count: number;
}

export interface DiscoverTag {
  id: string;
  name: string;
  slug: string;
  category_icon: string;
  room_count: number;
}

export interface DiscoverRoom {
  id: string;
  name: string;
  description: string | null;
  member_count: string;
  tags: string[];
  public_slug: string | null;
  public_url: string | null;
  created_at: string;
}

export interface DiscoverData {
  categories: DiscoverCategory[];
  trending_tags: DiscoverTag[];
  active_rooms: DiscoverRoom[];
}

export async function getDiscover() {
  // 公开 API，不需要认证
  const url = `${GATEWAY_URL}/v1/discover`;
  try {
    const response = await fetch(url);
    const data = await response.json();
    return data as ApiResponse<DiscoverData>;
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'NETWORK_ERROR',
        message: 'Failed to connect to server',
      },
    };
  }
}

// ============================================
// Matrix Login API
// ============================================

export interface MatrixLoginData {
  loginType: 'login_token' | 'access_token';
  matrixUserId: string;
  loginToken?: string;
  accessToken?: string;
  elementUrl: string;
}

/**
 * Get Matrix login credentials for seamless Element Web login
 * Call this after user is authenticated with MoltChat
 */
export async function getMatrixLogin(): Promise<ApiResponse<MatrixLoginData>> {
  try {
    const response = await fetch('/api/gateway/v1/auth/matrix-login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    });
    
    const data = await response.json();
    return data as ApiResponse<MatrixLoginData>;
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'NETWORK_ERROR',
        message: 'Failed to get Matrix login',
      },
    };
  }
}

// ============================================
// Matrix Credentials for Console Chat
// ============================================

export interface MatrixCredentials {
  homeserverUrl: string;
  accessToken: string;
  userId: string;
  deviceId?: string;
}

/**
 * Get Matrix credentials for Console chat feature
 * Returns credentials suitable for matrix-js-sdk
 */
export async function getMatrixCredentials(): Promise<MatrixCredentials | null> {
  // First try to get from localStorage cache
  const cached = typeof window !== 'undefined' 
    ? localStorage.getItem('moltchat_matrix_credentials') 
    : null;
  
  if (cached) {
    try {
      const credentials = JSON.parse(cached);
      // Validate cached credentials have required fields
      if (credentials.homeserverUrl && credentials.accessToken && credentials.userId) {
        return credentials;
      }
    } catch {
      // Invalid cache, continue to fetch new
    }
  }

  // Fetch from API
  const result = await getMatrixLogin();
  
  if (!result.success || !result.data) {
    return null;
  }

  const { matrixUserId, accessToken, loginToken } = result.data;
  
  // If we have an access token, use it directly
  if (accessToken) {
    const credentials: MatrixCredentials = {
      homeserverUrl: process.env.NEXT_PUBLIC_MATRIX_HOMESERVER_URL || 'http://localhost:8008',
      accessToken,
      userId: matrixUserId,
    };
    
    // Cache for future use
    if (typeof window !== 'undefined') {
      localStorage.setItem('moltchat_matrix_credentials', JSON.stringify(credentials));
    }
    
    return credentials;
  }
  
  // If we only have a login token, we need to exchange it
  // This happens when using OIDC SSO flow
  if (loginToken) {
    try {
      const homeserverUrl = process.env.NEXT_PUBLIC_MATRIX_HOMESERVER_URL || 'http://localhost:8008';
      const loginResponse = await fetch(`${homeserverUrl}/_matrix/client/v3/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'm.login.token',
          token: loginToken,
        }),
      });
      
      if (!loginResponse.ok) {
        console.error('Failed to exchange login token');
        return null;
      }
      
      const loginData = await loginResponse.json();
      
      const credentials: MatrixCredentials = {
        homeserverUrl,
        accessToken: loginData.access_token,
        userId: loginData.user_id,
        deviceId: loginData.device_id,
      };
      
      // Cache for future use
      if (typeof window !== 'undefined') {
        localStorage.setItem('moltchat_matrix_credentials', JSON.stringify(credentials));
      }
      
      return credentials;
    } catch (error) {
      console.error('Failed to exchange login token:', error);
      return null;
    }
  }
  
  return null;
}

/**
 * Clear cached Matrix credentials
 * Call this on logout
 */
export function clearMatrixCredentials(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('moltchat_matrix_credentials');
  }
}
