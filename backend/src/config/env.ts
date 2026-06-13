import 'dotenv/config';
import { z } from 'zod';

// Validate all environment variables at startup to fail fast
const envSchema = z
  .object({
    DATABASE_URL: z.string().url(),
    PORT: z.coerce.number().default(3000),
    HOST: z.string().default('0.0.0.0'),
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

    JWT_SECRET: z.string().min(32),
    JWT_EXPIRES_IN: z.string().default('15m'),
    JWT_REFRESH_SECRET: z.string().min(32),
    JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),

    WEBAUTHN_RP_ID: z.string().default('localhost'),
    WEBAUTHN_RP_NAME: z.string().default('Tapa Transport Platform'),
    WEBAUTHN_ORIGIN: z.string().url(),

    EMAIL_VERIFICATION_ORIGIN: z.string().url(),

    MAIL_FROM: z.string().email().default('no-reply@tapa.local'),
    SMTP_HOST: z.string().optional(),
    SMTP_PORT: z.coerce.number().default(2525),
    SMTP_USER: z.string().optional(),
    SMTP_PASS: z.string().optional(),
    EMAIL_PROVIDER: z.enum(['console', 'webhook']).default('console'),
    EMAIL_PROVIDER_URL: z.string().url().optional(),
    EMAIL_PROVIDER_TOKEN: z.string().optional(),
    SMS_PROVIDER: z.enum(['console', 'webhook']).default('console'),
    SMS_PROVIDER_URL: z.string().url().optional(),
    SMS_PROVIDER_TOKEN: z.string().optional(),

    OTP_EXPIRES_MINUTES: z.coerce.number().default(10),

    RURA_API_KEY: z.string(),
    RURA_API_URL: z.string().url(),

    DATABASE_ENCRYPTION_KEY: z.string().length(64),
    HMAC_SECRET: z.string().min(32),

    REDIS_URL: z.string().url().default('redis://localhost:6379'),
    SOCKET_EVENTS_CHANNEL: z.string().default('socket:events'),
    GPS_AGGREGATION_INTERVAL_MS: z.coerce.number().default(15000),
    METRICS_TOKEN: z.string().min(16).optional(),
    STRIPE_SECRET_KEY: z.string().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.EMAIL_PROVIDER === 'webhook' && !value.EMAIL_PROVIDER_URL) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['EMAIL_PROVIDER_URL'],
        message: 'EMAIL_PROVIDER_URL is required when EMAIL_PROVIDER=webhook',
      });
    }

    if (value.SMS_PROVIDER === 'webhook' && !value.SMS_PROVIDER_URL) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['SMS_PROVIDER_URL'],
        message: 'SMS_PROVIDER_URL is required when SMS_PROVIDER=webhook',
      });
    }

    if (value.NODE_ENV === 'production') {
      if (value.EMAIL_PROVIDER === 'console') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['EMAIL_PROVIDER'],
          message: 'EMAIL_PROVIDER=console is not allowed in production',
        });
      }

      if (value.SMS_PROVIDER === 'console') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['SMS_PROVIDER'],
          message: 'SMS_PROVIDER=console is not allowed in production',
        });
      }

      if (!value.METRICS_TOKEN) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['METRICS_TOKEN'],
          message: 'METRICS_TOKEN is required in production',
        });
      }
    }
  });

export const env = envSchema.parse(process.env);
export type Env = typeof env;
