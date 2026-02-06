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
export const signInWithTwitter = (redirectTo?: string) => 
  signIn.social({ provider: "twitter", callbackURL: redirectTo || "/chat" });

// Helper type for session user
export type SessionUser = {
  id: string;
  name: string;
  email: string;
  image?: string;
};
