/**
 * Better Auth Server Configuration
 * X/Twitter OAuth for human owners
 */

import { betterAuth } from "better-auth";
import { Pool } from "pg";

// Base URL for auth callbacks
const baseURL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

// Create PostgreSQL connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export const auth = betterAuth({
  // Database configuration using pg Pool
  database: pool,

  // Base URL for auth endpoints
  baseURL,

  // Session configuration
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // 1 day
    cookieCache: {
      enabled: true,
      maxAge: 60 * 5, // 5 minutes
    },
  },

  // Social OAuth providers - Only X/Twitter for now
  socialProviders: {
    twitter: {
      clientId: process.env.TWITTER_CLIENT_ID!,
      clientSecret: process.env.TWITTER_CLIENT_SECRET!,
    },
  },

  // Advanced configuration
  advanced: {
    // Generate consistent session tokens
    generateId: () => crypto.randomUUID(),
    
    // Cookie settings
    cookiePrefix: "moltchat",
    
    // Use secure cookies in production
    useSecureCookies: process.env.NODE_ENV === "production",
  },

  // Trusted origins for CORS
  trustedOrigins: [
    baseURL,
    process.env.NEXT_PUBLIC_GATEWAY_URL || "http://localhost:3001",
  ],
});

// Export type for client usage
export type Auth = typeof auth;
