/**
 * Better Auth Server Configuration
 * X/Twitter OAuth for human owners
 * OIDC Provider for Matrix Synapse SSO
 */

import { betterAuth } from "better-auth";
import { oidcProvider, jwt } from "better-auth/plugins";
import { Pool } from "pg";

// Base URL for auth callbacks
const baseURL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

// Synapse OIDC configuration
const SYNAPSE_CLIENT_ID = process.env.SYNAPSE_OIDC_CLIENT_ID || "synapse";
const SYNAPSE_CLIENT_SECRET = process.env.SYNAPSE_OIDC_CLIENT_SECRET || "synapse-oidc-secret-change-me";
const SYNAPSE_REDIRECT_URI = process.env.SYNAPSE_OIDC_REDIRECT_URI || "http://localhost:8008/_synapse/client/oidc/callback";

// Create PostgreSQL connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export const auth = betterAuth({
  // Database configuration using pg Pool
  database: pool,

  // Base URL for auth endpoints
  baseURL,

  // Disable /token endpoint for OIDC Provider mode (use /oauth2/token instead)
  disabledPaths: ["/token"],

  // Custom table names (use plural form to match our schema)
  user: {
    modelName: "users",
    fields: {
      createdAt: "created_at",
      updatedAt: "updated_at",
      emailVerified: "email_verified",
    },
  },
  account: {
    modelName: "accounts",
    fields: {
      userId: "user_id",
      accountId: "account_id",
      providerId: "provider_id",
      accessToken: "access_token",
      refreshToken: "refresh_token",
      accessTokenExpiresAt: "access_token_expires_at",
      refreshTokenExpiresAt: "refresh_token_expires_at",
      idToken: "id_token",
      createdAt: "created_at",
      updatedAt: "updated_at",
    },
  },
  verification: {
    modelName: "verifications",
    fields: {
      expiresAt: "expires_at",
      createdAt: "created_at",
      updatedAt: "updated_at",
    },
  },

  // Session configuration
  session: {
    modelName: "sessions",
    fields: {
      userId: "user_id",
      expiresAt: "expires_at",
      ipAddress: "ip_address",
      userAgent: "user_agent",
      createdAt: "created_at",
      updatedAt: "updated_at",
    },
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

  // Plugins
  plugins: [
    // JWT plugin for asymmetric key signing (required for OIDC JWKS)
    jwt({
      // Disable setting JWT header for OIDC Provider mode
      disableSettingJwtHeader: true,
      // Use EdDSA (Ed25519) - default and recommended
      jwks: {
        keyPairConfig: {
          alg: "EdDSA",
          crv: "Ed25519",
        },
      },
      jwt: {
        issuer: baseURL,
        audience: baseURL,
        expirationTime: "1h",
      },
    }),
    
    // OIDC Provider for Matrix Synapse SSO
    oidcProvider({
      // Login page path
      loginPage: "/login",
      
      // Use JWT plugin for asymmetric signing (provides JWKS endpoint)
      useJWTPlugin: true,
      
      // Trusted clients (pre-configured, skip database lookup)
      trustedClients: [
        {
          clientId: SYNAPSE_CLIENT_ID,
          clientSecret: SYNAPSE_CLIENT_SECRET,
          name: "Matrix Synapse",
          type: "web",
          redirectUrls: [SYNAPSE_REDIRECT_URI],
          disabled: false,
          skipConsent: true, // Auto-approve for Synapse (seamless SSO)
          metadata: { internal: true },
        },
      ],
      
      // OIDC metadata customization
      metadata: {
        issuer: baseURL,
      },
    }),
  ],

  // Advanced configuration
  advanced: {
    // Generate consistent session tokens
    generateId: () => crypto.randomUUID(),
    
    // Cookie settings
    cookiePrefix: "moltchat",
    
    // In development, allow cookies over both HTTP and HTTPS
    // This is needed because OIDC uses HTTPS proxy (3443) but Console runs on HTTP (3000)
    useSecureCookies: false,
    
    // Cross-subdomain cookie settings
    cookies: {
      sessionToken: {
        name: "moltchat.session_token",
        options: {
          httpOnly: true,
          sameSite: "lax",
          path: "/",
          secure: false, // Allow HTTP in development
        },
      },
    },
  },

  // Trusted origins for CORS
  trustedOrigins: [
    baseURL,
    "https://localhost:3443", // HTTPS proxy for OIDC
    process.env.NEXT_PUBLIC_GATEWAY_URL || "http://localhost:3001",
    "http://localhost:8008", // Matrix Synapse
    "http://localhost:8080", // Element Web (Docker)
    "http://localhost:8080", // MoltChat Client
  ],
});

// Export type for client usage
export type Auth = typeof auth;
