import { Redis } from 'ioredis';
import { env } from './env.js';
import { logger } from '../utils/logger.js';

let redisClient: Redis;
let isConnected = false;

if (env.NODE_ENV === 'test') {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const RedisMock = (await import('ioredis-mock')).default as any;
    redisClient = new RedisMock() as Redis;
    isConnected = true;
  } catch {
    redisClient = new Redis({
      lazyConnect: true,
      maxRetriesPerRequest: 1
    });
  }
} else {
  redisClient = new Redis(env.REDIS_URL, {
    keyPrefix: env.REDIS_KEY_PREFIX,
    retryStrategy: (times: number) => {
      const delay = Math.min(times * 100, 3000);
      return delay;
    },
    maxRetriesPerRequest: 3,
    lazyConnect: true,
    reconnectOnError: (err: Error) => {
      const targetErrors = ['READONLY', 'ETIMEDOUT'];
      return targetErrors.some((target) => err.message.includes(target));
    }
  });

  redisClient.on('connect', () => {
    isConnected = true;
    logger.info('Connected to Redis server');
  });

  redisClient.on('ready', () => {
    isConnected = true;
    logger.info('Redis client is ready');
  });

  redisClient.on('error', (err: Error) => {
    isConnected = false;
    logger.warn('Redis connection warning/error (degraded mode active)', undefined, err);
  });

  redisClient.on('close', () => {
    isConnected = false;
    logger.warn('Redis connection closed');
  });
}

export async function initRedis(): Promise<void> {
  if (env.NODE_ENV === 'test') return;
  try {
    await redisClient.connect();
  } catch (error) {
    logger.warn('Initial Redis connection failed; falling back to in-memory mode', undefined, error as Error);
  }
}

export async function closeRedis(): Promise<void> {
  try {
    if (isConnected) {
      await redisClient.quit();
    }
  } catch (error) {
    logger.error('Error closing Redis connection', undefined, error as Error);
  }
}

export async function checkRedisHealth(): Promise<{ status: 'healthy' | 'degraded'; latencyMs?: number; error?: string }> {
  const start = Date.now();
  try {
    const ping = await redisClient.ping();
    const latencyMs = Date.now() - start;
    if (ping === 'PONG') {
      return { status: 'healthy', latencyMs };
    }
    return { status: 'degraded', error: 'Unexpected ping response' };
  } catch (error) {
    return { status: 'degraded', error: (error as Error).message };
  }
}

export { redisClient, isConnected as isRedisConnected };
