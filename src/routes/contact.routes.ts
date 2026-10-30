import { Router } from 'express';
import { contactController } from '../modules/contact/contact.controller.js';
import { createContactSchema } from '../modules/contact/contact.schema.js';
import { validateSchema } from '../middleware/validateSchema.js';
import { contactRateLimiter } from '../middleware/rateLimiter.js';

const router = Router();

router.post(
  '/',
  contactRateLimiter,
  validateSchema({ body: createContactSchema }),
  contactController.submitContact
);

export default router;
