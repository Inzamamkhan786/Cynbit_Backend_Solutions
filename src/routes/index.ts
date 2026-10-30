import { Router } from 'express';
import contactRoutes from './contact.routes.js';
import newsletterRoutes from './newsletter.routes.js';
import careersRoutes from './careers.routes.js';
import healthRoutes from './health.routes.js';

const router = Router();

// Root metadata endpoint
router.get('/', (_req, res) => {
  res.json({
    service: 'Cynbit Backend Reference API',
    version: '1.0.0',
    documentation: '/api-docs',
    endpoints: {
      health: '/health',
      contact: '/api/v1/contact',
      newsletter: '/api/v1/newsletter/subscribe',
      careersJobs: '/api/v1/careers/jobs',
      careersApplications: '/api/v1/careers/applications'
    }
  });
});

// Health check
router.use('/health', healthRoutes);

// Version 1 API Routes
router.use('/api/v1/contact', contactRoutes);
router.use('/api/v1/newsletter', newsletterRoutes);
router.use('/api/v1/careers', careersRoutes);

export default router;
