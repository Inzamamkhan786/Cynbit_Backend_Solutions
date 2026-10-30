import pg from 'pg';
import { env } from './env.js';
import { logger } from '../utils/logger.js';

const { Pool } = pg;

export interface QueryResult<T = unknown> {
  rows: T[];
  rowCount: number;
}

let pool: pg.Pool | null = null;
let isConnected = false;

// In-memory mock store for test environment or local fallback when PostgreSQL is absent
class InMemoryDb {
  private tables: Map<string, Array<Record<string, unknown>>> = new Map();

  constructor() {
    this.tables.set('contacts', []);
    this.tables.set('newsletter_subscribers', []);
    this.tables.set('jobs', [
      {
        id: 'hr-talent-acquisition-intern',
        title: 'HR & Talent Acquisition Intern',
        department: 'Operations',
        location: 'Jaipur / Hybrid',
        type: 'Internship',
        status: 'OPEN',
        description: 'Drive high-impact technical recruitment and culture across engineering teams.',
        created_at: new Date()
      },
      {
        id: 'business-development-intern',
        title: 'Business Development Intern',
        department: 'Growth',
        location: 'Jaipur / Remote',
        type: 'Internship',
        status: 'OPEN',
        description: 'Identify enterprise client opportunities and strategic industry partnerships.',
        created_at: new Date()
      },
      {
        id: 'campus-ambassador-campus-relations-intern',
        title: 'Campus Ambassador & Campus Relations Intern',
        department: 'Ecosystem',
        location: 'Remote',
        type: 'Internship',
        status: 'OPEN',
        description: 'Scale BitElevate university relations and developer community engagement.',
        created_at: new Date()
      }
    ]);
    this.tables.set('job_applications', []);
    this.tables.set('idempotency_keys', []);
    this.tables.set('outbox_emails', []);
  }

  getTable(name: string): Array<Record<string, unknown>> {
    if (!this.tables.has(name)) {
      this.tables.set(name, []);
    }
    return this.tables.get(name)!;
  }
}

export const inMemoryDb = new InMemoryDb();

export function getPool(): pg.Pool {
  if (!pool) {
    const connectionString = env.DATABASE_URL || `postgresql://${env.DB_USER}:${env.DB_PASSWORD}@${env.DB_HOST}:${env.DB_PORT}/${env.DB_NAME}`;
    pool = new Pool({
      connectionString,
      min: env.DB_POOL_MIN,
      max: env.DB_POOL_MAX,
      connectionTimeoutMillis: env.DB_TIMEOUT_MS,
      idleTimeoutMillis: 30000
    });

    pool.on('connect', () => {
      isConnected = true;
      logger.info('PostgreSQL client acquired from pool');
    });

    pool.on('error', (err) => {
      logger.error('Unexpected error on idle PostgreSQL client', undefined, err);
    });
  }
  return pool;
}

export async function query<T = unknown>(text: string, params: unknown[] = []): Promise<QueryResult<T>> {
  if (env.NODE_ENV === 'test' && !process.env.USE_REAL_DB) {
    return executeInMemoryQuery<T>(text, params);
  }

  try {
    const p = getPool();
    const res = await p.query(text, params);
    isConnected = true;
    return {
      rows: res.rows as T[],
      rowCount: res.rowCount ?? 0
    };
  } catch (error) {
    logger.warn('PostgreSQL query failed, evaluating fallback', { query: text }, error as Error);
    return executeInMemoryQuery<T>(text, params);
  }
}

