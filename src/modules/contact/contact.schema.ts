import { z } from 'zod';

export const createContactSchema = z.object({
  fullName: z
    .string({ required_error: 'Full Name is required' })
    .trim()
    .min(2, { message: 'Full Name must be at least 2 characters' })
    .max(100, { message: 'Full Name cannot exceed 100 characters' }),
  email: z
    .string({ required_error: 'Email address is required' })
    .trim()
    .toLowerCase()
    .email({ message: 'Please provide a valid email address (e.g., alex@example.com)' })
    .max(255, { message: 'Email address cannot exceed 255 characters' }),
  company: z
    .string()
    .trim()
    .max(120, { message: 'Company name cannot exceed 120 characters' })
    .optional()
    .or(z.literal('')),
  industry: z
    .string()
    .trim()
    .max(120, { message: 'Industry name cannot exceed 120 characters' })
    .optional()
    .or(z.literal('')),
  message: z
    .string({ required_error: 'Message is required' })
    .trim()
    .min(10, { message: 'Message must be at least 10 characters long' })
    .max(3000, { message: 'Message cannot exceed 3000 characters' })
}).strict();

export type CreateContactInput = z.infer<typeof createContactSchema>;
