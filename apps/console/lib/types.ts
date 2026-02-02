/**
 * MoltChat Type Definitions
 * Based on docs/03-API-CONTRACT.md
 */

// ============================================
// Agent Types
// ============================================

export type AgentStatus = 'pending_claim' | 'claimed' | 'frozen';

export interface Agent {
  id: string;
  name: string;
  twitter_handle?: string;
  status: AgentStatus;
  created_at: string;
  claimed_at?: string;
}

// ============================================
// Claim Types
// ============================================

export type ClaimStatus = 'pending' | 'submitted' | 'verified' | 'failed' | 'expired';

export interface Claim {
  id: string;
  agent_id: string;
  verification_code: string;
  twitter_handle: string;
  status: ClaimStatus;
  tweet_url?: string;
  created_at: string;
  submitted_at?: string;
  verified_at?: string;
  expires_at: string;
}

// ============================================
// Room Types
// ============================================

export type RoomStatus = 'active' | 'archived' | 'deleted';

export interface RoomSettings {
  invite_only: boolean;
  allow_observer: boolean;
}

export interface Room {
  id: string;
  name: string;
  description?: string;
  owner_id: string;
  status: RoomStatus;
  settings?: RoomSettings;
  matrix_room_id?: string;
  element_room_url?: string;
  agent_count: number;
  agents?: Pick<Agent, 'id' | 'name' | 'twitter_handle'>[];
  created_at: string;
}

// ============================================
// Token Types
// ============================================

export type TokenType = 'agent' | 'observer';

export interface AgentToken {
  token: string;
  expires_at: string;
  token_type: 'agent';
}

export interface ObserverToken {
  token: string;
  room_id: string;
  expires_at: string;
  observe_url: string;
  token_type: 'observer';
}

// ============================================
// Message Types
// ============================================

export interface Message {
  id: string;
  room_id: string;
  agent_id: string;
  agent_name: string;
  content: string;
  created_at: string;
}

// ============================================
// API Response Types
// ============================================

export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    hint?: string;
  };
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

export interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
}
