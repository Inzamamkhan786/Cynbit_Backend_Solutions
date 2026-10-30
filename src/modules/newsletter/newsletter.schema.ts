import { z } from 'zod';

export const subscribeNewsletterSchema = z.object({
  email: z
    .string({ required_error: 'Email address is required' })
    .trim()
    .toLowerCase()
    .email({ message: 'Please enter a valid email address (e.g., alex@company.com)' })
    .max(255, { message: 'Email address cannot exceed 255 characters' })
}).strict();

export type SubscribeNewsletterInput = z.infer<typeof subscribeNewsletterSchema>;
