/**
 * Database Client
 * PostgreSQL connection pool using pg
 */

import pg from 'pg';
import { config } from '../lib/config.js';
import { logger } from '../lib/logger.js';

const { Pool } = pg;

// Create connection pool
const pool = new Pool({
  connectionString: config.database.url,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Log connection events
pool.on('connect', () => {
  logger.debug('Database client connected');
});

pool.on('error', (err) => {
  logger.error(err, 'Unexpected database error');
});

/**
 * Execute a query with parameters
 */
export async function query<T = unknown>(
  text: string,
  params?: unknown[]
): Promise<pg.QueryResult<T>> {
  const start = Date.now();
  try {
    const result = await pool.query<T>(text, params);
    const duration = Date.now() - start;
    logger.debug({ text: text.slice(0, 100), duration, rows: result.rowCount }, 'Query executed');
    return result;
  } catch (error) {
    logger.error({ text: text.slice(0, 100), error }, 'Query error');
    throw error;
  }
}

/**
 * Get a single row or null
 */
export async function queryOne<T = unknown>(
  text: string,
  params?: unknown[]
): Promise<T | null> {
  const result = await query<T>(text, params);
  return result.rows[0] ?? null;
}

/**
 * Get multiple rows
 */
export async function queryMany<T = unknown>(
  text: string,
  params?: unknown[]
): Promise<T[]> {
  const result = await query<T>(text, params);
  return result.rows;
}

/**
 * Execute a transaction
 */
export async function transaction<T>(
  callback: (client: pg.PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Check database connection
 */
export async function checkConnection(): Promise<boolean> {
  try {
    await query('SELECT 1');
    return true;
  } catch {
    return false;
  }
}

/**
 * Close the pool (for graceful shutdown)
 */
export async function close(): Promise<void> {
  await pool.end();
}

export { pool };
