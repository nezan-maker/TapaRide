import { buildApp } from './app.js';
import { env } from './config/env.js';
import { registerCacheInvalidationHandlers } from './lib/cache-invalidation.js';
import { db } from './lib/db.js';
import { redis } from './lib/redis.js';
import { startDomainEventSubscriber } from './lib/domain-events.js';
import { startNotificationListeners } from './modules/notifications/notifications.service.js';
import { shutdownCryptoPool } from './lib/crypto-pool.js';
import { stopRealtimeEventSubscriber } from './lib/socket-bus.js';
import { logger } from './lib/logger.js';
import type { Server as HttpServer } from 'http';

let httpServer: HttpServer | null = null;
let ioShutdown: (() => Promise<void>) | null = null;

async function main() {
  const app = await buildApp();

  try {
    // ─── Infrastructure health checks ──────────────────────────────────────────
    registerCacheInvalidationHandlers();
    await startDomainEventSubscriber();
    startNotificationListeners();

    await db.$connect();
    await db.$queryRaw`SELECT 1`;
    logger.info('Connected to database');

    try {
      await redis.ping();
      logger.info('Connected to Redis');
    } catch (err) {
      logger.warn({ err }, 'Redis unavailable — continuing without cache/Socket.IO');
    }

    // ─── HTTP server ───────────────────────────────────────────────────────────
    httpServer = app.listen(env.PORT, env.HOST, () => {
      logger.info({ host: env.HOST, port: env.PORT }, 'Tapa API running');
    });

    // Keep-alive timeout — prevent idle connections from hanging forever
    if (httpServer) {
      httpServer.keepAliveTimeout = 65_000; // slightly > nginx default

      // ─── WebSocket ─────────────────────────────────────────────────────────────
      try {
        const { initSocket, shutdownSocket } = await import('./lib/socket.js');
        ioShutdown = shutdownSocket;
        await initSocket(httpServer);
      } catch (err) {
        logger.warn({ err }, 'Socket.IO unavailable — continuing without WebSocket support');
      }
    }

    // ─── Graceful shutdown ─────────────────────────────────────────────────────
    const shutdown = async (signal: string) => {
      logger.info({ signal }, 'Shutting down API server');

      // 1. Stop accepting new HTTP connections
      if (httpServer) {
        await new Promise<void>((resolve) => {
          httpServer!.close(() => resolve());
        });
        logger.info('HTTP server closed');
      }

      // 2. Close Socket.IO connections
      if (ioShutdown) {
        await ioShutdown();
        logger.info('Socket.IO shut down');
      }

      // 3. Close Redis pub/sub for real-time events
      await stopRealtimeEventSubscriber();
      logger.info('Real-time event subscriber stopped');

      // 4. Disconnect from database
      await db.$disconnect();
      logger.info('Database disconnected');

      // 5. Shut down crypto worker pool
      await shutdownCryptoPool();
      logger.info('Crypto pool shut down');

      // 6. Force exit after timeout (safety net)
      const forceExitTimer = setTimeout(() => {
        logger.error('Forced exit after shutdown timeout');
        process.exit(1);
      }, 10_000);
      forceExitTimer.unref();

      process.exit(0);
    };

    process.on('SIGTERM', () => void shutdown('SIGTERM'));
    process.on('SIGINT', () => void shutdown('SIGINT'));

    // Prevent unhandled rejections from crashing the process silently
    process.on('unhandledRejection', (reason) => {
      logger.error({ err: reason }, 'Unhandled rejection');
    });
  } catch (err) {
    logger.error({ err }, 'Failed to start server');
    await db.$disconnect().catch(() => {});
    process.exit(1);
  }
}

main();
