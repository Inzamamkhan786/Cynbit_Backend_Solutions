import { z } from 'zod';

const isValidHttpUrl = (val: string) => {
  try {
    const url = new URL(val);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
};

export const urlSchema = (fieldName: string, exampleUrl: string) =>
  z
    .string({ required_error: `${fieldName} is required` })
    .trim()
    .min(1, { message: `${fieldName} is required` })
    .max(500, { message: `${fieldName} cannot exceed 500 characters` })
    .refine(isValidHttpUrl, {
      message: `Please enter a valid URL, such as ${exampleUrl}`
    });

export const optionalUrlSchema = (fieldName: string, exampleUrl: string) =>
  z
    .string()
    .trim()
    .max(500, { message: `${fieldName} cannot exceed 500 characters` })
    .optional()
    .refine(
      (val) => !val || val.length === 0 || isValidHttpUrl(val),
      {
        message: `Please enter a valid URL, such as ${exampleUrl}`
      }
    )
    .transform((val) => (val && val.length > 0 ? val : undefined));

export const educationItemSchema = z.object({
  qualificationLevel: z.string().min(1, { message: 'Qualification level is required' }),
  degree: z.string().min(1, { message: 'Degree is required' }),
  customDegree: z.string().optional(),
  specialization: z.string().optional(),
  university: z.string().min(1, { message: 'University / institution name is required' }),
  graduationYear: z.string().min(4, { message: 'Graduation year is required' }),
  scoreType: z.enum(['CGPA', 'Percentage']).default('CGPA'),
  scoreValue: z.string().min(1, { message: 'Score or CGPA is required' }),
  status: z.string().default('Completed')
});

export const submitApplicationSchema = z.object({
  jobId: z
    .string({ required_error: 'Job ID is required' })
    .trim()
    .min(1, { message: 'Job ID cannot be empty' }),
  fullName: z
    .string({ required_error: 'Full Name is required' })
    .trim()
    .min(2, { message: 'Full Name must be at least 2 characters long' })
    .max(100, { message: 'Full Name cannot exceed 100 characters' }),
  email: z
    .string({ required_error: 'Email address is required' })
    .trim()
    .toLowerCase()
    .email({ message: 'Please enter a valid email address (e.g., alex@domain.com)' })
    .max(255, { message: 'Email address cannot exceed 255 characters' }),
  phone: z
    .string({ required_error: 'Phone number is required' })
    .trim()
    .regex(/^\+?[0-9]{7,15}$/, { message: 'Please enter a valid phone number with country code (e.g., +919876543210)' }),
  whatsapp: z
    .string({ required_error: 'WhatsApp number is required' })
    .trim()
    .regex(/^\+?[0-9]{7,15}$/, { message: 'Please enter a valid WhatsApp number (e.g., +919876543210)' }),
  dob: z
    .string({ required_error: 'Date of birth is required' })
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'Date of birth must be formatted as YYYY-MM-DD' }),
  education: z
    .union([z.array(educationItemSchema), educationItemSchema, z.string()])
    .transform((val) => {
      if (typeof val === 'string') {
        try {
          return JSON.parse(val);
        } catch {
          return val;
        }
      }
      return val;
    }),
  noticePeriod: z
    .string({ required_error: 'Notice period is required' })
    .trim()
    .min(1, { message: 'Please specify your notice period (e.g., Immediate / 30 days)' }),
  skills: z
    .string({ required_error: 'Skills are required' })
    .trim()
    .min(2, { message: 'Please list your technical skills' })
    .max(255, { message: 'Skills field cannot exceed 255 characters' }),
  currentCity: z
    .string({ required_error: 'Current city is required' })
    .trim()
    .min(2, { message: 'Please provide your current city' })
    .max(100, { message: 'City name cannot exceed 100 characters' }),
  portfolioUrl: urlSchema('Portfolio URL', 'https://drive.google.com/file/d/... or https://alex.dev'),
  linkedinUrl: urlSchema('LinkedIn URL', 'https://linkedin.com/in/username'),
  professionalProfileUrl: optionalUrlSchema('GitHub / Professional Profile URL', 'https://github.com/username'),
  agreedToTerms: z
    .boolean({ required_error: 'You must agree to the terms and privacy policy' })
    .refine((val) => val === true, {
      message: 'You must agree to the terms and privacy policy to submit your application'
    })
}).strict();

export type SubmitApplicationInput = z.output<typeof submitApplicationSchema>;
export type SubmitApplicationRawInput = z.input<typeof submitApplicationSchema>;
