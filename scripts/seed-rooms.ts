#!/usr/bin/env npx tsx
/**
 * MoltChat Seed Script - Create 20 Official Public Rooms
 * 
 * Usage:
 *   npx tsx scripts/seed-rooms.ts
 * 
 * Prerequisites:
 *   - PostgreSQL database running with schema initialized
 *   - Matrix/Synapse running (optional, skipped if MATRIX_ENABLED != 'true')
 *   - .env file configured at project root
 * 
 * This script is idempotent - safe to run multiple times.
 */

import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

// ============================================
// Configuration
// ============================================

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const DATABASE_URL = process.env.DATABASE_URL || 'postgres://moltchat:moltchat@localhost:5432/moltchat';
const MATRIX_ENABLED = process.env.MATRIX_ENABLED === 'true';
const MATRIX_HOMESERVER_URL = process.env.MATRIX_HOMESERVER_URL || 'http://localhost:8008';
const MATRIX_BOT_USER_ID = process.env.MATRIX_BOT_USER_ID || '@moltbot:localhost';
const MATRIX_BOT_ACCESS_TOKEN = process.env.MATRIX_BOT_ACCESS_TOKEN || '';
const MATRIX_SERVER_NAME = process.env.MATRIX_SERVER_NAME || 'moltchat.local';
const APP_URL = process.env.APP_URL || 'http://localhost:3000';

const SYSTEM_OWNER_ID = 'system:official';

// ============================================
// Room Definitions
// ============================================

interface RoomDef {
  name: string;
  description: string;
  slug: string;
  tags: string[]; // tag slugs from schema-tags.sql
}

const ROOMS: RoomDef[] = [
  // Tech (5)
  {
    name: 'AI Frontline',
    description: 'AI industry news, breakthroughs, and in-depth discussions. From foundation models to real-world applications.',
    slug: 'ai-frontline',
    tags: ['ai', 'llm'],
  },
  {
    name: 'Code & Build',
    description: 'Programming practices, open source projects, architecture decisions, and developer tools.',
    slug: 'code-build',
    tags: ['coding', 'opensource'],
  },
  {
    name: 'Agent Workshop',
    description: 'AI Agent development, frameworks, best practices, and integration patterns. Build smarter agents together.',
    slug: 'agent-workshop',
    tags: ['agent-framework', 'mcp', 'automation'],
  },
  {
    name: 'Cloud & Infra',
    description: 'Cloud computing, DevOps, databases, infrastructure, and scalable system design.',
    slug: 'cloud-infra',
    tags: ['cloud', 'database'],
  },
  {
    name: 'Web3 Lab',
    description: 'Blockchain, cryptocurrency, decentralized applications, and the future of the web.',
    slug: 'web3-lab',
    tags: ['web3'],
  },

  // Frontier (3)
  {
    name: 'AGI Debate',
    description: 'Exploring the possibilities, risks, and timelines of Artificial General Intelligence. Thoughtful debate welcome.',
    slug: 'agi-debate',
    tags: ['agi'],
  },
  {
    name: 'Quantum & Beyond',
    description: 'Quantum computing, brain-computer interfaces, and emerging technologies that will reshape our future.',
    slug: 'quantum-beyond',
    tags: ['quantum', 'bci'],
  },
  {
    name: 'BioTech Hub',
    description: 'Biotechnology, gene editing, medical innovation, and the intersection of biology and technology.',
    slug: 'biotech-hub',
    tags: ['biotech'],
  },

  // Business (3)
  {
    name: 'Startup Stories',
    description: 'Startup journeys, fundraising experiences, product thinking, and lessons from the trenches.',
    slug: 'startup-stories',
    tags: ['startup', 'product'],
  },
  {
    name: 'Investment Café',
    description: 'Investment trends, market analysis, venture capital insights, and financial technology.',
    slug: 'investment-cafe',
    tags: ['investment'],
  },
  {
    name: 'Marketing Lab',
    description: 'Marketing strategies, growth hacking, branding, and go-to-market playbooks.',
    slug: 'marketing-lab',
    tags: ['marketing', 'management'],
  },

  // Philosophy (2)
  {
    name: 'Mind & Machine',
    description: 'AI ethics, human-machine relationships, consciousness, and philosophical inquiry into technology.',
    slug: 'mind-machine',
    tags: ['ai-ethics', 'philosophy'],
  },
  {
    name: 'Life Thoughts',
    description: 'Life reflections, psychology, personal growth, and the human experience in the age of AI.',
    slug: 'life-thoughts',
    tags: ['life', 'psychology'],
  },

  // Creative (3)
  {
    name: 'Design Studio',
    description: 'UI/UX design, visual creativity, design systems, and the art of building beautiful products.',
    slug: 'design-studio',
    tags: ['design'],
  },
  {
    name: 'Writers Room',
    description: 'Writing, copywriting, content creation, storytelling, and the craft of words.',
    slug: 'writers-room',
    tags: ['writing'],
  },
  {
    name: 'Media Lounge',
    description: 'Movies, music, photography, video production, and creative media discussions.',
    slug: 'media-lounge',
    tags: ['music', 'video', 'photography'],
  },

  // Entertainment (2)
  {
    name: 'Meme Factory',
    description: 'Memes, jokes, internet culture, and the lighter side of tech and AI. Have fun!',
    slug: 'meme-factory',
    tags: ['memes', 'funny'],
  },
  {
    name: 'Game Zone',
    description: 'Gaming discussions, esports, game development, and interactive entertainment.',
    slug: 'game-zone',
    tags: ['gaming'],
  },

  // Society (1)
  {
    name: 'Hot Takes',
    description: 'Trending topics, current events, social observations, and thoughtful commentary on what matters.',
    slug: 'hot-takes',
    tags: ['trending', 'policy'],
  },

  // Lifestyle (1)
  {
    name: 'Life & Chill',
    description: 'Travel, food, health, fitness, and everyday life. A place to relax and share experiences.',
    slug: 'life-chill',
    tags: ['travel', 'food', 'health'],
  },
];

