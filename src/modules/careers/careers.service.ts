import { v4 as uuidv4 } from 'uuid';
import { SubmitApplicationInput } from './careers.schema.js';
import { careersRepository, JobRecord, JobApplicationRecord } from './careers.repository.js';
import { emailService } from '../../services/email.service.js';
import { NotFoundError, ConflictError } from '../../utils/appError.js';
import { logger } from '../../utils/logger.js';

export interface ApplicationSubmissionResult {
  applicationId: string;
  jobId: string;
  jobTitle: string;
  status: 'SUBMITTED';
  trackingUrl: string;
  message: string;
  submittedAt: string;
}

export class CareersService {
  async getOpenJobs(department?: string): Promise<JobRecord[]> {
    return careersRepository.findJobs(department);
  }

  async getJobById(jobId: string): Promise<JobRecord> {
    const job = await careersRepository.findJobById(jobId);
    if (!job) {
      throw new NotFoundError(`Job listing with identifier '${jobId}' was not found.`);
    }
    return job;
  }

  async submitApplication(input: SubmitApplicationInput): Promise<ApplicationSubmissionResult> {
    // 1. Verify Job existence
    const job = await this.getJobById(input.jobId);

    // 2. Check duplicate application
    const existing = await careersRepository.findApplication(input.jobId, input.email);
    if (existing) {
      logger.warn(`Duplicate candidate application attempt for job: ${input.jobId}, email: ${input.email}`);
      throw new ConflictError(
        `You have already submitted an active application for position '${job.title}'. Your blueprint is currently under architectural review.`
      );
    }

    // 3. Durable persistence
    const applicationId = uuidv4();
    const created: JobApplicationRecord = await careersRepository.createApplication({
      id: applicationId,
      jobId: input.jobId,
      fullName: input.fullName,
      email: input.email,
      phone: input.phone,
      whatsapp: input.whatsapp,
      dob: input.dob,
      education: input.education,
      noticePeriod: input.noticePeriod,
      skills: input.skills,
      currentCity: input.currentCity,
      portfolioUrl: input.portfolioUrl,
      linkedinUrl: input.linkedinUrl,
      professionalProfileUrl: input.professionalProfileUrl,
      agreedToTerms: input.agreedToTerms
    });

    // 4. Queue candidate acknowledgement email
    await emailService.queueEmail({
      to: input.email,
      subject: `Application Received: ${job.title} - Cynbit Technologies`,
      body: `Hi ${input.fullName},\n\nThank you for applying for the ${job.title} role at Cynbit Technologies.\n\nYour application reference is: ${applicationId}.\nOur engineering and hiring team will review your submission.\n\nBest regards,\nCynbit Talent Acquisition`,
      metadata: { applicationId, jobId: input.jobId }
    });

    return {
      applicationId: created.id,
      jobId: input.jobId,
      jobTitle: job.title,
      status: 'SUBMITTED',
      trackingUrl: `/careers/status/${applicationId}`,
      message: 'Your technical blueprint has been submitted successfully.',
      submittedAt: (created.created_at || new Date()).toISOString()
    };
  }
}

export const careersService = new CareersService();