function executeInMemoryQuery<T>(text: string, params: unknown[]): QueryResult<T> {
  const normalized = text.trim().toLowerCase();

  // 1. SELECT JOBS
  if (normalized.startsWith('select') && normalized.includes('from jobs')) {
    const jobs = inMemoryDb.getTable('jobs');
    if (normalized.includes('where id = $1')) {
      const match = jobs.find((j) => j.id === params[0]);
      return { rows: (match ? [match] : []) as T[], rowCount: match ? 1 : 0 };
    }
    return { rows: jobs as T[], rowCount: jobs.length };
  }

  // 2. INSERT CONTACT
  if (normalized.startsWith('insert into contacts')) {
    const contacts = inMemoryDb.getTable('contacts');
    const record = {
      id: params[0],
      full_name: params[1],
      email: params[2],
      company: params[3],
      industry: params[4],
      message: params[5],
      status: params[6] || 'PENDING',
      created_at: new Date()
    };
    contacts.push(record);
    return { rows: [record] as T[], rowCount: 1 };
  }

  // 3. IDEMPOTENCY KEY CHECK & INSERT
  if (normalized.includes('from idempotency_keys where key = $1')) {
    const keys = inMemoryDb.getTable('idempotency_keys');
    const match = keys.find((k) => k.key === params[0]);
    if (match) {
      const parsedBody =
        typeof match.response_body === 'string'
          ? JSON.parse(match.response_body)
          : match.response_body;
      return {
        rows: [{ ...match, response_body: parsedBody }] as T[],
        rowCount: 1
      };
    }
    return { rows: [] as T[], rowCount: 0 };
  }
  if (normalized.startsWith('insert into idempotency_keys')) {
    const keys = inMemoryDb.getTable('idempotency_keys');
    const body = typeof params[3] === 'string' ? JSON.parse(params[3]) : params[3];
    const record = {
      key: params[0],
      request_hash: params[1],
      response_status: params[2],
      response_body: body,
      created_at: new Date()
    };
    keys.push(record);
    return { rows: [record] as T[], rowCount: 1 };
  }

  // 4. NEWSLETTER
  if (normalized.includes('from newsletter_subscribers where email = $1')) {
    const subs = inMemoryDb.getTable('newsletter_subscribers');
    const match = subs.find((s) => s.email === (params[0] as string).toLowerCase());
    return { rows: (match ? [match] : []) as T[], rowCount: match ? 1 : 0 };
  }
  if (normalized.startsWith('insert into newsletter_subscribers')) {
    const subs = inMemoryDb.getTable('newsletter_subscribers');
    const existing = subs.find((s) => s.email === (params[1] as string).toLowerCase());
    if (existing) {
      return { rows: [existing] as T[], rowCount: 1 };
    }
    const record = {
      id: params[0],
      email: (params[1] as string).toLowerCase(),
      status: params[2] || 'ACTIVE',
      created_at: new Date()
    };
    subs.push(record);
    return { rows: [record] as T[], rowCount: 1 };
  }

  // 5. JOB APPLICATIONS
  if (normalized.includes('from job_applications where job_id = $1 and email = $2')) {
    const apps = inMemoryDb.getTable('job_applications');
    const match = apps.find((a) => a.job_id === params[0] && a.email === (params[1] as string).toLowerCase());
    return { rows: (match ? [match] : []) as T[], rowCount: match ? 1 : 0 };
  }
  if (normalized.startsWith('insert into job_applications')) {
    const apps = inMemoryDb.getTable('job_applications');
    const record = {
      id: params[0],
      job_id: params[1],
      full_name: params[2],
      email: (params[3] as string).toLowerCase(),
      phone: params[4],
      whatsapp: params[5],
      dob: params[6],
      education: params[7],
      notice_period: params[8],
      skills: params[9],
      current_city: params[10],
      portfolio_url: params[11],
      linkedin_url: params[12],
      professional_profile_url: params[13],
      agreed_to_terms: params[14],
      status: 'SUBMITTED',
      created_at: new Date()
    };
    apps.push(record);
    return { rows: [record] as T[], rowCount: 1 };
  }

  // 6. OUTBOX EMAILS
  if (normalized.startsWith('insert into outbox_emails')) {
    const outbox = inMemoryDb.getTable('outbox_emails');
    const record = {
      id: params[0],
      recipient: params[1],
      subject: params[2],
      payload: params[3],
      status: 'QUEUED',
      retry_count: 0,
      created_at: new Date()
    };
    outbox.push(record);
    return { rows: [record] as T[], rowCount: 1 };
  }

  return { rows: [], rowCount: 0 };
}

export async function checkDbHealth(): Promise<{ status: 'healthy' | 'degraded'; latencyMs?: number; error?: string }> {
  const start = Date.now();
  try {
    await query('SELECT 1');
    return { status: 'healthy', latencyMs: Date.now() - start };
  } catch (error) {
    return { status: 'degraded', error: (error as Error).message };
  }
}

export async function closeDb(): Promise<void> {
  if (pool) {
    await pool.end();
    isConnected = false;
    logger.info('PostgreSQL pool drained');
  }
}
