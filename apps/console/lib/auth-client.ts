/**
 * Better Auth Client Configuration
 * Client-side auth utilities for React
 */

import { createAuthClient } from "better-auth/react";
import { oidcClient } from "better-auth/client/plugins";

// Resolve baseURL: prefer env var, but fall back to current origin at runtime
// This ensures the auth client always points to the correct domain
// even when NEXT_PUBLIC_APP_URL is missing or wrong at build time
const getBaseURL = () => {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  if (typeof window !== 'undefined') return window.location.origin;
  return 'http://localhost:3000';
};

// Create auth client with OIDC support
export const authClient = createAuthClient({
  baseURL: getBaseURL(),
  plugins: [
    oidcClient(),
  ],
});

// Export commonly used hooks and methods
export const {
  signIn,
  signOut,
  signUp,
  useSession,
  getSession,
} = authClient;

// Save redirect target before OAuth redirect
function saveRedirectTarget(target: string) {
  if (typeof window !== 'undefined') {
    localStorage.setItem('moltchat_redirect_after_login', target);
  }
}

// Google sign-in helper (primary)
export const signInWithGoogle = (redirectTo?: string) => {
  const target = redirectTo || "/chat";
  saveRedirectTarget(target);
  return signIn.social({ provider: "google", callbackURL: target });
};

// X/Twitter sign-in helper (kept for backward compatibility, hidden from UI)
export const signInWithTwitter = (redirectTo?: string) => {
  const target = redirectTo || "/chat";
  saveRedirectTarget(target);
  return signIn.social({ provider: "twitter", callbackURL: target });
};

// Helper type for session user
export type SessionUser = {
  id: string;
  name: string;
  email: string;
  image?: string;
};
