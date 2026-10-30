import { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { env } from '../config/env.js';

const allowedOrigins = env.CORS_ORIGIN.split(',').map((o) => o.trim());

export const corsMiddleware = cors({
  origin: (origin, callback) => {
    // Allow non-browser clients (curl, mobile apps, postman) or matching origins
    if (!origin || allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
      callback(null, true);
    } else {
      callback(new Error(`CORS policy violation: origin ${origin} is not allowed`));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id', 'Idempotency-Key'],
  exposedHeaders: [
    'X-Request-Id',
    'RateLimit-Limit',
    'RateLimit-Remaining',
    'RateLimit-Reset',
    'Retry-After'
  ],
  credentials: true,
  maxAge: 86400
});

export const helmetMiddleware = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'", ...allowedOrigins],
      fontSrc: ["'self'", 'https:', 'data:'],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'none'"],
      upgradeInsecureRequests: env.NODE_ENV === 'production' ? [] : null
    }
  },
  frameguard: { action: 'deny' },
  xContentTypeOptions: true,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  hsts: {
    maxAge: 63072000,
    includeSubDomains: true,
    preload: true
  },
  hidePoweredBy: true
});

export function additionalSecurityHeaders(req: Request, res: Response, next: NextFunction): void {
  // Explicitly remove any X-Powered-By header
  res.removeHeader('X-Powered-By');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
  res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
  next();
}
