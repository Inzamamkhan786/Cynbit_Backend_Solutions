import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app.js';

describe('Contact API Integration Tests', () => {
  const validContactPayload = {
    fullName: 'Alex Rivera',
    email: 'alex.rivera@example.com',
    company: 'NextGen Solutions',
    industry: 'Fintech',
    message: 'We are interested in evaluating your custom AI agents for our operations.'
  };

  it('should accept a valid inquiry and return HTTP 202 Accepted', async () => {
    const res = await request(app)
      .post('/api/v1/contact')
      .set('X-Forwarded-For', '10.0.1.1')
      .set('X-Request-Id', 'req_test_contact_01')
      .send(validContactPayload);

    expect(res.status).toBe(202);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('PENDING');
    expect(res.body.data.inquiryId).toBeDefined();
    expect(res.body.data.notificationJobId).toBeDefined();
    expect(res.headers['x-request-id']).toBe('req_test_contact_01');
  });

  it('should support Idempotency-Key and return identical cached response on replay', async () => {
    const idempotencyKey = 'idem_key_contact_12345';

    // First request
    const firstRes = await request(app)
      .post('/api/v1/contact')
      .set('X-Forwarded-For', '10.0.1.2')
      .set('Idempotency-Key', idempotencyKey)
      .send(validContactPayload);

    expect(firstRes.status).toBe(202);
    const initialInquiryId = firstRes.body.data.inquiryId;
    expect(initialInquiryId).toBeDefined();

    // Second request with same key and payload
    const secondRes = await request(app)
      .post('/api/v1/contact')
      .set('X-Forwarded-For', '10.0.1.2')
      .set('Idempotency-Key', idempotencyKey)
      .send(validContactPayload);

    expect(secondRes.status).toBe(202);
    expect(secondRes.body.data.inquiryId).toBe(initialInquiryId);
    expect(secondRes.body.meta.isIdempotentReplay).toBe(true);
  });

  it('should reject reused Idempotency-Key if the payload is different (HTTP 409)', async () => {
    const idempotencyKey = 'idem_key_contact_conflict';

    // First request
    await request(app)
      .post('/api/v1/contact')
      .set('X-Forwarded-For', '10.0.1.3')
      .set('Idempotency-Key', idempotencyKey)
      .send(validContactPayload);

    // Second request with conflicting payload
    const conflictRes = await request(app)
      .post('/api/v1/contact')
      .set('X-Forwarded-For', '10.0.1.3')
      .set('Idempotency-Key', idempotencyKey)
      .send({
        ...validContactPayload,
        fullName: 'Different Person',
        message: 'Completely different message body.'
      });

    expect(conflictRes.status).toBe(409);
    expect(conflictRes.body.type).toBe('https://api.cynbit.in/errors/conflict');
    expect(conflictRes.body.detail).toContain('Idempotency-Key reuse with conflicting request payload');
  });

  it('should reject invalid email and return RFC 9457 structured field errors', async () => {
    const res = await request(app)
      .post('/api/v1/contact')
      .set('X-Forwarded-For', '10.0.1.4')
      .send({
        ...validContactPayload,
        email: 'invalid-email-address'
      });

    expect(res.status).toBe(400);
    expect(res.body.type).toBe('https://api.cynbit.in/errors/validation-error');
    expect(res.body.errors).toBeDefined();
    const emailErr = res.body.errors.find((e: { field: string }) => e.field === 'email');
    expect(emailErr).toBeDefined();
    expect(emailErr.message).toContain('valid email address');
  });
});
