import { z } from 'zod';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the directory of this file
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load .env file from project root (from src/lib -> src -> gateway -> apps -> root)
const envPath = path.resolve(__dirname, '../../../..', '.env');
console.log('[CONFIG] Loading .env from:', envPath);
dotenv.config({ path: envPath });
console.log('[CONFIG] MATRIX_ENABLED =', process.env.MATRIX_ENABLED);
console.log('[CONFIG] MATRIX_BOT_USER_ID =', process.env.MATRIX_BOT_USER_ID);

const envSchema = z.object({
  // Server
  GATEWAY_PORT: z.string().default('3001'),
  GATEWAY_HOST: z.string().default('0.0.0.0'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // Database
  DATABASE_URL: z.string().default('postgres://moltchat:moltchat@localhost:5432/moltchat'),

  // Auth
  JWT_SECRET: z.string().default('dev-jwt-secret-change-in-production'),

  // Logging
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  // Matrix (optional)
  MATRIX_ENABLED: z.string().default('false'),
  MATRIX_HOMESERVER_URL: z.string().default('http://localhost:8008'),
  MATRIX_BOT_USER_ID: z.string().default('@moltbot:localhost'),
  MATRIX_BOT_ACCESS_TOKEN: z.string().default(''),
  MATRIX_SERVER_NAME: z.string().default('moltchat.local'),
  ELEMENT_WEB_URL: z.string().default('https://app.element.io'),

  // App
  APP_URL: z.string().default('http://localhost:3000'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const config = {
  port: parseInt(parsed.data.GATEWAY_PORT, 10),
  host: parsed.data.GATEWAY_HOST,
  nodeEnv: parsed.data.NODE_ENV,
  isDev: parsed.data.NODE_ENV === 'development',
  isProd: parsed.data.NODE_ENV === 'production',

  database: {
    url: parsed.data.DATABASE_URL,
  },

  auth: {
    jwtSecret: parsed.data.JWT_SECRET,
  },

  log: {
    level: parsed.data.LOG_LEVEL,
  },

  matrix: {
    enabled: parsed.data.MATRIX_ENABLED === 'true',
    homeserverUrl: parsed.data.MATRIX_HOMESERVER_URL,
    botUserId: parsed.data.MATRIX_BOT_USER_ID,
    botAccessToken: parsed.data.MATRIX_BOT_ACCESS_TOKEN,
    elementWebUrl: parsed.data.ELEMENT_WEB_URL,
    serverName: parsed.data.MATRIX_SERVER_NAME,
  },

  app: {
    url: parsed.data.APP_URL,
  },
} as const;

export type Config = typeof config;
