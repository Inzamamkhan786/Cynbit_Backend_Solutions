import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { redisClient, isRedisConnected } from '../config/redis.js';
import { env } from '../config/env.js';
import { RateLimitError } from '../utils/appError.js';
import { logger } from '../utils/logger.js';

export interface RateLimitPolicy {
  name: string;
  maxRequests: number;
  windowSec: number;
}

// In-memory sliding window fallback for local testing or when Redis is temporarily offline
interface InMemoryWindowEntry {
  timestamp: number;
  id: string;
}
const memoryFallbackStore = new Map<string, InMemoryWindowEntry[]>();

const SLIDING_WINDOW_LUA = `
local key = KEYS[1]
local now = tonumber(ARGV[1])
local windowMs = tonumber(ARGV[2])
local maxRequests = tonumber(ARGV[3])
local uniqueMember = ARGV[4]

local clearBefore = now - windowMs
redis.call('ZREMRANGEBYSCORE', key, '-inf', clearBefore)

local currentRequests = redis.call('ZCARD', key)

if currentRequests < maxRequests then
    redis.call('ZADD', key, now, uniqueMember)
    redis.call('PEXPIRE', key, windowMs + 1000)
    return {1, maxRequests - currentRequests - 1, 0}
else
    local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
    local retryAfterMs = 0
    if oldest and #oldest >= 2 then
        local oldestScore = tonumber(oldest[2])
        retryAfterMs = (oldestScore + windowMs) - now
        if retryAfterMs < 0 then retryAfterMs = 0 end
    else
        retryAfterMs = windowMs
    end
    return {0, 0, math.ceil(retryAfterMs / 1000)}
end
`;

export function createRateLimiter(policy: RateLimitPolicy) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!env.RATE_LIMIT_ENABLED) {
      return next();
    }

    const clientIp = (req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1') as string;
    const identifier = clientIp.split(',')[0].trim();
    const rateLimitKey = `rl:${policy.name}:${identifier}`;
    const now = Date.now();
    const windowMs = policy.windowSec * 1000;
    const uniqueMember = `${now}:${uuidv4().substring(0, 8)}`;

    try {
      if (isRedisConnected || env.NODE_ENV === 'test') {
        // Execute atomic sliding window check via Redis eval
        const result = (await redisClient.eval(
          SLIDING_WINDOW_LUA,
          1,
          rateLimitKey,
          now.toString(),
          windowMs.toString(),
          policy.maxRequests.toString(),
          uniqueMember
        )) as [number, number, number];

        const [allowed, remaining, retryAfterSec] = result;

        res.setHeader('RateLimit-Limit', policy.maxRequests.toString());
        res.setHeader('RateLimit-Remaining', Math.max(0, remaining).toString());
        res.setHeader('RateLimit-Reset', policy.windowSec.toString());

        if (allowed === 1) {
          return next();
        } else {
          const effectiveRetryAfter = retryAfterSec > 0 ? retryAfterSec : policy.windowSec;
          res.setHeader('Retry-After', effectiveRetryAfter.toString());
          throw new RateLimitError(
            `Rate limit exceeded for ${policy.name}. Please retry after ${effectiveRetryAfter} seconds.`,
            effectiveRetryAfter
          );
        }
      } else {
        // Fallback to local sliding window if Redis is temporarily degraded
        logger.warn(`Redis disconnected; executing in-memory rate limit fallback for key: ${rateLimitKey}`);
        const entries = memoryFallbackStore.get(rateLimitKey) || [];
        const windowStart = now - windowMs;
        const validEntries = entries.filter((e) => e.timestamp > windowStart);

        if (validEntries.length < policy.maxRequests) {
          validEntries.push({ timestamp: now, id: uniqueMember });
          memoryFallbackStore.set(rateLimitKey, validEntries);

          res.setHeader('RateLimit-Limit', policy.maxRequests.toString());
          res.setHeader('RateLimit-Remaining', (policy.maxRequests - validEntries.length).toString());
          res.setHeader('RateLimit-Reset', policy.windowSec.toString());
          return next();
        } else {
          const oldest = validEntries[0];
          const retryAfterSec = Math.max(1, Math.ceil((oldest.timestamp + windowMs - now) / 1000));
          res.setHeader('RateLimit-Limit', policy.maxRequests.toString());
          res.setHeader('RateLimit-Remaining', '0');
          res.setHeader('RateLimit-Reset', policy.windowSec.toString());
          res.setHeader('Retry-After', retryAfterSec.toString());
          throw new RateLimitError(
            `Rate limit exceeded for ${policy.name}. Please retry after ${retryAfterSec} seconds.`,
            retryAfterSec
          );
        }
      }
    } catch (error) {
      if (error instanceof RateLimitError) {
        return next(error);
      }
      logger.error('Error evaluating rate limit policy; allowing request under degraded policy', { policy: policy.name }, error as Error);
      return next();
    }
  };
}

// Pre-configured policy middlewares
export const globalRateLimiter = createRateLimiter({
  name: 'global',
  maxRequests: env.RATE_LIMIT_GLOBAL_MAX,
  windowSec: env.RATE_LIMIT_GLOBAL_WINDOW_SEC
});

export const contactRateLimiter = createRateLimiter({
  name: 'contact',
  maxRequests: env.RATE_LIMIT_CONTACT_MAX,
  windowSec: env.RATE_LIMIT_CONTACT_WINDOW_SEC
});

export const newsletterRateLimiter = createRateLimiter({
  name: 'newsletter',
  maxRequests: env.RATE_LIMIT_NEWSLETTER_MAX,
  windowSec: env.RATE_LIMIT_NEWSLETTER_WINDOW_SEC
});

export const careersRateLimiter = createRateLimiter({
  name: 'careers',
  maxRequests: env.RATE_LIMIT_CAREERS_MAX,
  windowSec: env.RATE_LIMIT_CAREERS_WINDOW_SEC
});
