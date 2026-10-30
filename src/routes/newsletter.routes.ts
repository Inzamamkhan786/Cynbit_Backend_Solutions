import { Router } from 'express';
import { newsletterController } from '../modules/newsletter/newsletter.controller.js';
import { subscribeNewsletterSchema } from '../modules/newsletter/newsletter.schema.js';
import { validateSchema } from '../middleware/validateSchema.js';
import { newsletterRateLimiter } from '../middleware/rateLimiter.js';

const router = Router();

router.post(
  '/subscribe',
  newsletterRateLimiter,
  validateSchema({ body: subscribeNewsletterSchema }),
  newsletterController.subscribe
);

export default router;
