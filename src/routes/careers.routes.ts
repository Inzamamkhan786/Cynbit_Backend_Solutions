import { Router } from 'express';
import { careersController } from '../modules/careers/careers.controller.js';
import { submitApplicationSchema } from '../modules/careers/careers.schema.js';
import { validateSchema } from '../middleware/validateSchema.js';
import { careersRateLimiter } from '../middleware/rateLimiter.js';

const router = Router();

router.get('/jobs', careersController.getJobs);
router.get('/jobs/:id', careersController.getJobById);

router.post(
  '/applications',
  careersRateLimiter,
  validateSchema({ body: submitApplicationSchema }),
  careersController.submitApplication
);

export default router;
