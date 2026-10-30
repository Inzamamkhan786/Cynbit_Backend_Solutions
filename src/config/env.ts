import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(4000),
  HOST: z.string().default('0.0.0.0'),
  CORS_ORIGIN: z.string().default('https://www.cynbit.in,http://localhost:3000'),

  // PostgreSQL
  DATABASE_URL: z.string().optional(),
  DB_HOST: z.string().default('localhost'),
  DB_PORT: z.coerce.number().default(5432),
  DB_USER: z.string().default('postgres'),
  DB_PASSWORD: z.string().default('postgres'),
  DB_NAME: z.string().default('cynbit_db'),
  DB_POOL_MIN: z.coerce.number().default(2),
  DB_POOL_MAX: z.coerce.number().default(20),
  DB_TIMEOUT_MS: z.coerce.number().default(5000),

  // Redis
  REDIS_URL: z.string().default('redis://localhost:6379'),
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.coerce.number().default(6379),
  REDIS_PASSWORD: z.string().optional(),
  REDIS_KEY_PREFIX: z.string().default('cynbit:'),

  // Rate Limiting
  RATE_LIMIT_ENABLED: z.coerce.boolean().default(true),
  RATE_LIMIT_GLOBAL_MAX: z.coerce.number().default(300),
  RATE_LIMIT_GLOBAL_WINDOW_SEC: z.coerce.number().default(60),
  RATE_LIMIT_CONTACT_MAX: z.coerce.number().default(5),
  RATE_LIMIT_CONTACT_WINDOW_SEC: z.coerce.number().default(900), // 15 mins
  RATE_LIMIT_NEWSLETTER_MAX: z.coerce.number().default(5),
  RATE_LIMIT_NEWSLETTER_WINDOW_SEC: z.coerce.number().default(3600), // 1 hour
  RATE_LIMIT_CAREERS_MAX: z.coerce.number().default(10),
  RATE_LIMIT_CAREERS_WINDOW_SEC: z.coerce.number().default(1800), // 30 mins

  // Email Service
  EMAIL_PROVIDER: z.enum(['mock', 'smtp', 'sendgrid']).default('mock'),
  EMAIL_FROM_ADDRESS: z.string().email().default('notifications@cynbit.in'),
  EMAIL_MAX_RETRIES: z.coerce.number().default(3),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:', JSON.stringify(parsed.error.format(), null, 2));
  process.exit(1);
}

export const env = parsed.data;
export type Env = z.infer<typeof envSchema>;
