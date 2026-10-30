import { query } from '../../config/database.js';

export interface NewsletterSubscriberRecord {
  id: string;
  email: string;
  status: string;
  confirmation_token?: string;
  confirmed_at?: Date;
  created_at: Date;
}

export class NewsletterRepository {
  async findByEmail(email: string): Promise<NewsletterSubscriberRecord | null> {
    const res = await query<NewsletterSubscriberRecord>(
      'SELECT id, email, status, confirmation_token, confirmed_at, created_at FROM newsletter_subscribers WHERE email = $1',
      [email.toLowerCase()]
    );
    return res.rows[0] || null;
  }

  async create(record: {
    id: string;
    email: string;
    status: string;
    confirmationToken?: string;
  }): Promise<NewsletterSubscriberRecord> {
    const res = await query<NewsletterSubscriberRecord>(
      `INSERT INTO newsletter_subscribers (id, email, status, confirmation_token, created_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (email) DO UPDATE SET updated_at = NOW()
       RETURNING id, email, status, confirmation_token, confirmed_at, created_at`,
      [record.id, record.email.toLowerCase(), record.status, record.confirmationToken || null]
    );
    return res.rows[0];
  }
}

export const newsletterRepository = new NewsletterRepository();
