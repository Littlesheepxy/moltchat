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
      disableDefaultScope: true,
      scope: [
        "tweet.read",
        "tweet.write",
        "users.read",
        "offline.access",
      ],
      getUserInfo: async (token) => {
        const fetchWithRetry = async (url: string, attempts = 2): Promise<Response> => {
          for (let i = 0; i < attempts; i++) {
            const res = await fetch(url, {
              headers: { Authorization: `Bearer ${token.accessToken}` },
            });
            if (res.ok) return res;
            const body = await res.text();
            console.error(`[Twitter getUserInfo] ${url} → ${res.status} ${res.statusText} (attempt ${i + 1}/${attempts})`, body);
            if (res.status === 429 && i < attempts - 1) {
              await new Promise(r => setTimeout(r, 2000));
              continue;
            }
            throw new Error(`Twitter API ${res.status}: ${body}`);
          }
          throw new Error("Twitter API failed after retries");
        };

        try {
          const profileRes = await fetchWithRetry(
            "https://api.x.com/2/users/me?user.fields=profile_image_url"
          );
          const profile = await profileRes.json() as {
            data: { id: string; name: string; username: string; profile_image_url?: string };
          };

          const email = `${profile.data.username}@twitter.placeholder`;

          return {
            user: {
              id: profile.data.id,
              name: profile.data.name,
              email,
              image: profile.data.profile_image_url,
              emailVerified: false,
            },
            data: profile,
          };
        } catch (e) {
          console.error("[Twitter getUserInfo] FAILED:", e);
          return null;
        }
      },
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
    // Database ID generation - use UUID to match our PostgreSQL schema
    database: {
      generateId: "uuid",
    },
    
    // Cookie settings
    cookiePrefix: "moltchat",
    
    // IMPORTANT: useSecureCookies must be false!
    // When true, Better Auth adds "__Secure-" prefix to cookie names,
    // breaking gateway's cookie parsing (it looks for "moltchat.session_token").
    // We handle secure flag manually in the cookie options below.
    useSecureCookies: false,
    
    // Cross-subdomain cookie settings
    // IMPORTANT: domain must be set to share cookies with api.moltchat.live
    cookies: {
      sessionToken: {
        name: "moltchat.session_token",
        options: {
          httpOnly: true,
          sameSite: "lax" as const,
          path: "/",
          secure: baseURL.startsWith("https://"),
          // Set domain for subdomain cookie sharing (e.g. api.moltchat.live)
          // In dev (localhost), omit domain to use exact host
          ...(baseURL.includes("localhost") ? {} : {
            domain: "." + new URL(baseURL).hostname,
          }),
        },
      },
    },
  },

  // Trusted origins for CORS
  trustedOrigins: [
    baseURL,
    "https://localhost:3443", // HTTPS proxy for OIDC
    process.env.NEXT_PUBLIC_GATEWAY_URL || "http://localhost:3002",
    "http://localhost:8008", // Matrix Synapse
    "http://localhost:8080", // Element Web (Docker)
    "http://localhost:8080", // MoltChat Client
  ],
});

// Export type for client usage
export type Auth = typeof auth;
