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
      credentials: 'include',
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
  settings?: { invite_only?: boolean; allow_observer?: boolean; is_public?: boolean },
  tag_slugs?: string[]
) {
  return fetchApi<{ room: Room }>('/v1/rooms', {
    method: 'POST',
    body: JSON.stringify({ name, description, settings, ...(tag_slugs?.length ? { tag_slugs } : {}) }),
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

// ============================================
// Networking — Activities & AI Explorations
// ============================================

export interface Activity {
  id: string;
  name: string;
  description: string | null;
  theme: string | null;
  cover_image: string | null;
  status: string;
  max_participants: number;
  is_anonymous: boolean;
  starts_at: string | null;
  ends_at: string | null;
  created_at: string;
  participant_count: number;
  user_joined: boolean;
}

export interface ActivityDetail extends Activity {
  ai_explore_rounds: number;
  decision_deadline_hours: number;
  chat_expiry_hours: number;
}

export interface MyParticipation {
  roles: string[];
  looking_for: string;
  can_offer: string;
  tags: string[];
}

export interface ExplorationStats {
  total: number;
  pending_review: number;
  completed: number;
}

export interface ExplorationItem {
  id: string;
  status: string;
  total_rounds: number;
  max_rounds: number;
  match_score: number | null;
  match_highlights: string[];
  summary: string | null;
  summary_preview: string | null;
  collaboration_potential: string | null;
  my_decision: string;
  other_decision: string;
  chat_requested_by: string | null;
  dm_request_id: string | null;
  reveal_level: number;
  other_party: {
    roles: string[];
    tags: string[];
    looking_for: string | null;
    industry: string | null;
  };
  created_at: string;
  completed_at: string | null;
}

export interface ExplorationDetail {
  exploration: {
    id: string;
    activity_id: string | null;
    source?: string;
    status: string;
    match_score: number | null;
    match_highlights: string[];
    summary: string | null;
    collaboration_potential: string | null;
    my_decision: string;
    other_decision: string;
    chat_requested_by: string | null;
    dm_request_id: string | null;
    total_rounds: number;
    max_rounds: number;
    other_party: {
      roles: string[];
      looking_for: string | null;
      can_offer: string | null;
      tags: string[];
      industry: string | null;
      display_name: string | null;
      job_title?: string | null;
    };
  };
  messages: {
    id: string;
    round: number;
    side: string;
    is_mine: boolean;
    content: string;
    created_at: string;
  }[];
}

// ============================================
// My Explorations (aggregated across all sources)
// ============================================

export interface MyExplorationItem {
  id: string;
  source: string;
  status: string;
  total_rounds: number;
  max_rounds: number;
  match_score: number | null;
  match_highlights: string[];
  summary: string | null;
  collaboration_potential: string | null;
  my_decision: string;
  other_decision: string;
  chat_requested_by: string | null;
  dm_request_id: string | null;
  other_party: {
    display_name: string | null;
    industry: string | null;
    job_title: string | null;
  };
  context: {
    room_name: string | null;
    room_id: string | null;
    activity_name: string | null;
    activity_id: string | null;
  };
  created_at: string;
  completed_at: string | null;
}

export interface MyExplorationsStats {
  total: number;
  pending_decision: number;
  in_progress: number;
  decided: number;
}

export async function getMyExplorations(filter: string = 'all', limit = 20, offset = 0) {
  return fetchApi<{ stats: MyExplorationsStats; explorations: MyExplorationItem[] }>(
    `/v1/my/explorations?filter=${filter}&limit=${limit}&offset=${offset}`
  );
}

export async function getActivities(status?: string) {
  const params = status ? `?status=${status}` : '';
  return fetchApi<{ activities: Activity[] }>(`/v1/activities${params}`);
}

export async function getActivity(id: string) {
  return fetchApi<{
    activity: ActivityDetail;
    my_participation: MyParticipation | null;
    exploration_stats: ExplorationStats;
  }>(`/v1/activities/${id}`);
}

export async function joinActivity(activityId: string, data: {
  roles: string[];
  looking_for: string;
  can_offer: string;
  tags?: string[];
}) {
  return fetchApi<{ participant_id: string }>(`/v1/activities/${activityId}/join`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function getExplorations(activityId: string, filter: string = 'all') {
  return fetchApi<{ explorations: ExplorationItem[] }>(
    `/v1/activities/${activityId}/explorations?filter=${filter}`
  );
}

export async function getExploration(explorationId: string) {
  return fetchApi<ExplorationDetail>(`/v1/explorations/${explorationId}`);
}

export interface ExplorationMessage {
  id: string;
  round: number;
  side: string;
  is_mine: boolean;
  content: string;
  created_at: string;
}

export interface ExplorationStatus {
  id: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'timed_out';
  total_rounds: number;
  max_rounds: number;
  match_score: number | null;
  my_decision: string;
  other_party_name: string | null;
}

export async function getExplorationStatus(explorationId: string) {
  return fetchApi<{ exploration: ExplorationStatus; messages: ExplorationMessage[] }>(
    `/v1/explorations/${explorationId}`
  );
}

export async function submitDecision(explorationId: string, decision: 'want_chat' | 'pass', reason?: string) {
  return fetchApi<{ decision: string; mutual_match?: boolean; dm_request_id?: string; dm_session_id?: string }>(
    `/v1/explorations/${explorationId}/decide`,
    {
      method: 'POST',
      body: JSON.stringify({ decision, reason }),
    }
  );
}

export async function respondToExploration(explorationId: string, action: 'accept' | 'reject', reason?: string) {
  return fetchApi<{ action: string; dm_session_id?: string }>(
    `/v1/explorations/${explorationId}/respond`,
    {
      method: 'POST',
      body: JSON.stringify({ action, reason }),
    }
  );
}

// ============================================
// DM Prescreenings
// ============================================

export async function getDMPrescreenings(filter: string = 'all') {
  return fetchApi<{ prescreenings: ExplorationItem[] }>(
    `/v1/dm/prescreenings?filter=${filter}`
  );
}

export async function decideDMPrescreening(explorationId: string, decision: 'want_chat' | 'pass', reason?: string) {
  return fetchApi<{ decision: string; mutual_match?: boolean; dm_session_id?: string }>(
    `/v1/dm/prescreenings/${explorationId}/decide`,
    {
      method: 'POST',
      body: JSON.stringify({ decision, reason }),
    }
  );
}

// ============================================
// Market Protocol
// ============================================

export interface BudgetCheck {
  allowed: boolean;
  used: number;
  limit: number;
  remaining: number;
}

export interface BudgetStatus {
  inbound: BudgetCheck;
  outbound_unlimited: true;
  week_start: string;
  preferences: {
    inbound_limit: number;
    overflow_policy: 'queue' | 'reject';
    priority_by_reputation: boolean;
  };
}

export interface ReputationProfile {
  reputation_score: number;
  hit_rate: number;
  avg_post_chat_rating: number | null;
  in_cooldown: boolean;
}

export interface ReputationEvent {
  id: string;
  event_type: string;
  points_delta: number;
  reference_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface AlignmentResult {
  alignment: {
    score: number;
    passed: boolean;
    details: {
      intent_match: number;
      value_exchange: number;
      industry_overlap: number;
      tag_overlap: number;
      behavior_history: number;
      final_score: number;
    };
  };
  threshold: number;
  would_pass: boolean;
}

export async function getProtocolBudget() {
  return fetchApi<BudgetStatus>('/v1/protocol/budget');
}

export async function getProtocolReputation() {
  return fetchApi<ReputationProfile>('/v1/protocol/reputation');
}

export async function getReputationEvents(limit = 50) {
  return fetchApi<{ events: ReputationEvent[] }>(`/v1/protocol/reputation/events?limit=${limit}`);
}

export async function previewAlignment(targetUserId: string, activityId?: string) {
  return fetchApi<AlignmentResult>('/v1/protocol/alignment/preview', {
    method: 'POST',
    body: JSON.stringify({ target_user_id: targetUserId, activity_id: activityId }),
  });
}

export async function rateDmSession(sessionId: string, rating: number, outcome: 'valuable' | 'neutral' | 'waste') {
  return fetchApi<{ session_id: string; rating: number; outcome: string; side: string }>(
    `/v1/dm/sessions/${sessionId}/rate`,
    {
      method: 'POST',
      body: JSON.stringify({ rating, outcome }),
    }
  );
}

// ============================================
// Protocol Rules (Public)
// ============================================

export interface ProtocolRule {
  id: string;
  rule_key: string;
  version: number;
  title: string;
  content_md: string;
  change_summary: string | null;
  is_current: boolean;
  created_at: string;
}

export interface PromptTemplate {
  id: string;
  prompt_key: string;
  version: number;
  title: string;
  template_md: string;
  variables: string[];
  change_summary: string | null;
  is_current: boolean;
  created_at: string;
}

export interface RuleFeedbackItem {
  id: string;
  rule_id: string;
  user_id: string;
  author_name?: string;
  feedback_type: string;
  content: string;
  upvotes: number;
  downvotes: number;
  status: string;
  created_at: string;
}

export async function getProtocolRules() {
  return fetchApi<{ rules: ProtocolRule[] }>('/v1/protocol/rules');
}

export async function getProtocolRule(key: string) {
  return fetchApi<{ rule: ProtocolRule; versions: { version: number; change_summary: string | null; created_at: string }[] }>(
    `/v1/protocol/rules/${key}`
  );
}

export async function getProtocolPrompts() {
  return fetchApi<{ prompts: PromptTemplate[] }>('/v1/protocol/prompts');
}

export async function getRuleFeedback(ruleId: string) {
  return fetchApi<{ feedback: RuleFeedbackItem[] }>(`/v1/protocol/rules/${ruleId}/feedback`);
}

export async function submitRuleFeedback(ruleId: string, feedbackType: string, content: string) {
  return fetchApi<{ feedback: RuleFeedbackItem }>(`/v1/protocol/rules/${ruleId}/feedback`, {
    method: 'POST',
    body: JSON.stringify({ feedback_type: feedbackType, content }),
  });
}

export async function voteOnFeedback(feedbackId: string, vote: 1 | -1) {
  return fetchApi<{ voted: number }>(`/v1/protocol/feedback/${feedbackId}/vote`, {
    method: 'POST',
    body: JSON.stringify({ vote }),
  });
}

// ============================================
// Admin API
// ============================================

export interface AdminGrant {
  id: string;
  user_id?: string;
  user_name?: string | null;
  user_email?: string | null;
  scope: string;
  theme: string | null;
  created_at: string;
}

export interface AdminMe {
  is_super_admin: boolean;
  grants: AdminGrant[];
}

export async function getAdminMe() {
  return fetchApi<AdminMe>('/v1/admin/me');
}

export async function searchAdminUsers(q: string) {
  return fetchApi<{ users: { id: string; name: string | null; email: string | null; is_admin: boolean; created_at: string }[] }>(
    `/v1/admin/users?q=${encodeURIComponent(q)}`
  );
}

export async function getAdminGrants() {
  return fetchApi<{ grants: AdminGrant[] }>('/v1/admin/grants');
}

export async function createAdminGrant(userId: string, scope: 'battles' | 'rooms' | 'all', theme?: string) {
  return fetchApi<{ grant: AdminGrant }>('/v1/admin/grants', {
    method: 'POST',
    body: JSON.stringify({ user_id: userId, scope, theme }),
  });
}

export async function deleteAdminGrant(grantId: string) {
  return fetchApi<void>(`/v1/admin/grants/${grantId}`, { method: 'DELETE' });
}

// ============================================
// Battle Events API
// ============================================

export interface BattleEvent {
  id: string;
  title: string;
  description: string | null;
  theme: string | null;
  status: 'open' | 'matching' | 'completed' | 'cancelled';
  starts_at: string | null;
  ends_at: string | null;
  max_participants: number;
  participant_count?: number;
  created_at: string;
}

export interface BattleResult {
  exploration_id: string;
  agent_a_name: string | null;
  agent_b_name: string | null;
  owner_a_name: string | null;
  owner_b_name: string | null;
  match_score: number | null;
  status: string;
  decision_a: string;
  decision_b: string;
  is_public: boolean;
  completed_at: string | null;
}

export async function getBattles(status?: string) {
  const qs = status ? `?status=${status}` : '';
  return fetchApi<{ battles: BattleEvent[] }>(`/v1/battles${qs}`);
}

export async function getBattle(id: string) {
  return fetchApi<{
    battle: BattleEvent;
    participants: { owner_id: string; display_name: string | null; agent_name: string | null; joined_at: string }[];
  }>(`/v1/battles/${id}`);
}

export async function getBattleResults(id: string) {
  return fetchApi<{ results: BattleResult[] }>(`/v1/battles/${id}/results`);
}

export async function createBattle(data: {
  title: string;
  description?: string;
  theme?: string;
  starts_at?: string;
  ends_at?: string;
  max_participants?: number;
}) {
  return fetchApi<{ battle: BattleEvent }>('/v1/battles', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function joinBattle(id: string) {
  return fetchApi<{ success: boolean }>(`/v1/battles/${id}/join`, { method: 'POST' });
}

export async function leaveBattle(id: string) {
  return fetchApi<void>(`/v1/battles/${id}/join`, { method: 'DELETE' });
}

export async function triggerBattleMatch(id: string) {
  return fetchApi<{ created: number; total_participants: number }>(`/v1/battles/${id}/match`, {
    method: 'POST',
  });
}

export async function completeBattle(id: string) {
  return fetchApi<{ success: boolean }>(`/v1/battles/${id}/complete`, { method: 'POST' });
}

// ============================================
// Public Exploration API
// ============================================

export interface PublicExploration {
  id: string;
  status: string;
  is_public: boolean;
  match_score: number | null;
  match_highlights: string[];
  collaboration_potential: string | null;
  total_rounds: number;
  max_rounds: number;
  decision_a: string;
  decision_b: string;
  completed_at: string | null;
  created_at: string;
  agent_a_name: string | null;
  agent_b_name: string | null;
  owner_a_name: string | null;
  owner_b_name: string | null;
}

export async function getPublicExploration(id: string) {
  return fetchApi<{
    exploration: PublicExploration;
    messages: ExplorationMessage[];
  }>(`/v1/explorations/${id}/public`);
}

export async function setExplorationPublic(id: string, isPublic: boolean) {
  return fetchApi<{ success: boolean; is_public: boolean }>(`/v1/explorations/${id}/public`, {
    method: 'PATCH',
    body: JSON.stringify({ is_public: isPublic }),
  });
}
