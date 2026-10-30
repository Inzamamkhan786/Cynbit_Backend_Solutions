import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger.js';

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();
  const reqId = (req.headers['x-request-id'] as string) || 'unknown';

  res.on('finish', () => {
    const durationMs = Date.now() - start;
    const statusCode = res.statusCode;
    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';

    const logContext = {
      requestId: reqId,
      method: req.method,
      path: req.originalUrl || req.url,
      statusCode,
      durationMs,
      ip: clientIp,
      userAgent: req.get('user-agent') || 'unknown'
    };

    if (statusCode >= 500) {
      logger.error(`HTTP ${req.method} ${req.originalUrl} - ${statusCode} (${durationMs}ms)`, logContext);
    } else if (statusCode >= 400) {
      logger.warn(`HTTP ${req.method} ${req.originalUrl} - ${statusCode} (${durationMs}ms)`, logContext);
    } else {
      logger.info(`HTTP ${req.method} ${req.originalUrl} - ${statusCode} (${durationMs}ms)`, logContext);
    }
  });

  next();
}
