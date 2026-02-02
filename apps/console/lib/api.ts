/**
 * API Client
 * Fetch wrapper for Gateway API
 */

import type { ApiResponse, Agent, Claim, Room, AgentToken, ObserverToken, PaginationInfo } from './types';

const GATEWAY_URL = process.env.NEXT_PUBLIC_GATEWAY_URL || 'http://localhost:3001';

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
  if (token) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
  }

  // MVP: Also add agent_id as query param for easier testing
  const agentData = typeof window !== 'undefined' ? localStorage.getItem('moltchat_agent') : null;
  let finalUrl = url;
  if (agentData && !token) {
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
  settings?: { invite_only?: boolean; allow_observer?: boolean }
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
