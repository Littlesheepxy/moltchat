/**
 * Database Migration Script
 * Runs SQL migrations in order from migrations/ folder
 */

import { readdir, readFile } from 'fs/promises';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { query } from './client.js';
import { logger } from '../lib/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface Migration {
  id: string;
  filename: string;
  sql: string;
}

/**
 * Create migrations tracking table if not exists
 */
async function ensureMigrationsTable(): Promise<void> {
  await query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id VARCHAR(255) PRIMARY KEY,
      filename VARCHAR(255) NOT NULL,
      applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    )
  `);
  logger.info('✅ Migrations table ready');
}

/**
 * Get list of applied migrations
 */
async function getAppliedMigrations(): Promise<Set<string>> {
  const result = await query<{ id: string }>('SELECT id FROM _migrations');
  return new Set(result.rows.map(r => r.id));
}

/**
 * Get all migration files from migrations/ folder
 */
async function getMigrationFiles(): Promise<Migration[]> {
  const migrationsDir = join(__dirname, 'migrations');
  
  try {
    const files = await readdir(migrationsDir);
    const sqlFiles = files
      .filter(f => f.endsWith('.sql'))
      .sort(); // Sort alphabetically (001_, 002_, etc.)
    
    const migrations: Migration[] = [];
    
    for (const filename of sqlFiles) {
      const filepath = join(migrationsDir, filename);
      const sql = await readFile(filepath, 'utf-8');
      const id = filename.replace('.sql', '');
      
      migrations.push({ id, filename, sql });
    }
    
    return migrations;
  } catch (err) {
    logger.error(err, 'Failed to read migrations directory');
    return [];
  }
}

/**
 * Apply a single migration
 */
async function applyMigration(migration: Migration): Promise<void> {
  logger.info(`📝 Applying migration: ${migration.filename}`);
  
  try {
    // Run migration SQL
    await query(migration.sql);
    
    // Record migration as applied
    await query(
      'INSERT INTO _migrations (id, filename) VALUES ($1, $2)',
      [migration.id, migration.filename]
    );
    
    logger.info(`✅ Applied: ${migration.filename}`);
  } catch (err) {
    logger.error(err, `❌ Failed to apply: ${migration.filename}`);
    throw err;
  }
}

/**
 * Run all pending migrations
 */
export async function runMigrations(): Promise<void> {
  logger.info('🗃️  Starting database migrations...');
  
  try {
    // Ensure migrations tracking table exists
    await ensureMigrationsTable();
    
    // Get applied migrations
    const applied = await getAppliedMigrations();
    logger.info(`📊 ${applied.size} migrations already applied`);
    
    // Get all migration files
    const migrations = await getMigrationFiles();
    logger.info(`📂 Found ${migrations.length} migration files`);
    
    // Find pending migrations
    const pending = migrations.filter(m => !applied.has(m.id));
    
    if (pending.length === 0) {
      logger.info('✅ All migrations up to date!');
      return;
    }
    
    logger.info(`🔄 Running ${pending.length} pending migrations...`);
    
    // Apply pending migrations in order
    for (const migration of pending) {
      await applyMigration(migration);
    }
    
    logger.info('✅ All migrations completed successfully!');
  } catch (err) {
    logger.error(err, '❌ Migration failed');
    throw err;
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runMigrations()
    .then(() => {
      logger.info('🎉 Migration script completed');
      process.exit(0);
    })
    .catch((err) => {
      logger.error(err, '💥 Migration script failed');
      process.exit(1);
    });
}
