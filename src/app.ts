import express, { Express, Request, Response, NextFunction } from 'express';
import { requestId } from './middleware/requestId.js';
import { requestLogger } from './middleware/requestLogger.js';
import { helmetMiddleware, corsMiddleware, additionalSecurityHeaders } from './middleware/securityHeaders.js';
import { globalRateLimiter } from './middleware/rateLimiter.js';
import { errorHandler } from './middleware/errorHandler.js';
import routes from './routes/index.js';
import { NotFoundError } from './utils/appError.js';

export function createApp(): Express {
  const app = express();

  // Trust proxy for proper IP resolution behind reverse proxies/Vercel/Cloudflare
  app.set('trust proxy', 1);

  // Security Headers and CORS
  app.use(helmetMiddleware);
  app.use(corsMiddleware);
  app.use(additionalSecurityHeaders);

  // Request correlation ID and structured logger
  app.use(requestId);
  app.use(requestLogger);

  // Global rate limiter
  app.use(globalRateLimiter);

  // Body parsers with strict size limits (defense against payload bloat and memory exhaustion)
  app.use(express.json({ limit: '100kb' }));
  app.use(express.urlencoded({ extended: true, limit: '100kb' }));

  // Mount Application Routes
  app.use('/', routes);

  // Catch-all 404 handler for undefined routes
  app.use((req: Request, _res: Response, next: NextFunction) => {
    next(new NotFoundError(`Endpoint '${req.method} ${req.originalUrl}' does not exist on this server.`));
  });

  // Centralized Error Handler (RFC 9457 compliant)
  app.use(errorHandler);

  return app;
}

export const app = createApp();
