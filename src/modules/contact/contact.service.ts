import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { CreateContactInput } from './contact.schema.js';
import { contactRepository, ContactRecord } from './contact.repository.js';
import { emailService } from '../../services/email.service.js';
import { ConflictError } from '../../utils/appError.js';
import { logger } from '../../utils/logger.js';

export interface ContactSubmissionResult {
  inquiryId: string;
  status: 'PENDING';
  message: string;
  isIdempotentReplay?: boolean;
  notificationJobId?: string;
  createdAt: string;
}

export class ContactService {
  async processInquiry(
    input: CreateContactInput,
    idempotencyKey?: string
  ): Promise<ContactSubmissionResult> {
    const payloadHash = crypto.createHash('sha256').update(JSON.stringify(input)).digest('hex');

    // 1. Idempotency Check
    if (idempotencyKey) {
      const existing = await contactRepository.findIdempotencyKey(idempotencyKey);
      if (existing) {
        if (existing.request_hash !== payloadHash) {
          throw new ConflictError(
            'Idempotency-Key reuse with conflicting request payload. Use a unique key for different requests.'
          );
        }
        logger.info(`Returning cached idempotent response for key: ${idempotencyKey}`);
        return {
          ...(existing.response_body as unknown as ContactSubmissionResult),
          isIdempotentReplay: true
        };
      }
    }

    // 2. Durable Database Persistence
    const inquiryId = uuidv4();
    const record: ContactRecord = await contactRepository.create({
      id: inquiryId,
      fullName: input.fullName,
      email: input.email,
      company: input.company,
      industry: input.industry,
      message: input.message,
      status: 'PENDING'
    });

    // 3. Queue Asynchronous Email Notification
    const { jobId } = await emailService.queueEmail({
      to: input.email,
      subject: 'Inquiry Received - Cynbit Technologies',
      body: `Hi ${input.fullName},\n\nThank you for reaching out to Cynbit Technologies. Your inquiry [Ref: ${inquiryId}] has been logged and queued for our architectural review team.\n\nBest regards,\nCynbit Team`,
      metadata: { inquiryId }
    });

    const result: ContactSubmissionResult = {
      inquiryId: record.id,
      status: 'PENDING',
      message: 'Inquiry received and queued for review. A confirmation email has been scheduled.',
      notificationJobId: jobId,
      createdAt: (record.created_at || new Date()).toISOString()
    };

    // 4. Save Idempotency Key
    if (idempotencyKey) {
      await contactRepository.saveIdempotencyKey(idempotencyKey, payloadHash, 202, result as unknown as Record<string, unknown>);
    }

    return result;
  }
}

export const contactService = new ContactService();
