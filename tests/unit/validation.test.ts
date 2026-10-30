import { describe, it, expect } from 'vitest';
import { createContactSchema } from '../../src/modules/contact/contact.schema.js';
import { subscribeNewsletterSchema } from '../../src/modules/newsletter/newsletter.schema.js';
import { submitApplicationSchema } from '../../src/modules/careers/careers.schema.js';

describe('Validation Schemas Unit Tests', () => {
  describe('Email Validation & Normalization', () => {
    it('should validate and normalize valid emails', () => {
      const valid = subscribeNewsletterSchema.safeParse({ email: '  Alex.Rivera@Example.COM  ' });
      expect(valid.success).toBe(true);
      if (valid.success) {
        expect(valid.data.email).toBe('alex.rivera@example.com');
      }
    });

    it('should reject invalid email formats', () => {
      const invalidEmails = ['plainaddress', '@missingusername.com', 'user@.com', 'user@domain..com', 'user space@domain.com'];
      for (const email of invalidEmails) {
        const res = subscribeNewsletterSchema.safeParse({ email });
        expect(res.success).toBe(false);
      }
    });

    it('should reject emails exceeding maximum length (255 characters)', () => {
      const longEmail = 'a'.repeat(250) + '@example.com';
      const res = subscribeNewsletterSchema.safeParse({ email: longEmail });
      expect(res.success).toBe(false);
    });
  });

  describe('Careers Application URL Validation (Addressing Issue 3)', () => {
    const validBaseApp = {
      jobId: 'business-development-intern',
      fullName: 'Alex Rivera',
      email: 'alex.rivera@domain.com',
      phone: '+919876543210',
      whatsapp: '+919876543210',
      dob: '2001-05-15',
      education: [
        {
          qualificationLevel: 'Bachelor’s Degree',
          degree: 'B.Tech / B.E.',
          university: 'State University',
          graduationYear: '2025',
          scoreType: 'CGPA',
          scoreValue: '8.5',
          status: 'Completed'
        }
      ],
      noticePeriod: 'Immediate',
      skills: 'TypeScript, Node.js, Express',
      currentCity: 'Jaipur',
      portfolioUrl: 'https://drive.google.com/file/d/blueprint123',
      linkedinUrl: 'https://linkedin.com/in/alex-rivera',
      professionalProfileUrl: 'https://github.com/alexrivera',
      agreedToTerms: true
    };

    it('should accept valid portfolio, linkedin and github URLs', () => {
      const res = submitApplicationSchema.safeParse(validBaseApp);
      expect(res.success).toBe(true);
    });

    it('should reject malformed portfolioUrl with exact field identification', () => {
      const invalid = { ...validBaseApp, portfolioUrl: 'not-a-valid-url' };
      const res = submitApplicationSchema.safeParse(invalid);
      expect(res.success).toBe(false);
      if (!res.success) {
        const error = res.error.errors.find((e) => e.path.includes('portfolioUrl'));
        expect(error).toBeDefined();
        expect(error?.message).toContain('Please enter a valid URL');
      }
    });

    it('should reject non-HTTP protocols in URLs (e.g., javascript: or ftp:)', () => {
      const invalid = { ...validBaseApp, linkedinUrl: 'javascript:alert(1)' };
      const res = submitApplicationSchema.safeParse(invalid);
      expect(res.success).toBe(false);
      if (!res.success) {
        const error = res.error.errors.find((e) => e.path.includes('linkedinUrl'));
        expect(error).toBeDefined();
      }
    });

    it('should handle optional empty professionalProfileUrl correctly', () => {
      const appWithEmptyOptional = { ...validBaseApp, professionalProfileUrl: '' };
      const res = submitApplicationSchema.safeParse(appWithEmptyOptional);
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.professionalProfileUrl).toBeUndefined();
      }
    });

    it('should strictly reject unknown / unexpected fields (prevent parameter pollution)', () => {
      const appWithExtra = { ...validBaseApp, maliciousField: 'sql injection or pollution' };
      const res = submitApplicationSchema.safeParse(appWithExtra);
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.errors[0].code).toBe('unrecognized_keys');
      }
    });

    it('should reject submission if agreedToTerms is false', () => {
      const appUnagreed = { ...validBaseApp, agreedToTerms: false };
      const res = submitApplicationSchema.safeParse(appUnagreed);
      expect(res.success).toBe(false);
    });
  });

  describe('Contact Form Validation', () => {
    it('should accept valid contact input with optional empty fields', () => {
      const input = {
        fullName: 'Jane Doe',
        email: 'jane@example.com',
        company: '',
        industry: '',
        message: 'We are looking to architect a new high-throughput backend system.'
      };
      const res = createContactSchema.safeParse(input);
      expect(res.success).toBe(true);
    });

    it('should reject excessively short message', () => {
      const input = {
        fullName: 'Jane Doe',
        email: 'jane@example.com',
        message: 'Short'
      };
      const res = createContactSchema.safeParse(input);
      expect(res.success).toBe(false);
      if (!res.success) {
        const msgError = res.error.errors.find((e) => e.path.includes('message'));
        expect(msgError).toBeDefined();
      }
    });

    it('should reject excessively long message (exceeding 3000 chars)', () => {
      const input = {
        fullName: 'Jane Doe',
        email: 'jane@example.com',
        message: 'A'.repeat(3001)
      };
      const res = createContactSchema.safeParse(input);
      expect(res.success).toBe(false);
    });
  });
});
