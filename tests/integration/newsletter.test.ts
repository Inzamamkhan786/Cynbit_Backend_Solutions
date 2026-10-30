import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app.js';

describe('Newsletter API Integration Tests', () => {
  it('should successfully subscribe a new email and return HTTP 201 Created', async () => {
    const res = await request(app)
      .post('/api/v1/newsletter/subscribe')
      .send({ email: 'new.architect@example.com' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.subscriberId).toBeDefined();
    expect(res.body.data.isExistingSubscriber).toBe(false);
  });

  it('should handle duplicate subscriptions gracefully with HTTP 200 without database error', async () => {
    const email = 'duplicate.subscriber@example.com';

    // 1st subscribe
    await request(app)
      .post('/api/v1/newsletter/subscribe')
      .send({ email });

    // 2nd subscribe
    const res = await request(app)
      .post('/api/v1/newsletter/subscribe')
      .send({ email });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.isExistingSubscriber).toBe(true);
    expect(res.body.message).toContain('already subscribed');
  });

  it('should reject malformed email format with RFC 9457 structured error', async () => {
    const res = await request(app)
      .post('/api/v1/newsletter/subscribe')
      .send({ email: 'not-an-email' });

    expect(res.status).toBe(400);
    expect(res.body.type).toBe('https://api.cynbit.in/errors/validation-error');
    expect(res.body.errors).toBeDefined();
    expect(res.body.errors[0].field).toBe('email');
  });
});
