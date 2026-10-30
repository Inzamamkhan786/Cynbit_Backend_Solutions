import { Request, Response, NextFunction } from 'express';
import { contactService } from './contact.service.js';
import { ApiResponse } from '../../utils/apiResponse.js';

export class ContactController {
  async submitContact(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const idempotencyKey = (req.headers['idempotency-key'] as string) || undefined;
      const result = await contactService.processInquiry(req.body, idempotencyKey);

      // Return HTTP 202 Accepted to signal durable ingestion without falsely guaranteeing instant delivery
      ApiResponse.accepted(res, result, result.message, {
        idempotencyKey: idempotencyKey || null,
        isIdempotentReplay: result.isIdempotentReplay || false
      });
    } catch (error) {
      next(error);
    }
  }
}

export const contactController = new ContactController();
