import { app } from './app.js';
import { env } from './config/env.js';
import { initRedis, closeRedis } from './config/redis.js';
import { closeDb } from './config/database.js';
import { logger } from './utils/logger.js';

async function startServer() {
  await initRedis();

  const server = app.listen(env.PORT, env.HOST, () => {
    logger.info(`🚀 Cynbit Backend Reference Server running on http://${env.HOST}:${env.PORT} [${env.NODE_ENV}]`);
    logger.info(`Health check available at http://${env.HOST}:${env.PORT}/health`);
  });

  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}. Commencing graceful shutdown...`);

    // Stop accepting new connections
    server.close(async (err) => {
      if (err) {
        logger.error('Error closing HTTP server', undefined, err);
        process.exit(1);
      }

      logger.info('HTTP server closed.');

      try {
        await Promise.all([closeRedis(), closeDb()]);
        logger.info('All database and Redis connections closed cleanly. Exiting process.');
        process.exit(0);
      } catch (cleanupErr) {
        logger.error('Error during resource cleanup', undefined, cleanupErr as Error);
        process.exit(1);
      }
    });

    // Force exit after 10 seconds timeout
    setTimeout(() => {
      logger.error('Graceful shutdown timed out after 10s. Forcing exit.');
      process.exit(1);
    }, 10000).unref();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

startServer().catch((err) => {
  logger.error('Fatal error during server startup', undefined, err);
  process.exit(1);
});
