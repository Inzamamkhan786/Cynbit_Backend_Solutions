import { v4 as uuidv4 } from 'uuid';
import { query } from '../config/database.js';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

export interface EmailPayload {
  to: string;
  subject: string;
  body: string;
  metadata?: Record<string, unknown>;
}

export interface EmailJobRecord {
  id: string;
  recipient: string;
  subject: string;
  payload: Record<string, unknown>;
  status: 'QUEUED' | 'PROCESSING' | 'SENT' | 'FAILED';
  retry_count: number;
  error_message?: string;
  created_at: Date;
  processed_at?: Date;
}

class EmailService {
  async queueEmail(payload: EmailPayload): Promise<{ jobId: string }> {
    const jobId = uuidv4();

    logger.info(`Queueing email notification job [${jobId}] for ${payload.to}`, {
      jobId,
      recipient: payload.to,
      subject: payload.subject
    });

    // Durable persistence into outbox_emails table
    await query(
      `INSERT INTO outbox_emails (id, recipient, subject, payload, status, retry_count, created_at)
       VALUES ($1, $2, $3, $4, 'QUEUED', 0, NOW())`,
      [jobId, payload.to, payload.subject, JSON.stringify(payload)]
    );

    // Asynchronously trigger simulated background worker without blocking request cycle
    setImmediate(() => {
      this.dispatchEmail(jobId, payload).catch((err) => {
        logger.error(`Background worker failed processing email job ${jobId}`, { jobId }, err);
      });
    });

    return { jobId };
  }

  private async dispatchEmail(jobId: string, payload: EmailPayload): Promise<void> {
    logger.info(`[Email Worker] Processing notification job ${jobId}...`);

    try {
      // In development or test, mock successful dispatch
      if (env.EMAIL_PROVIDER === 'mock' || env.NODE_ENV === 'test') {
        logger.info(`[Email Worker] Simulated successful dispatch to ${payload.to} with subject "${payload.subject}"`);

        await query(
          `UPDATE outbox_emails
           SET status = 'SENT', processed_at = NOW()
           WHERE id = $1`,
          [jobId]
        );
        return;
      }

      // Production provider hook (e.g. SMTP or SES or SendGrid) can be plugged here
    } catch (error) {
      logger.error(`[Email Worker] Error dispatching email job ${jobId}`, { jobId }, error as Error);
      await query(
        `UPDATE outbox_emails
         SET retry_count = retry_count + 1, error_message = $2
         WHERE id = $1`,
        [jobId, (error as Error).message]
      );
    }
  }
}

export const emailService = new EmailService();
