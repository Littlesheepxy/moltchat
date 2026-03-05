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

  // Social OAuth providers
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    },
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
        const RETRYABLE = new Set([429, 500, 502, 503, 504]);
        const MAX_ATTEMPTS = 3;

        const fetchWithRetry = async (url: string, headers: Record<string, string>): Promise<Response> => {
          for (let i = 0; i < MAX_ATTEMPTS; i++) {
            const res = await fetch(url, { headers });
            if (res.ok) return res;
            const body = await res.text();
            console.error(`[Twitter getUserInfo] ${url} → ${res.status} (attempt ${i + 1}/${MAX_ATTEMPTS})`, body);
            if (RETRYABLE.has(res.status) && i < MAX_ATTEMPTS - 1) {
              const delay = 1000 * Math.pow(2, i);
              console.log(`[Twitter getUserInfo] retrying in ${delay}ms...`);
              await new Promise(r => setTimeout(r, delay));
              continue;
            }
            throw new Error(`Twitter API ${res.status}: ${body}`);
          }
          throw new Error("Twitter API failed after retries");
        };

        // Strategy 1: Try API v2 (preferred, returns richer data)
        try {
          const profileRes = await fetchWithRetry(
            "https://api.x.com/2/users/me?user.fields=profile_image_url",
            { Authorization: `Bearer ${token.accessToken}` },
          );
          const profile = await profileRes.json() as {
            data: { id: string; name: string; username: string; profile_image_url?: string };
          };
          console.log("[Twitter getUserInfo] v2 OK:", profile.data.username);
          return {
            user: {
              id: profile.data.id,
              name: profile.data.name,
              email: `${profile.data.username}@twitter.placeholder`,
              image: profile.data.profile_image_url,
              emailVerified: false,
            },
            data: profile,
          };
        } catch (e) {
          console.warn("[Twitter getUserInfo] v2 failed, trying v1.1 fallback...", e);
        }

        // Strategy 2: Fallback to API v1.1 (more stable, OAuth 2.0 Bearer works)
        try {
          const v1Res = await fetchWithRetry(
            "https://api.x.com/1.1/account/verify_credentials.json?include_email=false&skip_status=true",
            { Authorization: `Bearer ${token.accessToken}` },
          );
          const v1Profile = await v1Res.json() as {
            id_str: string; name: string; screen_name: string; profile_image_url_https?: string;
          };
          console.log("[Twitter getUserInfo] v1.1 OK:", v1Profile.screen_name);
          return {
            user: {
              id: v1Profile.id_str,
              name: v1Profile.name,
              email: `${v1Profile.screen_name}@twitter.placeholder`,
              image: v1Profile.profile_image_url_https,
              emailVerified: false,
            },
            data: v1Profile,
          };
        } catch (e2) {
          console.error("[Twitter getUserInfo] v1.1 also failed:", e2);
        }

        console.error("[Twitter getUserInfo] ALL strategies failed");
        return null;
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
