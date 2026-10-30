import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app.js';

describe('Health Check Integration Tests', () => {
  it('should return 200 with service health statuses and runtime telemetry', async () => {
    const res = await request(app).get('/health');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBeDefined();
    expect(res.body.data.services).toBeDefined();
    expect(res.body.data.services.database).toBeDefined();
    expect(res.body.data.services.redis).toBeDefined();
    expect(res.body.data.system).toBeDefined();
    expect(res.body.data.system.nodeVersion).toBeDefined();
    expect(res.body.data.system.memoryUsageMb).toBeGreaterThan(0);
  });
});
