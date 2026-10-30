import { describe, it, expect } from 'vitest';
import express, { Request, Response } from 'express';
import request from 'supertest';
import { createRateLimiter } from '../../src/middleware/rateLimiter.js';
import { errorHandler } from '../../src/middleware/errorHandler.js';

describe('Distributed Multi-Instance Rate Limiting Tests', () => {
  it('should synchronize rate limit state across multiple independent application instances', async () => {
    const policy = {
      name: 'shared_cluster_policy',
      maxRequests: 3,
      windowSec: 60
    };

    // Instantiate App Server Instance A
    const appA = express();
    appA.use(express.json());
    appA.get('/cluster-action', createRateLimiter(policy), (_req: Request, res: Response) => {
      res.json({ instance: 'A', status: 'ok' });
    });
    appA.use(errorHandler);

    // Instantiate App Server Instance B (simulating another container / cluster pod)
    const appB = express();
    appB.use(express.json());
    appB.get('/cluster-action', createRateLimiter(policy), (_req: Request, res: Response) => {
      res.json({ instance: 'B', status: 'ok' });
    });
    appB.use(errorHandler);

    // Request 1 sent to Instance A: Allowed
    const resA1 = await request(appA).get('/cluster-action');
    expect(resA1.status).toBe(200);
    expect(resA1.body.instance).toBe('A');
    expect(resA1.headers['ratelimit-remaining']).toBe('2');

    // Request 2 sent to Instance B: Allowed (remaining counter decremented in shared Redis state)
    const resB2 = await request(appB).get('/cluster-action');
    expect(resB2.status).toBe(200);
    expect(resB2.body.instance).toBe('B');
    expect(resB2.headers['ratelimit-remaining']).toBe('1');

    // Request 3 sent to Instance A: Allowed (last allowed request)
    const resA3 = await request(appA).get('/cluster-action');
    expect(resA3.status).toBe(200);
    expect(resA3.headers['ratelimit-remaining']).toBe('0');

    // Request 4 sent to Instance B: Must be REJECTED (HTTP 429) because cluster limit is exhausted
    const resB4 = await request(appB).get('/cluster-action');
    expect(resB4.status).toBe(429);
    expect(resB4.body.type).toBe('https://api.cynbit.in/errors/rate-limit-exceeded');
    expect(resB4.headers['retry-after']).toBeDefined();
  });
});
