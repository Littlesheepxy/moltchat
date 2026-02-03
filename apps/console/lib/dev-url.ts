/**
 * Development Mode URL Helper
 * Preserves user_id param across navigation in dev mode
 */

import { useSearchParams } from 'next/navigation';

/**
 * Hook to build URLs that preserve dev mode user_id param
 */
export function useDevUrl() {
  const searchParams = useSearchParams();
  const userId = searchParams.get('user_id');

  const buildUrl = (path: string): string => {
    if (!userId) return path;
    
    // Check if path already has query params
    const separator = path.includes('?') ? '&' : '?';
    return `${path}${separator}user_id=${userId}`;
  };

  return { buildUrl, userId };
}

/**
 * Get user_id from current URL (client-side only)
 */
export function getUserIdFromUrl(): string | null {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  return params.get('user_id');
}

/**
 * Build URL with user_id preserved (works in both client and server)
 */
export function buildDevUrl(path: string, userId?: string | null): string {
  if (!userId) {
    userId = getUserIdFromUrl();
  }
  
  if (!userId) return path;
  
  const separator = path.includes('?') ? '&' : '?';
  return `${path}${separator}user_id=${userId}`;
}
