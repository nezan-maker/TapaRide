import "dotenv/config";
import { z } from "zod";

// Validate all environment variables at startup to fail fast
const envSchema = z
  .object({
    DATABASE_URL: z.string().url(),
    PORT: z.coerce.number().default(3000),
    HOST: z.string().default("0.0.0.0"),
    // Render may set NODE_ENV with unexpected whitespace or casing.
    // Preprocess normalises it so the enum always matches.
    NODE_ENV: z.preprocess(
      (val) => (typeof val === "string" ? val.trim().toLowerCase() : val),
      z.enum(["development", "production", "test"]).default("development"),
    ),

    JWT_SECRET: z.string().min(64),
    JWT_EXPIRES_IN: z.string().default("15m"),
    JWT_REFRESH_SECRET: z.string().min(64),
    JWT_REFRESH_EXPIRES_IN: z.string().default("7d"),

    WEBAUTHN_RP_ID: z.string().default("localhost"),
    WEBAUTHN_RP_NAME: z.string().default("Tapa Transport Platform"),
    WEBAUTHN_ORIGIN: z.string().url(),

    EMAIL_VERIFICATION_ORIGIN: z.string().url().optional(),

    MAIL_FROM: z.string().email().default("no-reply@tapa.local"),

    // Email — use 'brevo' in production (Brevo REST API, port 443).
    // Render blocks SMTP ports (25, 465, 587), so Brevo replaces SMTP.
    // 'console' logs to stdout (dev only). 'webhook' sends to a custom URL.
    EMAIL_PROVIDER: z.enum(["console", "brevo", "webhook"]).default("console"),
    BREVO_API_KEY: z.string().optional(),
    EMAIL_PROVIDER_URL: z.string().url().optional(),
    EMAIL_PROVIDER_TOKEN: z.string().optional(),
    SMS_PROVIDER: z.enum(["console", "webhook", "twilio"]).default("console"),
    SMS_PROVIDER_URL: z.string().url().optional(),
    SMS_PROVIDER_TOKEN: z.string().optional(),
    // Twilio — used for sending claimKey to receiver and confirmation
    // to sender. When SMS_PROVIDER=twilio these three are required.
    TWILIO_ACCOUNT_SID: z.string().optional(),
    TWILIO_AUTH_TOKEN: z.string().optional(),
    TWILIO_FROM_NUMBER: z.string().optional(),

    OTP_EXPIRES_MINUTES: z.coerce.number().default(10),

    // RURA license validation — queries the official RURA Licensing Portal.
    // https://licensing.rura.rw/check-service/validity
    RURA_API_URL: z.string().url().default("https://licensing.rura.rw"),

    DATABASE_ENCRYPTION_KEY: z.string().length(64), // AES-256-GCM requires exactly 32 bytes (64 hex chars)
    HMAC_SECRET: z.string().min(64),

    REDIS_URL: z.string().url().default("redis://localhost:6379"),
    SOCKET_EVENTS_CHANNEL: z.string().default("socket:events"),
    GPS_AGGREGATION_INTERVAL_MS: z.coerce.number().default(15000),
    METRICS_TOKEN: z.string().min(64).optional(),
    STRIPE_SECRET_KEY: z.string().optional(),
    // Stripe webhook signing secret (whsec_...). Required in production so
    // we can verify that incoming webhook payloads genuinely came from
    // Stripe. Without it, anyone could forge a "payment succeeded" event
    // and credit their wallet.
    STRIPE_WEBHOOK_SECRET: z.string().optional(),

    // Cloudinary — used for storing agency logos (and any other user-uploaded
    // media). Render's filesystem is ephemeral, so we never persist uploads
    // to disk; we transform (strip EXIF, rasterize SVG, cap dimensions) and
    // ship the result to Cloudinary, then store only the resulting URL.
    // Free tier: 25 GB storage, 25 GB bandwidth/month.
    CLOUDINARY_CLOUD_NAME: z.string().min(1).optional(),
    CLOUDINARY_API_KEY: z.string().min(1).optional(),
    CLOUDINARY_API_SECRET: z.string().min(1).optional(),
    CLOUDINARY_FOLDER: z.string().default("tapa/agencies"),

    // Google OAuth — required for production Google Sign-In.
    GOOGLE_CLIENT_ID: z.string().min(1).optional(),

    // NVIDIA NIM — OpenAI-compatible LLM for Tapa Assist support chat.
    NVIDIA_NIM_API_KEY: z.string().min(1).optional(),
    NVIDIA_NIM_BASE_URL: z
      .string()
      .url()
      .default("https://integrate.api.nvidia.com/v1"),
    NVIDIA_NIM_MODEL: z.string().default("stepfun-ai/step-3.7-flash"),
    AI_MAX_OUTPUT_TOKENS: z.coerce
      .number()
      .int()
      .min(128)
      .max(4096)
      .default(1024),

    // Exa web search — enables the AI assistant to search the web for live info.
    // Get your key at https://exa.ai (free tier: 1,000 searches/month).
    EXA_API_KEY: z.string().min(1).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.EMAIL_PROVIDER === "webhook" && !value.EMAIL_PROVIDER_URL) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["EMAIL_PROVIDER_URL"],
        message: "EMAIL_PROVIDER_URL is required when EMAIL_PROVIDER=webhook",
      });
    }

    if (value.EMAIL_PROVIDER === "brevo" && !value.BREVO_API_KEY) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["BREVO_API_KEY"],
        message: "BREVO_API_KEY is required when EMAIL_PROVIDER=brevo",
      });
    }

    if (value.SMS_PROVIDER === "webhook" && !value.SMS_PROVIDER_URL) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["SMS_PROVIDER_URL"],
        message: "SMS_PROVIDER_URL is required when SMS_PROVIDER=webhook",
      });
    }

    if (
      value.SMS_PROVIDER === "twilio" &&
      (!value.TWILIO_ACCOUNT_SID ||
        !value.TWILIO_AUTH_TOKEN ||
        !value.TWILIO_FROM_NUMBER)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["TWILIO_ACCOUNT_SID"],
        message:
          "TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_FROM_NUMBER are required when SMS_PROVIDER=twilio",
      });
    }

    if (value.NODE_ENV === "production") {
      if (value.EMAIL_PROVIDER === "console") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["EMAIL_PROVIDER"],
          message: "EMAIL_PROVIDER=console is not allowed in production",
        });
      }

      if (value.SMS_PROVIDER === "console") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["SMS_PROVIDER"],
          message: "SMS_PROVIDER=console is not allowed in production",
        });
      }

      if (!value.METRICS_TOKEN) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["METRICS_TOKEN"],
          message: "METRICS_TOKEN is required in production",
        });
      }

      if (!value.EMAIL_VERIFICATION_ORIGIN) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["EMAIL_VERIFICATION_ORIGIN"],
          message: "EMAIL_VERIFICATION_ORIGIN is required in production",
        });
      }
    }
  });

export const env = envSchema.parse(process.env);
export type Env = typeof env;
