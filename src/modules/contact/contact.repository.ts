import { query } from '../../config/database.js';

export interface ContactRecord {
  id: string;
  full_name: string;
  email: string;
  company?: string;
  industry?: string;
  message: string;
  status: string;
  created_at: Date;
}

export interface IdempotencyRecord {
  key: string;
  request_hash: string;
  response_status: number;
  response_body: Record<string, unknown>;
  created_at: Date;
}

export class ContactRepository {
  async findIdempotencyKey(key: string): Promise<IdempotencyRecord | null> {
    const res = await query<IdempotencyRecord>(
      'SELECT key, request_hash, response_status, response_body, created_at FROM idempotency_keys WHERE key = $1',
      [key]
    );
    return res.rows[0] || null;
  }

  async saveIdempotencyKey(
    key: string,
    requestHash: string,
    status: number,
    body: Record<string, unknown>
  ): Promise<void> {
    await query(
      `INSERT INTO idempotency_keys (key, request_hash, response_status, response_body, created_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (key) DO NOTHING`,
      [key, requestHash, status, JSON.stringify(body)]
    );
  }

  async create(record: {
    id: string;
    fullName: string;
    email: string;
    company?: string;
    industry?: string;
    message: string;
    status: string;
  }): Promise<ContactRecord> {
    const res = await query<ContactRecord>(
      `INSERT INTO contacts (id, full_name, email, company, industry, message, status, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
       RETURNING id, full_name, email, company, industry, message, status, created_at`,
      [
        record.id,
        record.fullName,
        record.email,
        record.company || null,
        record.industry || null,
        record.message,
        record.status
      ]
    );
    return res.rows[0];
  }
}

export const contactRepository = new ContactRepository();
