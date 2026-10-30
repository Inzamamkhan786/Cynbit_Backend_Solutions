import { describe, it, expect } from 'vitest';
import express, { Request, Response } from 'express';
import request from 'supertest';
import { createRateLimiter } from '../../src/middleware/rateLimiter.js';
import { errorHandler } from '../../src/middleware/errorHandler.js';

describe('Rate Limiter Middleware Unit Tests', () => {
  it('should enforce rate limits and return HTTP 429 when threshold is breached', async () => {
    const testApp = express();
    testApp.use(express.json());

    // Strict policy: max 2 requests per 60 seconds
    const limiter = createRateLimiter({
      name: 'test_strict',
      maxRequests: 2,
      windowSec: 60
    });

    testApp.get('/test-limit', limiter, (_req: Request, res: Response) => {
      res.status(200).json({ ok: true });
    });
    testApp.use(errorHandler);

    // Request 1: allowed
    const res1 = await request(testApp).get('/test-limit');
    expect(res1.status).toBe(200);
    expect(res1.headers['ratelimit-limit']).toBe('2');
    expect(res1.headers['ratelimit-remaining']).toBe('1');

    // Request 2: allowed
    const res2 = await request(testApp).get('/test-limit');
    expect(res2.status).toBe(200);
    expect(res2.headers['ratelimit-remaining']).toBe('0');

    // Request 3: breached -> 429 Too Many Requests
    const res3 = await request(testApp).get('/test-limit');
    expect(res3.status).toBe(429);
    expect(res3.headers['retry-after']).toBeDefined();
    expect(parseInt(res3.headers['retry-after'], 10)).toBeGreaterThan(0);
    expect(res3.body.type).toBe('https://api.cynbit.in/errors/rate-limit-exceeded');
    expect(res3.body.detail).toContain('Rate limit exceeded');
  });
});
