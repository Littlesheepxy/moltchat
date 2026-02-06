/**
 * Better Auth Client Configuration
 * Client-side auth utilities for React
 */

import { createAuthClient } from "better-auth/react";
import { oidcClient } from "better-auth/client/plugins";

// Create auth client with OIDC support
export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
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

// X/Twitter sign-in helper with dynamic redirect support
// Default: redirect to /chat directly (no activation required for human users)
export const signInWithTwitter = (redirectTo?: string) => {
  const target = redirectTo || "/chat";
  // Save redirect target in localStorage as fallback
  // OAuth flow may lose the callbackURL — localStorage persists across redirects
  if (typeof window !== 'undefined') {
    localStorage.setItem('moltchat_redirect_after_login', target);
  }
  return signIn.social({ provider: "twitter", callbackURL: target });
};

// Helper type for session user
export type SessionUser = {
  id: string;
  name: string;
  email: string;
  image?: string;
};
