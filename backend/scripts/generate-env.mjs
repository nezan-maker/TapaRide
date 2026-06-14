#!/usr/bin/env node
/**
 * generate-env.js
 *
 * Reads the backend's env schema (src/config/env.ts), identifies which
 * variables need randomly-generated values (secrets, tokens, keys), and
 * produces a complete .env file template.
 *
 * Usage:
 *   node scripts/generate-env.js              # print to stdout
 *   node scripts/generate-env.js > backend/.env  # write .env file
 *
 * Variables that are NOT auto-generated are left as placeholder strings
 * like "postgresql://user:pass@host:5432/db" — you must fill those in
 * manually or via Render dashboard environment variables.
 */

import crypto from 'node:crypto';

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Generate `bytes` random bytes as a hex string of length `bytes * 2`. */
const hex = (bytes) => crypto.randomBytes(bytes).toString('hex');

/** Generate a URL-safe base64 token of roughly `bytes` of entropy. */
const token = (bytes) =>
  crypto.randomBytes(bytes).toString('base64url');

// ─── Env-variable catalog ───────────────────────────────────────────────────
//
// source of truth: backend/src/config/env.ts
//
// Categories:
//   'input'      — user must supply a value
//   'generate'   — script generates a secure random value
//   'optional'   — has a default in the schema, included for visibility
//
const vars = [
  // ── Database ───────────────────────────────────────────────────────────────
  { key: 'DATABASE_URL',       kind: 'input',    desc: 'PostgreSQL connection string (full URL)' },

  // ── Server ─────────────────────────────────────────────────────────────────
  { key: 'PORT',               kind: 'optional', default: '3000',        desc: 'HTTP listen port' },
  { key: 'HOST',               kind: 'optional', default: '0.0.0.0',     desc: 'HTTP listen host' },
  { key: 'NODE_ENV',           kind: 'input',    default: 'development', desc: 'development | production | test' },
  { key: 'METRICS_TOKEN',      kind: 'generate', bytes: 24,              desc: 'Bearer token for /metrics and /health/cache' },

  // ── JWT ────────────────────────────────────────────────────────────────────
  { key: 'JWT_SECRET',         kind: 'generate', bytes: 32,              desc: 'JWT signing secret (min 32 chars)' },
  { key: 'JWT_EXPIRES_IN',     kind: 'optional', default: '15m',         desc: 'Access token TTL' },
  { key: 'JWT_REFRESH_SECRET', kind: 'generate', bytes: 32,              desc: 'Refresh token signing secret (min 32 chars)' },
  { key: 'JWT_REFRESH_EXPIRES_IN', kind: 'optional', default: '7d',      desc: 'Refresh token TTL' },

  // ── WebAuthn / Passkeys ────────────────────────────────────────────────────
  { key: 'WEBAUTHN_RP_ID',     kind: 'input',    default: 'localhost',   desc: 'Relying Party ID (domain)' },
  { key: 'WEBAUTHN_RP_NAME',   kind: 'optional', default: 'Tapa Transport Platform', desc: 'Relying Party display name' },
  { key: 'WEBAUTHN_ORIGIN',    kind: 'input',                            desc: 'Allowed origin URL (e.g. https://taparide.onrender.com)' },
  { key: 'EMAIL_VERIFICATION_ORIGIN', kind: 'input',                     desc: 'Base URL for email verification links' },

  // ── Email (console provider used in dev; production needs webhook) ─────────
  { key: 'EMAIL_PROVIDER',     kind: 'input',    default: 'console',     desc: 'console | brevo | webhook (brevo recommended in production)' },
  { key: 'BREVO_API_KEY',      kind: 'generate', bytes: 24,              desc: 'Brevo REST API key (required when EMAIL_PROVIDER=brevo)' },
  { key: 'EMAIL_PROVIDER_URL', kind: 'optional',                        desc: 'Email webhook endpoint URL' },
  { key: 'EMAIL_PROVIDER_TOKEN', kind: 'optional',                      desc: 'Email webhook auth token' },
  { key: 'MAIL_FROM',          kind: 'optional', default: 'no-reply@tapa.local', desc: 'Sender email address' },
  // NB: SMTP vars (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS) were removed.
  // Render blocks SMTP ports (25, 465, 587). Use EMAIL_PROVIDER=brevo instead.

  // ── SMS (console provider used in dev; production needs webhook) ───────────
  { key: 'SMS_PROVIDER',       kind: 'input',    default: 'console',     desc: 'console | webhook (webhook required in production)' },
  { key: 'SMS_PROVIDER_URL',   kind: 'optional',                        desc: 'SMS webhook endpoint URL' },
  { key: 'SMS_PROVIDER_TOKEN', kind: 'optional',                        desc: 'SMS webhook auth token' },

  // ── OTP ────────────────────────────────────────────────────────────────────
  { key: 'OTP_EXPIRES_MINUTES', kind: 'optional', default: '10',         desc: 'OTP code lifetime in minutes' },

  // ── RURA (document number validation — no external API) ──────────────────
  // RURA document number is validated by format pattern in agencies.service.ts.
  // The code is collected during agency registration and stored on the user
  // record for manual admin verification via the RURA Licensing Portal.

  // ── Encryption & signing ───────────────────────────────────────────────────
  { key: 'DATABASE_ENCRYPTION_KEY', kind: 'generate', bytes: 32,         desc: 'Wallet encryption key (exactly 64 hex chars)' },
  { key: 'HMAC_SECRET',        kind: 'generate', bytes: 32,              desc: 'HMAC signing secret for QR auth (min 32 chars)' },

  // ── Redis ──────────────────────────────────────────────────────────────────
  { key: 'REDIS_URL',          kind: 'input',    default: 'redis://localhost:6379', desc: 'Redis connection string' },
  { key: 'SOCKET_EVENTS_CHANNEL', kind: 'optional', default: 'socket:events', desc: 'Redis pub/sub channel for real-time events' },

  // ── GPS ────────────────────────────────────────────────────────────────────
  { key: 'GPS_AGGREGATION_INTERVAL_MS', kind: 'optional', default: '15000', desc: 'GPS batch flush interval (ms)' },

  // ── Stripe (payments) ──────────────────────────────────────────────────────
  { key: 'STRIPE_SECRET_KEY',  kind: 'optional',                        desc: 'Stripe secret key (omit to use mock payments)' },
];

// ─── Generate output ────────────────────────────────────────────────────────

const lines = [
  '# ─────────────────────────────────────────────────────────────────────',
  '# TapaRide Backend — Environment Variables',
  '# Auto-generated by scripts/generate-env.js on ' + new Date().toISOString().slice(0, 10),
  '#',
  '# Instructions:',
  '#   1. Replace every VALUE_NEEDED placeholder with a real value.',
  '#   2. For production, set EMAIL_PROVIDER and SMS_PROVIDER to "webhook"',
  '#      and provide the corresponding URL + token.',
  '#   3. Do NOT commit this file to version control — it contains secrets.',
  '# ─────────────────────────────────────────────────────────────────────',
  '',
];

for (const v of vars) {
  lines.push(`# ${v.desc}`);
  if (v.kind === 'generate') {
    const value = token(v.bytes);
    lines.push(`${v.key}=${value}`);
  } else if (v.kind === 'optional') {
    lines.push(`# ${v.key}=${v.default ?? ''}`);
  } else {
    // input — placeholder
    lines.push(`# ${v.key}=VALUE_NEEDED`);
  }
  lines.push('');
}

console.log(lines.join('\n'));
