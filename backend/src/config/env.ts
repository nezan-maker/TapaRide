import 'dotenv/config';
import { z } from 'zod';

// Validate all environment variables at startup to fail fast
const envSchema = z
  .object({
    DATABASE_URL: z.string().url(),
    PORT: z.coerce.number().default(3000),
    HOST: z.string().default('0.0.0.0'),
    // Render may set NODE_ENV with unexpected whitespace or casing.
    // Preprocess normalises it so the enum always matches.
    NODE_ENV: z
      .preprocess(
        (val) =>
          typeof val === 'string' ? val.trim().toLowerCase() : val,
        z.enum(['development', 'production', 'test']).default('development'),
      ),

    JWT_SECRET: z.string().min(32),
    JWT_EXPIRES_IN: z.string().default('15m'),
    JWT_REFRESH_SECRET: z.string().min(32),
    JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),

    WEBAUTHN_RP_ID: z.string().default('localhost'),
    WEBAUTHN_RP_NAME: z.string().default('Tapa Transport Platform'),
    WEBAUTHN_ORIGIN: z.string().url(),

    EMAIL_VERIFICATION_ORIGIN: z.string().url().optional(),

    MAIL_FROM: z.string().email().default('no-reply@tapa.local'),

    // Email — use 'brevo' in production (Brevo REST API, port 443).
    // Render blocks SMTP ports (25, 465, 587), so Brevo replaces SMTP.
    // 'console' logs to stdout (dev only). 'webhook' sends to a custom URL.
    EMAIL_PROVIDER: z.enum(['console', 'brevo', 'webhook']).default('console'),
    BREVO_API_KEY: z.string().optional(),
    EMAIL_PROVIDER_URL: z.string().url().optional(),
    EMAIL_PROVIDER_TOKEN: z.string().optional(),
    SMS_PROVIDER: z.enum(['console', 'webhook']).default('console'),
    SMS_PROVIDER_URL: z.string().url().optional(),
    SMS_PROVIDER_TOKEN: z.string().optional(),

    OTP_EXPIRES_MINUTES: z.coerce.number().default(10),

    // RURA document number is validated by format pattern in
    // agencies.service.ts — no external API required.
    // (Previous RURA_API_URL / RURA_API_KEY vars have been removed.)

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

    if (value.EMAIL_PROVIDER === 'brevo' && !value.BREVO_API_KEY) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['BREVO_API_KEY'],
        message: 'BREVO_API_KEY is required when EMAIL_PROVIDER=brevo',
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

      if (!value.EMAIL_VERIFICATION_ORIGIN) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['EMAIL_VERIFICATION_ORIGIN'],
          message: 'EMAIL_VERIFICATION_ORIGIN is required in production',
        });
      }
    }
  });

export const env = envSchema.parse(process.env);
export type Env = typeof env;
