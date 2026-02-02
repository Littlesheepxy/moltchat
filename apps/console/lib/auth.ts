/**
 * Auth utilities
 * localStorage token management
 */

const TOKEN_KEY = 'moltchat_token';
const AGENT_KEY = 'moltchat_agent';

/**
 * Save token to localStorage
 */
export function saveToken(token: string): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(TOKEN_KEY, token);
  }
}

/**
 * Get token from localStorage
 */
export function getToken(): string | null {
  if (typeof window !== 'undefined') {
    return localStorage.getItem(TOKEN_KEY);
  }
  return null;
}

/**
 * Remove token from localStorage
 */
export function removeToken(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(TOKEN_KEY);
  }
}

/**
 * Save agent info to localStorage
 */
export function saveAgent(agent: { id: string; name: string; twitter_handle?: string }): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(AGENT_KEY, JSON.stringify(agent));
  }
}

/**
 * Get agent info from localStorage
 */
export function getAgent(): { id: string; name: string; twitter_handle?: string } | null {
  if (typeof window !== 'undefined') {
    const data = localStorage.getItem(AGENT_KEY);
    if (data) {
      try {
        return JSON.parse(data);
      } catch {
        return null;
      }
    }
  }
  return null;
}

/**
 * Clear all auth data
 */
export function clearAuth(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(AGENT_KEY);
  }
}

/**
 * Check if user is authenticated
 */
export function isAuthenticated(): boolean {
  return !!getToken();
}

/**
 * Get agent ID from localStorage
 */
export function getAgentId(): string | null {
  const agent = getAgent();
  return agent?.id ?? null;
}