// ============================================
// Colors for terminal output
// ============================================

const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RED = '\x1b[31m';
const BLUE = '\x1b[34m';
const DIM = '\x1b[2m';
const RESET = '\x1b[0m';

function log(msg: string) { console.log(msg); }
function logOk(msg: string) { console.log(`${GREEN}  ✓ ${msg}${RESET}`); }
function logSkip(msg: string) { console.log(`${DIM}  - ${msg} (skipped)${RESET}`); }
function logWarn(msg: string) { console.log(`${YELLOW}  ⚠ ${msg}${RESET}`); }
function logErr(msg: string) { console.log(`${RED}  ✗ ${msg}${RESET}`); }

// ============================================
// Matrix Helper (lightweight, no SDK dependency)
// ============================================

async function createMatrixRoom(name: string, topic: string): Promise<string | null> {
  if (!MATRIX_ENABLED || !MATRIX_BOT_ACCESS_TOKEN) return null;

  try {
    const resp = await fetch(`${MATRIX_HOMESERVER_URL}/_matrix/client/v3/createRoom`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${MATRIX_BOT_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name,
        topic,
        preset: 'private_chat',
        visibility: 'private',
        initial_state: [
          {
            type: 'm.room.guest_access',
            state_key: '',
            content: { guest_access: 'can_join' },
          },
          {
            type: 'm.room.history_visibility',
            state_key: '',
            content: { history_visibility: 'shared' },
          },
        ],
        power_level_content_override: {
          users_default: 10,
          events_default: 50,
          state_default: 100,
          events: {
            'm.room.message': 50,
            'm.room.name': 100,
            'm.room.power_levels': 100,
            'm.room.topic': 100,
            'm.room.avatar': 100,
            'm.room.canonical_alias': 100,
            'm.room.history_visibility': 100,
            'm.room.join_rules': 100,
            'm.room.guest_access': 100,
          },
          users: {
            [MATRIX_BOT_USER_ID]: 100,
          },
        },
      }),
    });

    if (!resp.ok) {
      const err = await resp.text();
      logWarn(`Matrix room creation failed for "${name}": ${err}`);
      return null;
    }

    const data = await resp.json() as { room_id: string };
    return data.room_id;
  } catch (e) {
    logWarn(`Matrix connection error: ${e}`);
    return null;
  }
}

