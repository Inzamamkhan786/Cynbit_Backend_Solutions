import { Router, Request, Response } from 'express';
import { checkDbHealth } from '../config/database.js';
import { checkRedisHealth } from '../config/redis.js';
import { ApiResponse } from '../utils/apiResponse.js';

const router = Router();

router.get('/', async (_req: Request, res: Response) => {
  const [dbHealth, redisHealth] = await Promise.all([
    checkDbHealth(),
    checkRedisHealth()
  ]);

  const isHealthy = dbHealth.status === 'healthy' && redisHealth.status === 'healthy';
  const statusCode = isHealthy ? 200 : 207; // 207 Multi-Status if partially degraded

  const healthData = {
    status: isHealthy ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    services: {
      database: dbHealth,
      redis: redisHealth
    },
    system: {
      nodeVersion: process.version,
      memoryUsageMb: Math.round(process.memoryUsage().rss / (1024 * 1024)),
      environment: process.env.NODE_ENV || 'development'
    }
  };

  ApiResponse.success(
    res,
    healthData,
    isHealthy ? 'All services operational' : 'One or more background services are degraded',
    statusCode
  );
});

export default router;
