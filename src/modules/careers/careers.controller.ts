import { Request, Response, NextFunction } from 'express';
import { careersService } from './careers.service.js';
import { ApiResponse } from '../../utils/apiResponse.js';

export class CareersController {
  async getJobs(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const department = typeof req.query.department === 'string' ? req.query.department : undefined;
      const jobs = await careersService.getOpenJobs(department);
      ApiResponse.success(res, jobs, 'Active job openings retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  async getJobById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const jobId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const job = await careersService.getJobById(jobId as string);
      ApiResponse.success(res, job, 'Job details retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  async submitApplication(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await careersService.submitApplication(req.body);
      ApiResponse.created(res, result, result.message);
    } catch (error) {
      next(error);
    }
  }
}

export const careersController = new CareersController();
