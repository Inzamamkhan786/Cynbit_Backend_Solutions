import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app.js';

describe('Careers API Integration Tests', () => {
  const validAppPayload = {
    jobId: 'business-development-intern',
    fullName: 'Jordan Lee',
    email: 'jordan.lee@domain.com',
    phone: '+919876543210',
    whatsapp: '+919876543210',
    dob: '2000-08-20',
    education: [
      {
        qualificationLevel: 'Bachelor’s Degree',
        degree: 'B.Tech / B.E.',
        university: 'National Institute of Tech',
        graduationYear: '2025',
        scoreType: 'CGPA',
        scoreValue: '9.1',
        status: 'Completed'
      }
    ],
    noticePeriod: 'Immediate',
    skills: 'Distributed Systems, Node.js, Express',
    currentCity: 'Jaipur',
    portfolioUrl: 'https://drive.google.com/file/d/jordan-blueprint',
    linkedinUrl: 'https://linkedin.com/in/jordanlee',
    professionalProfileUrl: 'https://github.com/jordanlee',
    agreedToTerms: true
  };

  it('should list open job positions (GET /api/v1/careers/jobs)', async () => {
    const res = await request(app).get('/api/v1/careers/jobs');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.data[0].id).toBeDefined();
  });

  it('should accept a valid candidate application and return HTTP 201 Created', async () => {
    const res = await request(app)
      .post('/api/v1/careers/applications')
      .send(validAppPayload);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.applicationId).toBeDefined();
    expect(res.body.data.status).toBe('SUBMITTED');
  });

  it('should reject malformed portfolio URL and return exact field identification (Issue 3 resolution)', async () => {
    const res = await request(app)
      .post('/api/v1/careers/applications')
      .send({
        ...validAppPayload,
        email: 'another.candidate@domain.com',
        portfolioUrl: 'malformed_url_string'
      });

    expect(res.status).toBe(400);
    expect(res.body.type).toBe('https://api.cynbit.in/errors/validation-error');
    expect(res.body.errors).toBeDefined();

    const urlError = res.body.errors.find((e: { field: string }) => e.field === 'portfolioUrl');
    expect(urlError).toBeDefined();
    expect(urlError.message).toContain('Please enter a valid URL');
  });

  it('should reject duplicate applications for the same job and email (HTTP 409 Conflict)', async () => {
    // Attempt duplicate submission with same email & jobId
    const duplicateRes = await request(app)
      .post('/api/v1/careers/applications')
      .send(validAppPayload);

    expect(duplicateRes.status).toBe(409);
    expect(duplicateRes.body.type).toBe('https://api.cynbit.in/errors/conflict');
    expect(duplicateRes.body.detail).toContain('already submitted an active application');
  });
});
