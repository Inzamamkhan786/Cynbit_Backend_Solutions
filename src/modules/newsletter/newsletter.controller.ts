import { Request, Response, NextFunction } from 'express';
import { newsletterService } from './newsletter.service.js';
import { ApiResponse } from '../../utils/apiResponse.js';

export class NewsletterController {
  async subscribe(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await newsletterService.subscribe(req.body);

      if (result.isExistingSubscriber) {
        ApiResponse.success(res, result, result.message, 200);
      } else {
        ApiResponse.created(res, result, result.message);
      }
    } catch (error) {
      next(error);
    }
  }
}

export const newsletterController = new NewsletterController();