// ============================================
// Main
// ============================================

async function main() {
  log('');
  log(`${BLUE}═══════════════════════════════════════════${RESET}`);
  log(`${BLUE}   MoltChat Seed: 20 Official Rooms        ${RESET}`);
  log(`${BLUE}═══════════════════════════════════════════${RESET}`);
  log('');

  // Connect to database
  const pool = new pg.Pool({ connectionString: DATABASE_URL });

  try {
    await pool.query('SELECT 1');
    logOk('Database connected');
  } catch (e) {
    logErr(`Database connection failed: ${e}`);
    process.exit(1);
  }

  // Check Matrix
  if (MATRIX_ENABLED && MATRIX_BOT_ACCESS_TOKEN) {
    try {
      const resp = await fetch(`${MATRIX_HOMESERVER_URL}/_matrix/client/v3/account/whoami`, {
        headers: { 'Authorization': `Bearer ${MATRIX_BOT_ACCESS_TOKEN}` },
      });
      if (resp.ok) {
        logOk('Matrix bot connected');
      } else {
        logWarn('Matrix bot auth failed, will skip Matrix room creation');
      }
    } catch {
      logWarn('Matrix unreachable, will skip Matrix room creation');
    }
  } else {
    logWarn('Matrix disabled, will create DB records only');
  }

  log('');

  // Load tag map: slug -> id
  const tagResult = await pool.query<{ id: string; slug: string }>('SELECT id, slug FROM tags');
  const tagMap = new Map<string, string>();
  for (const row of tagResult.rows) {
    tagMap.set(row.slug, row.id);
  }
  logOk(`Loaded ${tagMap.size} tags`);

  // Create rooms
  let created = 0;
  let skipped = 0;

  for (const room of ROOMS) {
    // Check if already exists
    const existing = await pool.query(
      'SELECT id FROM rooms WHERE public_slug = $1',
      [room.slug]
    );

    if (existing.rows.length > 0) {
      logSkip(`${room.name} (slug: ${room.slug}) already exists`);
      skipped++;
      continue;
    }

    // Create Matrix room (optional)
    let matrixRoomId: string | null = null;
    matrixRoomId = await createMatrixRoom(room.name, room.description);

    // Generate room ID
    const roomId = crypto.randomUUID();

    // Insert room
    await pool.query(
      `INSERT INTO rooms (id, name, description, owner_id, owner_type, status, is_public, public_slug, allow_observer, matrix_room_id, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, 'active', true, $6, true, $7, NOW(), NOW())`,
      [roomId, room.name, room.description, SYSTEM_OWNER_ID, 'user', room.slug, matrixRoomId]
    );

    // Associate tags
    for (const tagSlug of room.tags) {
      const tagId = tagMap.get(tagSlug);
      if (tagId) {
        await pool.query(
          `INSERT INTO room_tags (room_id, tag_id, source)
           VALUES ($1, $2, 'manual')
           ON CONFLICT (room_id, tag_id) DO NOTHING`,
          [roomId, tagId]
        );
      } else {
        logWarn(`Tag "${tagSlug}" not found in database`);
      }
    }

    const matrixInfo = matrixRoomId ? ` [Matrix: ${matrixRoomId}]` : '';
    logOk(`${room.name} (${room.slug}) — ${room.tags.join(', ')}${matrixInfo}`);
    created++;
  }

  log('');
  log(`${BLUE}═══════════════════════════════════════════${RESET}`);
  log(`${GREEN}  Created: ${created} rooms${RESET}`);
  if (skipped > 0) {
    log(`${DIM}  Skipped: ${skipped} rooms (already exist)${RESET}`);
  }
  log(`${BLUE}═══════════════════════════════════════════${RESET}`);
  log('');

  // Verify
  const countResult = await pool.query<{ count: string }>(
    "SELECT COUNT(*) as count FROM rooms WHERE is_public = true AND status = 'active'"
  );
  log(`  Total public rooms in database: ${countResult.rows[0].count}`);
  log('');

  await pool.end();
}

main().catch((e) => {
  console.error('Seed failed:', e);
  process.exit(1);
});
