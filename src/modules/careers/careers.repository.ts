import { query } from '../../config/database.js';

export interface JobRecord {
  id: string;
  title: string;
  department: string;
  location: string;
  type: string;
  status: string;
  description: string;
  created_at: Date;
}

export interface JobApplicationRecord {
  id: string;
  job_id: string;
  full_name: string;
  email: string;
  phone: string;
  whatsapp: string;
  dob: string;
  education: Record<string, unknown>;
  notice_period: string;
  skills: string;
  current_city: string;
  portfolio_url: string;
  linkedin_url: string;
  professional_profile_url?: string;
  agreed_to_terms: boolean;
  status: string;
  created_at: Date;
}

export class CareersRepository {
  async findJobs(department?: string): Promise<JobRecord[]> {
    if (department) {
      const res = await query<JobRecord>(
        'SELECT id, title, department, location, type, status, description, created_at FROM jobs WHERE status = $1 AND department = $2 ORDER BY created_at DESC',
        ['OPEN', department]
      );
      return res.rows;
    }
    const res = await query<JobRecord>(
      'SELECT id, title, department, location, type, status, description, created_at FROM jobs WHERE status = $1 ORDER BY created_at DESC',
      ['OPEN']
    );
    return res.rows;
  }

  async findJobById(id: string): Promise<JobRecord | null> {
    const res = await query<JobRecord>(
      'SELECT id, title, department, location, type, status, description, created_at FROM jobs WHERE id = $1',
      [id]
    );
    return res.rows[0] || null;
  }

  async findApplication(jobId: string, email: string): Promise<JobApplicationRecord | null> {
    const res = await query<JobApplicationRecord>(
      'SELECT id, job_id, full_name, email, status, created_at FROM job_applications WHERE job_id = $1 AND email = $2',
      [jobId, email.toLowerCase()]
    );
    return res.rows[0] || null;
  }

  async createApplication(record: {
    id: string;
    jobId: string;
    fullName: string;
    email: string;
    phone: string;
    whatsapp: string;
    dob: string;
    education: unknown;
    noticePeriod: string;
    skills: string;
    currentCity: string;
    portfolioUrl: string;
    linkedinUrl: string;
    professionalProfileUrl?: string;
    agreedToTerms: boolean;
  }): Promise<JobApplicationRecord> {
    const res = await query<JobApplicationRecord>(
      `INSERT INTO job_applications (
        id, job_id, full_name, email, phone, whatsapp, dob, education, notice_period, skills,
        current_city, portfolio_url, linkedin_url, professional_profile_url, agreed_to_terms, status, created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, 'SUBMITTED', NOW())
      RETURNING id, job_id, full_name, email, phone, whatsapp, dob, education, notice_period, skills, current_city, portfolio_url, linkedin_url, professional_profile_url, agreed_to_terms, status, created_at`,
      [
        record.id,
        record.jobId,
        record.fullName,
        record.email.toLowerCase(),
        record.phone,
        record.whatsapp,
        record.dob,
        JSON.stringify(record.education),
        record.noticePeriod,
        record.skills,
        record.currentCity,
        record.portfolioUrl,
        record.linkedinUrl,
        record.professionalProfileUrl || null,
        record.agreedToTerms
      ]
    );
    return res.rows[0];
  }
}

export const careersRepository = new CareersRepository();
