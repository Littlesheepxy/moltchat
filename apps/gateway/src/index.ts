import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';

import { config } from './lib/config.js';
import { logger } from './lib/logger.js';
import { AppError } from './lib/errors.js';

// Routes
import { healthRoutes } from './routes/health.js';
import { authRoutes } from './routes/auth.js';
import { agentRoutes } from './routes/agents.js';
import { claimRoutes } from './routes/claims.js';
import { roomRoutes } from './routes/rooms.js';
import { tokenRoutes } from './routes/tokens.js';
import { messageRoutes } from './routes/messages.js';
import { dmRoutes } from './routes/dm.js';
import { roomRulesRoutes } from './routes/room-rules.js';
import { tagRoutes } from './routes/tags.js';
import { ownerRoutes } from './routes/owner.js';
import { discoverRoutes } from './routes/discover.js';
import { statsRoutes } from './routes/stats.js';
import { networkingRoutes } from './routes/networking.js';
import { marketProtocolRoutes } from './routes/market-protocol.js';
import { protocolRulesRoutes } from './routes/protocol-rules.js';

// Matrix
import { getMatrixClient, stopMatrixClient } from './lib/matrix.js';
// Queue
import { startExplorationWorker, stopExplorationWorker } from './lib/exploration-queue.js';
// Room auto-explore scanner
import { startRoomExploreScanner, stopRoomExploreScanner } from './lib/room-explore-scanner.js';
// Database
import { query } from './db/client.js';
import { runMigrations } from './db/migrate.js';

async function main() {
  // Create Fastify instance
  const fastify = Fastify({
    logger: {
      level: config.log.level,
      transport: config.isDev
        ? {
            target: 'pino-pretty',
            options: {
              colorize: true,
              translateTime: 'SYS:standard',
              ignore: 'pid,hostname',
            },
          }
        : undefined,
    },
  });

  // Register plugins
  await fastify.register(cors, {
    origin: config.isDev ? true : [config.app.url, `${config.app.url}/`],
    credentials: true,
  });

  await fastify.register(helmet, {
    contentSecurityPolicy: false, // Disable for development
  });

  await fastify.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
  });

  // Error handler
  fastify.setErrorHandler((error, request, reply) => {
    if (error instanceof AppError) {
      return reply.status(error.statusCode).send(error.toJSON());
    }

    // Log unexpected errors
    fastify.log.error(error);

    // Don't expose internal errors in production
    const message = config.isDev ? error.message : 'Internal Server Error';

    return reply.status(500).send({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message,
      },
    });
  });

  // Register routes
  await fastify.register(healthRoutes);
  await fastify.register(authRoutes);
  await fastify.register(agentRoutes);
  await fastify.register(claimRoutes);
  await fastify.register(roomRoutes);
  await fastify.register(tokenRoutes);
  await fastify.register(messageRoutes);
  await fastify.register(dmRoutes);
  await fastify.register(roomRulesRoutes);
  await fastify.register(tagRoutes);
  await fastify.register(ownerRoutes);
  await fastify.register(discoverRoutes);
  await fastify.register(statsRoutes);
  await fastify.register(networkingRoutes);
  await fastify.register(marketProtocolRoutes);
  await fastify.register(protocolRulesRoutes);

  // Run database migrations
  try {
    await runMigrations();
  } catch (err) {
    logger.error({ err }, '❌ Database migration failed — continuing with existing schema');
  }

  // Initialize Matrix client (non-blocking)
  logger.info('Starting Matrix client initialization...');
  getMatrixClient()
    .then((client) => {
      if (client) {
        logger.info('Matrix client initialized successfully');
      } else {
        logger.warn('Matrix client returned null (disabled or failed)');
      }
    })
    .catch((err) => {
      logger.error({ err }, 'Matrix client initialization failed');
    });

  // Check if platform has public rooms (cold start detection)
  try {
    const result = await query<{ count: string }>(
      "SELECT COUNT(*) as count FROM rooms WHERE is_public = true AND status = 'active'"
    );
    const roomCount = parseInt(result.rows[0]?.count || '0', 10);
    if (roomCount === 0) {
      logger.warn('⚠ No public rooms found. Run: npx tsx scripts/seed-rooms.ts');
    } else {
      logger.info(`📋 ${roomCount} public rooms available`);
    }
  } catch {
    // Non-critical, don't block startup
  }

  // Start exploration queue worker
  startExplorationWorker();

  // Start room auto-explore scanner
  startRoomExploreScanner();

  // Graceful shutdown
  const shutdown = async () => {
    logger.info('Shutting down...');
    stopExplorationWorker();
    stopRoomExploreScanner();
    await stopMatrixClient();
    await fastify.close();
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  // Start server
  try {
    await fastify.listen({
      port: config.port,
      host: config.host,
    });

    logger.info(`🚀 MoltChat Gateway running at http://${config.host}:${config.port}`);
    logger.info(`📝 Environment: ${config.nodeEnv}`);
    logger.info(`🔍 Health check: http://${config.host}:${config.port}/healthz`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

main();
