import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { SubscribeNewsletterInput } from './newsletter.schema.js';
import { newsletterRepository, NewsletterSubscriberRecord } from './newsletter.repository.js';
import { emailService } from '../../services/email.service.js';
import { logger } from '../../utils/logger.js';

export interface NewsletterSubscriptionResult {
  subscriberId: string;
  email: string;
  status: 'ACTIVE' | 'PENDING_CONFIRMATION';
  isExistingSubscriber: boolean;
  message: string;
}

export class NewsletterService {
  async subscribe(input: SubscribeNewsletterInput): Promise<NewsletterSubscriptionResult> {
    const normalizedEmail = input.email.trim().toLowerCase();

    // 1. Check existing subscription
    const existing = await newsletterRepository.findByEmail(normalizedEmail);
    if (existing) {
      logger.info(`Idempotent newsletter subscription request for existing subscriber: ${normalizedEmail}`);
      return {
        subscriberId: existing.id,
        email: existing.email,
        status: existing.status as 'ACTIVE',
        isExistingSubscriber: true,
        message: 'You are already subscribed to the Cynbit Technical Briefing.'
      };
    }

    // 2. Create new subscriber
    const subscriberId = uuidv4();
    const confirmationToken = crypto.randomBytes(24).toString('hex');

    const created: NewsletterSubscriberRecord = await newsletterRepository.create({
      id: subscriberId,
      email: normalizedEmail,
      status: 'ACTIVE',
      confirmationToken
    });

    // 3. Queue Welcome / Confirmation Email Asynchronously
    await emailService.queueEmail({
      to: normalizedEmail,
      subject: 'Welcome to the Cynbit Technical Briefing',
      body: `Welcome to the Cynbit Briefing!\n\nYou will now receive our weekly deep-dives into modern architecture, AI agent infrastructure, and engineering best practices.\n\nTo manage your preferences or unsubscribe, use reference: ${subscriberId}`,
      metadata: { subscriberId, confirmationToken }
    });

    return {
      subscriberId: created.id,
      email: created.email,
      status: created.status as 'ACTIVE',
      isExistingSubscriber: false,
      message: 'Successfully subscribed to the Cynbit Technical Briefing.'
    };
  }
}

export const newsletterService = new NewsletterService();
