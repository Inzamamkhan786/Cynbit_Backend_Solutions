import { query, closeDb } from '../config/database.js';
import { logger } from '../utils/logger.js';

export async function runMigrations(): Promise<void> {
  logger.info('Starting PostgreSQL schema migrations...');

  const schemaSql = `
    -- Contacts Table
    CREATE TABLE IF NOT EXISTS contacts (
      id UUID PRIMARY KEY,
      full_name VARCHAR(120) NOT NULL,
      email VARCHAR(255) NOT NULL,
      company VARCHAR(150),
      industry VARCHAR(150),
      message TEXT NOT NULL,
      status VARCHAR(50) DEFAULT 'PENDING' NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_contacts_email ON contacts(email);
    CREATE INDEX IF NOT EXISTS idx_contacts_created_at ON contacts(created_at DESC);

    -- Newsletter Subscribers Table
    CREATE TABLE IF NOT EXISTS newsletter_subscribers (
      id UUID PRIMARY KEY,
      email VARCHAR(255) UNIQUE NOT NULL,
      status VARCHAR(50) DEFAULT 'ACTIVE' NOT NULL,
      confirmation_token VARCHAR(255),
      confirmed_at TIMESTAMP WITH TIME ZONE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_newsletter_email ON newsletter_subscribers(email);

    -- Jobs Table
    CREATE TABLE IF NOT EXISTS jobs (
      id VARCHAR(100) PRIMARY KEY,
      title VARCHAR(150) NOT NULL,
      department VARCHAR(100) NOT NULL,
      location VARCHAR(100) NOT NULL,
      type VARCHAR(50) NOT NULL,
      status VARCHAR(50) DEFAULT 'OPEN' NOT NULL,
      description TEXT NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
    );

    -- Seed Jobs if empty
    INSERT INTO jobs (id, title, department, location, type, status, description)
    VALUES
      ('hr-talent-acquisition-intern', 'HR & Talent Acquisition Intern', 'Operations', 'Jaipur / Hybrid', 'Internship', 'OPEN', 'Drive high-impact technical recruitment and culture across engineering teams.'),
      ('business-development-intern', 'Business Development Intern', 'Growth', 'Jaipur / Remote', 'Internship', 'OPEN', 'Identify enterprise client opportunities and strategic industry partnerships.'),
      ('campus-ambassador-campus-relations-intern', 'Campus Ambassador & Campus Relations Intern', 'Ecosystem', 'Remote', 'Internship', 'OPEN', 'Scale BitElevate university relations and developer community engagement.')
    ON CONFLICT (id) DO NOTHING;

    -- Job Applications Table
    CREATE TABLE IF NOT EXISTS job_applications (
      id UUID PRIMARY KEY,
      job_id VARCHAR(100) REFERENCES jobs(id) ON DELETE CASCADE NOT NULL,
      full_name VARCHAR(120) NOT NULL,
      email VARCHAR(255) NOT NULL,
      phone VARCHAR(20) NOT NULL,
      whatsapp VARCHAR(20) NOT NULL,
      dob VARCHAR(20) NOT NULL,
      education JSONB NOT NULL,
      notice_period VARCHAR(50) NOT NULL,
      skills VARCHAR(255) NOT NULL,
      current_city VARCHAR(100) NOT NULL,
      portfolio_url VARCHAR(500) NOT NULL,
      linkedin_url VARCHAR(500) NOT NULL,
      professional_profile_url VARCHAR(500),
      agreed_to_terms BOOLEAN NOT NULL DEFAULT TRUE,
      status VARCHAR(50) DEFAULT 'SUBMITTED' NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
      CONSTRAINT unique_job_candidate UNIQUE(job_id, email)
    );
    CREATE INDEX IF NOT EXISTS idx_job_applications_job_id ON job_applications(job_id);
    CREATE INDEX IF NOT EXISTS idx_job_applications_email ON job_applications(email);

    -- Idempotency Keys Table
    CREATE TABLE IF NOT EXISTS idempotency_keys (
      key VARCHAR(255) PRIMARY KEY,
      request_hash VARCHAR(64) NOT NULL,
      response_status INTEGER NOT NULL,
      response_body JSONB NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_idempotency_created_at ON idempotency_keys(created_at);

    -- Outbox Emails Table for Asynchronous Notification Pattern
    CREATE TABLE IF NOT EXISTS outbox_emails (
      id UUID PRIMARY KEY,
      recipient VARCHAR(255) NOT NULL,
      subject VARCHAR(255) NOT NULL,
      payload JSONB NOT NULL,
      status VARCHAR(50) DEFAULT 'QUEUED' NOT NULL,
      retry_count INTEGER DEFAULT 0 NOT NULL,
      error_message TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
      processed_at TIMESTAMP WITH TIME ZONE
    );
    CREATE INDEX IF NOT EXISTS idx_outbox_emails_status ON outbox_emails(status);
  `;

  try {
    await query(schemaSql);
    logger.info('Database schema migrations completed successfully.');
  } catch (error) {
    logger.error('Failed to run database migrations', undefined, error as Error);
    throw error;
  }
}

if (process.argv[1]?.endsWith('migrate.ts') || process.argv[1]?.endsWith('migrate.js')) {
  runMigrations()
    .then(async () => {
      await closeDb();
      process.exit(0);
    })
    .catch(async (err) => {
      console.error(err);
      await closeDb();
      process.exit(1);
    });
}
