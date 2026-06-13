# Tapa Transport Platform API

**Tapa** is a multi-tenant transport operations platform serving Rwanda's bus transit ecosystem. It connects passengers, transport agencies, drivers, and organizations through a unified digital platform with real-time tracking, encrypted digital wallets, and cryptographic ticket verification.

---

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Core Modules](#core-modules)
- [Quick Start](#quick-start)
- [Configuration](#configuration)
- [Development](#development)
- [API Documentation](#api-documentation)
- [Workers](#workers)
- [Testing](#testing)
- [Deployment](#deployment)
- [Monitoring](#monitoring)
- [Security Model](#security-model)
- [Troubleshooting](#troubleshooting)

---

## Overview

### Business Domain

Tapa operates in the **inter-city bus transport** sector in Rwanda. It replaces paper ticketing, cash handling, and manual manifest tracking with a digital platform that supports:

- **Passengers**: Account registration, wallet top-up, bus ticket purchase, parcel shipping, and live bus tracking
- **Transport Agencies**: Fleet management (vehicles, drivers, stations), journey scheduling, and staff assignment
- **Drivers**: QR-based boarding validation, real-time GPS position sharing, and stop management
- **Organizations (Schools, Companies)**: Bulk seat booking with cryptographic manifest verification, parent notifications for safe arrival
- **Waitlist Automation**: Automatic seat recycling when passengers alight early, with real-time notifications

### Target Users

| Role | Description |
|---|---|
| `CLIENT` | Individual passengers who buy tickets and ship parcels |
| `DRIVER` | Bus drivers assigned to vehicles and journeys |
| `MANAGER` | Agency staff who create journeys and manage operations |
| `OWNER` | Agency owner with full administrative control |
| `ORGANIZATION` | Entity that books seats in bulk (schools, corporate) |

### Core Features

- **Multi-role authentication** with JWT, WebAuthn (passkeys), email + phone verification
- **Encrypted digital wallet** using AES-256-GCM with per-user derived keys — balance is never stored in plaintext
- **Ticket purchase & cancellation** with idempotency protection, wallet balance deduction, and automatic refund
- **Bulk booking** with cryptographic HMAC-signed manifests, QR code generation (Version 40, Error Correction H), and parent/guardian SMS alerts
- **Waitlist with automatic seat recycling** — when a passenger alights early, the seat is offered to the next person in the FIFO queue with a 3-minute reservation window
- **Real-time trip tracking** via Socket.IO with crowd-sourced GPS aggregation (median filtering for outlier rejection)
- **Tag-based cache invalidation** — Redis cache automatically purged when domain events occur
- **Prometheus metrics** for cache performance, socket connections, and request throughput

---

## Architecture

### High-Level Structure

Tapa follows a **Modular Monolith** architecture — a single Express.js process with logically separated modules sharing a common infrastructure layer.

```
┌──────────────────────────────────────────────────────────────┐
│                        Express.js                             │
│  ┌──────┐ ┌──────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌──────┐│
│  │ Auth │ │Users │ │Agencies│ │Vehicles│ │Stations│ │Journ.││
│  └──────┘ └──────┘ └────────┘ └────────┘ └────────┘ └──────┘│
│  ┌──────┐ ┌──────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌──────┐│
│  │Tickets│ │Parc. │ │Wallets │ │ Bulk   │ │Waitlist│ │Track.││
│  └──────┘ └──────┘ └────────┘ └────────┘ └────────┘ └──────┘│
├────────────────── Shared Infrastructure ─────────────────────┤
│  RBAC │ Cache │ Crypto │ Domain Events │ Locks │ Idempotency │
├───────────────────── Data Layer ─────────────────────────────┤
│         PostgreSQL (Prisma ORM)         Redis (Cache/Queue)   │
└──────────────────────────────────────────────────────────────┘
```

### Request Flow

```
HTTP Request
  │
  ├─ Helmet (Security Headers)
  ├─ CORS (Restricted to tapa.rw in production)
  ├─ Rate Limiter (Global: 100 req/min)
  ├─ Request ID (pino-http, x-request-id header)
  │
  ├─ authenticate (JWT Verification + Password Expiry Check)
  │   └─ On failure: 401 AuthenticationError
  │
  ├─ requireRoles (RBAC Guard)
  │   └─ On failure: 403 AuthorizationError
  │
  ├─ requireVerifiedAccount (Email + Phone)
  │   └─ On failure: 403 AuthorizationError
  │
  ├─ Controller (Request Parsing + Zod Validation)
  │   └─ On failure: 400 ValidationError
  │
  ├─ Service (Business Logic)
  │   ├─ runSerializable (Prisma Transaction + pg_advisory_lock)
  │   ├─ publishDomainEvent (Redis Pub/Sub)
  │   └─ Cache invalidation (Tag-based)
  │
  └─ Response (JSON)
```

### Module Descriptions

| Module | Path | Responsibility |
|---|---|---|
| **auth** | `src/modules/auth/` | Registration, login, token refresh, WebAuthn passkeys, password recovery (OTP), email verification |
| **users** | `src/modules/users/` | User profile (`/me`), directory listing for agency staff |
| **agencies** | `src/modules/agencies/` | Agency CRUD, RURA verification, manager/driver assignment |
| **vehicles** | `src/modules/vehicles/` | Vehicle inventory, driver-to-vehicle assignment |
| **stations** | `src/modules/stations/` | Station directory (public), station creation (owner) |
| **journeys** | `src/modules/journeys/` | Trip scheduling, availability/seat map, stop progression, alighting confirmation |
| **tickets** | `src/modules/tickets/` | Ticket purchase (wallet debit), cancellation (refund), passenger history |
| **parcels** | `src/modules/parcels/` | Parcel creation, tracking code lookup, status updates (staff only) |
| **wallets** | `src/modules/wallets/` | Encrypted wallet setup, unlock (key caching), deposit, withdraw, change password |
| **bulk-bookings** | `src/modules/bulk-bookings/` | Organization manifests, HMAC-signed QR codes, boarding validation, safe-arrival notifications |
| **waitlist** | `src/modules/waitlist/` | FIFO waitlist queue (Redis Sorted Set), seat reservation with 3-min window, alighting approval (proximity check) |
| **tracking** | `src/modules/tracking/` | GPS ping aggregation, median filtering, ETA calculation, real-time position broadcast |

### Key Data Flows

#### Ticket Purchase Flow

```
Client → POST /api/tickets
  │
  ├─ Idempotency-Key header check (prevents double-charge)
  ├─ Zod validation (journeyId, seatNumber, walletPassword optional)
  │
  ├─ runSerializable (Serializable Isolation)
  │   ├─ pg_advisory_lock(journey:xxx:seat:N)
  │   ├─ pg_advisory_lock(wallet:userId)
  │   ├─ Decrypt wallet balance (AES-256-GCM)
  │   ├─ Check seat availability (ticket + bulk booking)
  │   ├─ Deduct price, re-encrypt balance
  │   ├─ Create Ticket record (status: PAID)
  │   └─ Create WalletTransaction (type: PAYMENT)
  │
  ├─ publishDomainEvent("ticket.created")
  ├─ Cache invalidation (journey tags + user ticket tags)
  ├─ Generate QR code (Data URL)
  └─ Response: { ticket, remainingBalance, qrCode }
```

#### Waitlist Seat Recycling Flow

```
Passenger alights (approveAlighting or stop-based)
  │
  ├─ Ticket status → CANCELLED
  ├─ Publish real-time event "ticket:alighted"
  │
  └─ processWaitlist(journeyId, stopId, seatNumber)
      │
      ├─ Redis Lock (prevents double-assignment)
      ├─ ZPOPMIN from waitlist queue (FIFO)
      ├─ BullMQ job "notify-seat" with reservation window
      ├─ Waitlist entry → NOTIFIED
      │
      └─ Socket.IO event "seat:available" to user's room
          │
          └─ User has 3 minutes to buy
              │
              ├─ User buys → reservation cleared
              └─ Timeout → expire-reservation job
                  ├─ Entry → EXPIRED
                  └─ processWaitlist called again (next in line)
```

---

## Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| **Runtime** | Node.js 20+ (ESM) | JavaScript runtime |
| **Language** | TypeScript 6.x (strict mode) | Type safety |
| **Web Framework** | Express 5.x | HTTP routing |
| **ORM** | Prisma 7.x + PrismaPg | Database access |
| **Database** | PostgreSQL (via `pg` pool) | Persistent storage |
| **Cache** | Redis + ioredis | Caching, pub/sub, rate limiting |
| **Queue** | BullMQ | Background job processing |
| **Real-time** | Socket.IO + Redis Adapter | Live trip events, GPS |
| **Auth** | jsonwebtoken | JWT access/refresh tokens |
| **Passkeys** | @simplewebauthn/server | WebAuthn/FIDO2 |
| **Password Hash** | argon2 | Argon2id password hashing |
| **Wallet Crypto** | Node.js `crypto` (AES-256-GCM + PBKDF2-SHA512) | Balance encryption |
| **Validation** | Zod 4.x | Runtime schema validation |
| **Logging** | Pino | Structured logging |
| **Docs** | Scalar | OpenAPI 3.1 interactive docs |

---

## Quick Start

### Prerequisites

- **Node.js** 20+ (LTS recommended)
- **PostgreSQL** 14+ with database created
- **Redis** 6+ (for caching, queues, and pub/sub)
- **Environment**: The project validates `NODE_ENV` at startup. In development, set `NODE_ENV=development` in your `.env` to avoid production-only restrictions (e.g., `METRICS_TOKEN` requirement).

### Installation

```bash
# 1. Clone and install dependencies
cd backend
npm install

# 2. Copy environment template
cp .env.example .env
# Edit .env with your configuration (see Configuration section)

# 3. Generate Prisma client and run migrations
npm run db:generate
npm run db:migrate

# 4. (Optional) Seed with test data
npm run db:seed
```

### Running

```bash
# Terminal 1: API Server
npm run dev
# Starts at http://localhost:3000

# Terminal 2: Queue Worker (notifications, waitlists)
npm run start:worker:queue

# Terminal 3: GPS Worker (live tracking)
npm run start:worker:gps
```

Open [http://localhost:3000/docs](http://localhost:3000/docs) for interactive API documentation.

### Test Credentials (after seeding)

| Role | Email | Password |
|---|---|---|
| OWNER | owner@tapa.rw | Owner@1234 |
| MANAGER | manager@tapa.rw | Manager@1234 |
| DRIVER | driver@tapa.rw | Driver@1234 |
| CLIENT | client@tapa.rw | Client@1234 |

All seeded wallets use the same password as the account password and start with RWF 50,000 balance (CLIENT) or RWF 10,000 (others).

---

## Configuration

All configuration is via environment variables, validated at startup by Zod in `src/config/env.ts`.

### Required Variables

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string (e.g., `postgresql://user:pass@localhost:5432/tapa`) |
| `JWT_SECRET` | Secret for signing access tokens (min 32 chars) |
| `JWT_REFRESH_SECRET` | Secret for signing refresh tokens (min 32 chars) |
| `DATABASE_ENCRYPTION_KEY` | 64 hex characters (32 bytes) for AES-256-GCM master key |
| `HMAC_SECRET` | Secret for manifest signatures (min 32 chars) |
| `WEBAUTHN_ORIGIN` | Allowed origin for WebAuthn (e.g., `https://tapa.rw`) |
| `EMAIL_VERIFICATION_ORIGIN` | Base URL for email verification links |

### Optional Variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | HTTP server port |
| `HOST` | `0.0.0.0` | Bind address |
| `NODE_ENV` | `development` | Environment (development/production/test) |
| `JWT_EXPIRES_IN` | `15m` | Access token lifetime |
| `JWT_REFRESH_EXPIRES_IN` | `7d` | Refresh token lifetime |
| `REDIS_URL` | `redis://localhost:6379` | Redis connection string |
| `DATABASE_POOL_SIZE` | `20` | PostgreSQL connection pool size |
| `EMAIL_PROVIDER` | `console` | Email delivery: `console` or `webhook` |
| `SMS_PROVIDER` | `console` | SMS delivery: `console` or `webhook` |
| `OTP_EXPIRES_MINUTES` | `10` | OTP code validity |
| `GPS_AGGREGATION_INTERVAL_MS` | `15000` | GPS worker interval (ms) |
| `METRICS_TOKEN` | — | Bearer token for /metrics endpoint (required in production) |

### Provider Configuration

For production, set `EMAIL_PROVIDER=webhook` and `SMS_PROVIDER=webhook` with their respective URLs and tokens:

```env
EMAIL_PROVIDER=webhook
EMAIL_PROVIDER_URL=https://your-email-service.com/send
EMAIL_PROVIDER_TOKEN=your-email-api-token
SMS_PROVIDER=webhook
SMS_PROVIDER_URL=https://your-sms-service.com/send
SMS_PROVIDER_TOKEN=your-sms-api-token
```

---

## Development

### Project Structure

```
backend/
├── src/
│   ├── app.ts              # Express app factory (middleware, routes, error handling)
│   ├── server.ts           # Entry point (server bootstrap, workers)
│   ├── config/env.ts       # Environment validation (Zod schema)
│   ├── lib/                # Shared infrastructure
│   │   ├── cache.ts        # Tag-based Redis caching with stale-while-revalidate
│   │   ├── crypto.ts       # AES-256-GCM encryption, HMAC signing, PBKDF2 key derivation
│   │   ├── crypto-pool.ts  # Worker thread pool for CPU-heavy crypto
│   │   ├── crypto.worker.ts# Worker implementation (argon2, AES, PBKDF2)
│   │   ├── db.ts           # Prisma client singleton + serializable transaction helper
│   │   ├── domain-events.ts# Redis pub/sub domain event system
│   │   ├── errors.ts       # Typed error hierarchy (AppError, ValidationError, etc.)
│   │   ├── idempotency.ts  # Idempotency key implementation
│   │   ├── lock.ts         # Redis distributed lock (with Lua release script)
│   │   ├── logger.ts       # Pino logger with development formatting
│   │   ├── mailer.ts       # Email/SMS notification dispatcher
│   │   ├── otp.ts          # OTP generation and verification
│   │   ├── pagination.ts   # Pagination schema and utility
│   │   ├── qr.ts           # QR code generation (Version 40, ECC H)
│   │   ├── rate-limit.ts   # User-aware rate limiter factory
│   │   ├── redis.ts        # Singleton Redis connection
│   │   ├── socket.ts       # Socket.IO server with JWT auth
│   │   ├── socket-bus.ts   # Redis-based real-time event emitter
│   │   └── uuid-validate.ts# UUID format assertion
│   ├── modules/            # Business logic modules
│   │   ├── auth/           # Authentication & authorization
│   │   ├── agencies/       # Transport agency management
│   │   ├── vehicles/       # Vehicle inventory
│   │   ├── stations/       # Station directory
│   │   ├── journeys/       # Trip scheduling & tracking
│   │   ├── tickets/        # Ticket purchase & cancellation
│   │   ├── parcels/        # Parcel shipping
│   │   ├── wallets/        # Encrypted digital wallet
│   │   ├── bulk-bookings/  # Organization bulk bookings
│   │   ├── waitlist/       # Seat waitlist & reservation
│   │   ├── tracking/       # GPS position aggregation
│   │   └── users/          # User profile
│   ├── plugins/rbac.ts     # JWT authentication & role-based middleware
│   ├── workers/            # Background workers
│   │   ├── gps-worker.ts   # GPS aggregation + idempotency cleanup
│   │   └── queue-worker.ts # BullMQ worker (notifications + waitlist)
│   └── types/express.d.ts  # Express Request type augmentation
├── prisma/
│   ├── schema.prisma       # Database schema
│   └── seed.ts             # Test data seeder
├── tests/                  # Unit tests
├── loadtests/              # k6 load test scripts
├── docs/                   # Documentation
└── scripts/                # Utility scripts
```

### Module Pattern

Each module follows a consistent 4-file structure:

```
module/
├── module.routes.ts      # Express Router with middleware chain
├── module.controller.ts  # Request handlers (parse, validate, call service)
├── module.schema.ts      # Zod validation schemas + TypeScript types
└── module.service.ts     # Business logic (database operations, events)
```

### Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start development server with hot-reload (tsx watch) |
| `npm run build` | Compile TypeScript + sync OpenAPI spec |
| `npm start` | Start production server |
| `npm test` | Run unit tests (single-threaded) |
| `npm run test:integration` | Run integration tests (`RUN_INTEGRATION_TESTS=true`) |
| `npm run db:migrate` | Run Prisma migrations |
| `npm run db:seed` | Seed test data |
| `npm run db:studio` | Open Prisma Studio (GUI database browser) |
| `npm run start:worker:queue` | Start BullMQ notification + waitlist worker |
| `npm run start:worker:gps` | Start GPS aggregation worker |

---

## API Documentation

Interactive API documentation is available at `/docs` when the server is running (powered by Scalar).

### Authentication

Most endpoints require a Bearer JWT token:

```
Authorization: Bearer <access_token>
```

**Obtaining tokens:**
1. `POST /api/auth/register` — Create account
2. Verify email (click link) and phone (enter OTP)
3. `POST /api/auth/login` — Receive `accessToken` (15 min) and `refreshToken` (7 days)
4. `POST /api/auth/refresh` — Obtain new token pair using refresh token

### Idempotency

All mutation endpoints for wallet and ticket operations require an `Idempotency-Key` header:

```
Idempotency-Key: <client-generated-uuid>
```

Reusing a key with the same payload returns the original response without performing the operation. Reusing a key with a different payload returns `409 Conflict`.

### Endpoints Overview

| Method | Path | Auth | Roles |
|---|---|---|---|
| **Auth** | | | |
| POST | `/api/auth/register` | — | — |
| GET | `/api/auth/verify-email` | — | — |
| POST | `/api/auth/verify-otp` | — | — |
| POST | `/api/auth/login` | — | — |
| POST | `/api/auth/refresh` | — | — |
| POST | `/api/auth/forgot-password` | — | — |
| POST | `/api/auth/reset-password` | — | — |
| GET | `/api/auth/passkey/auth-options` | — | — |
| POST | `/api/auth/passkey/auth-verify` | — | — |
| GET | `/api/auth/passkey/register-options` | JWT | Any |
| POST | `/api/auth/passkey/register-verify` | JWT | Any |
| POST | `/api/auth/change-password` | JWT | Any |
| POST | `/api/auth/logout` | JWT | Any |
| **Users** | | | |
| GET | `/api/users/me` | JWT | Any |
| GET | `/api/users` | JWT | OWNER, MANAGER |
| **Agencies** | | | |
| GET | `/api/agencies` | — | — |
| GET | `/api/agencies/:id` | — | — |
| POST | `/api/agencies` | JWT | OWNER |
| POST | `/api/agencies/:id/assign-manager` | JWT | OWNER |
| POST | `/api/agencies/:id/assign-driver` | JWT | OWNER |
| **Vehicles** | | | |
| GET | `/api/vehicles` | JWT | OWNER, MANAGER, DRIVER |
| POST | `/api/vehicles` | JWT | OWNER |
| POST | `/api/vehicles/:id/assign-driver` | JWT | OWNER |
| **Stations** | | | |
| GET | `/api/stations` | — | — |
| GET | `/api/stations/:id` | — | — |
| POST | `/api/stations` | JWT | OWNER |
| **Journeys** | | | |
| GET | `/api/journeys` | — | — |
| GET | `/api/journeys/:id/availability` | — | — |
| POST | `/api/journeys` | JWT | MANAGER |
| POST | `/api/journeys/:id/stops/reached` | JWT | DRIVER, MANAGER |
| POST | `/api/journeys/:id/alight` | JWT | DRIVER, MANAGER |
| **Tickets** | | | |
| GET | `/api/tickets/my` | JWT | CLIENT |
| POST | `/api/tickets` | JWT | CLIENT |
| POST | `/api/tickets/:id/cancel` | JWT | CLIENT |
| **Parcels** | | | |
| GET | `/api/parcels/track/:code` | — | — |
| GET | `/api/parcels/my` | JWT | CLIENT |
| POST | `/api/parcels` | JWT | CLIENT |
| PATCH | `/api/parcels/:id/status` | JWT | DRIVER, MANAGER, OWNER |
| **Wallet** | | | |
| POST | `/api/wallet/setup` | JWT | Verified |
| POST | `/api/wallet/unlock` | JWT | Verified |
| POST | `/api/wallet/balance` | JWT | Verified |
| POST | `/api/wallet/deposit` | JWT | Verified |
| POST | `/api/wallet/withdraw` | JWT | Verified |
| GET | `/api/wallet/transactions` | JWT | Verified |
| POST | `/api/wallet/change-password` | JWT | Verified |
| **Bulk Bookings** | | | |
| POST | `/api/bulk-bookings` | JWT | ORGANIZATION |
| POST | `/api/bulk-bookings/validate` | JWT | DRIVER, MANAGER |
| POST | `/api/bulk-bookings/passengers/:id/alight` | JWT | DRIVER, MANAGER, OWNER |
| **Waitlist** | | | |
| POST | `/api/waitlist` | JWT | CLIENT |
| GET | `/api/waitlist/my` | JWT | CLIENT |
| GET | `/api/waitlist/status` | JWT | CLIENT |
| DELETE | `/api/waitlist/:id` | JWT | CLIENT |
| POST | `/api/waitlist/approve-alighting` | JWT | CLIENT |
| **Operations** | | | |
| GET | `/health` | — | — |
| GET | `/health/cache` | Ops Token | — |
| GET | `/metrics` | Ops Token | — |

### Example: Buy a Ticket

```
POST /api/tickets
Authorization: Bearer <access_token>
Idempotency-Key: 550e8400-e29b-41d4-a716-446655440000
Content-Type: application/json

{
  "journeyId": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "seatNumber": 12,
  "walletPassword": "myWalletPin"  // Optional if wallet is unlocked
}
```

**Response (201):**
```json
{
  "message": "Ticket purchased successfully",
  "ticket": {
    "id": "a1b2c3d4-...",
    "userId": "...",
    "journeyId": "f47ac10b-...",
    "seatNumber": 12,
    "status": "PAID"
  },
  "remainingBalance": 47000,
  "qrCode": "data:image/png;base64,..."
}
```

---

## Workers

Tapa uses three background processes:

### 1. API Server (`npm run dev` / `npm start`)
Handles HTTP requests, serves the API, and initializes Socket.IO for real-time events.

### 2. Queue Worker (`npm run start:worker:queue`)
Processes BullMQ jobs:
- **Email notifications** — verification emails, booking notifications, safe-arrival alerts
- **SMS notifications** — OTP codes, boarding/alighting notifications
- **Waitlist reservation expiry** — releases expired seat reservations

### 3. GPS Worker (`npm run start:worker:gps`)
- Aggregates passenger GPS pings every 15 seconds
- Computes median position (outlier rejection)
- Calculates speed and ETA to upcoming stops
- Persists aggregated positions to `TripPositionLog`
- Cleans up expired idempotency keys

---

## Testing

### Unit Tests

```bash
npm test
```

Tests use Node.js built-in `node:test` runner (no Jest/Mocha dependency). Located in `tests/`.

### Integration Tests

```bash
npm run test:integration
```

Requires `RUN_INTEGRATION_TESTS=true` environment variable. Located in `tests/integration/`.

### Load Tests

k6 scripts for high-contention scenarios:

```bash
# Wallet contention test
k6 run loadtests/wallet-contention.js \
  -e BASE_URL=http://localhost:5000 \
  -e ACCESS_TOKEN=token \
  -e WALLET_PASSWORD=4321

# Hot-seat ticket contention test
k6 run loadtests/tickets-hot-seat.js \
  -e BASE_URL=http://localhost:5000 \
  -e ACCESS_TOKEN=token \
  -e JOURNEY_ID=journey \
  -e WALLET_PASSWORD=4321
```

---

## Deployment

### Production Build

```bash
npm run build
# Outputs compiled JS to dist/
# Run with: node dist/server.js
```

### Environment Checklist

Ensure these variables are set for production:

```
NODE_ENV=production
EMAIL_PROVIDER=webhook
SMS_PROVIDER=webhook
METRICS_TOKEN=<long-random-token>
JWT_SECRET=<64+ random characters>
JWT_REFRESH_SECRET=<64+ random characters>
DATABASE_ENCRYPTION_KEY=<64 hex characters>
HMAC_SECRET=<32+ random characters>
```

### Process Management

Run each component as a separate systemd service or container:

```
tapa-api          → node dist/server.js
tapa-queue-worker → node dist/workers/queue-worker.js
tapa-gps-worker   → node dist/workers/gps-worker.js
```

### Environment Variables Reference

Full list of all supported environment variables with defaults:

| Variable | Required | Default | Description |
|---|---|---|---|
| `DATABASE_URL` | ✅ | — | PostgreSQL connection string |
| `PORT` | ❌ | `3000` | Server port |
| `HOST` | ❌ | `0.0.0.0` | Bind address |
| `NODE_ENV` | ❌ | `development` | `development`, `production`, or `test` |
| `JWT_SECRET` | ✅ | — | Access token signing key (min 32 chars) |
| `JWT_EXPIRES_IN` | ❌ | `15m` | Access token TTL |
| `JWT_REFRESH_SECRET` | ✅ | — | Refresh token signing key (min 32 chars) |
| `JWT_REFRESH_EXPIRES_IN` | ❌ | `7d` | Refresh token TTL |
| `DATABASE_ENCRYPTION_KEY` | ✅ | — | 64 hex chars (32 bytes) for AES-256 master key |
| `HMAC_SECRET` | ✅ | — | Manifest HMAC signing key (min 32 chars) |
| `REDIS_URL` | ❌ | `redis://localhost:6379` | Redis connection |
| `DATABASE_POOL_SIZE` | ❌ | `20` | PG pool connections |
| `DATABASE_POOL_IDLE_MS` | ❌ | `30000` | Idle connection timeout |
| `DATABASE_POOL_TIMEOUT_MS` | ❌ | `5000` | Connection timeout |
| `WEBAUTHN_RP_ID` | ❌ | `localhost` | WebAuthn relying party ID |
| `WEBAUTHN_RP_NAME` | ❌ | `Tapa Transport Platform` | WebAuthn display name |
| `WEBAUTHN_ORIGIN` | ✅ | — | WebAuthn allowed origin |
| `EMAIL_VERIFICATION_ORIGIN` | ✅ | — | Base URL for verification links |
| `MAIL_FROM` | ❌ | `no-reply@tapa.local` | From address |
| `EMAIL_PROVIDER` | ❌ | `console` | `console` or `webhook` |
| `EMAIL_PROVIDER_URL` | * | — | Required if provider=webhook |
| `EMAIL_PROVIDER_TOKEN` | ❌ | — | Webhook auth token |
| `SMS_PROVIDER` | ❌ | `console` | `console` or `webhook` |
| `SMS_PROVIDER_URL` | * | — | Required if provider=webhook |
| `SMS_PROVIDER_TOKEN` | ❌ | — | Webhook auth token |
| `OTP_EXPIRES_MINUTES` | ❌ | `10` | OTP validity period |
| `RURA_API_KEY` | ✅ | — | RURA external API key |
| `RURA_API_URL` | ✅ | — | RURA API base URL |
| `CRYPTO_WORKER_LIMIT` | ❌ | CPU-1 | Worker thread pool size |
| `GPS_AGGREGATION_INTERVAL_MS` | ❌ | `15000` | GPS aggregation interval |
| `SOCKET_EVENTS_CHANNEL` | ❌ | `socket:events` | Redis pub/sub channel |
| `METRICS_TOKEN` | * | — | Required in production |

---

## Monitoring

### Health Endpoints

| Endpoint | Description | Auth |
|---|---|---|
| `GET /health` | Basic health check | None |
| `GET /health/cache` | Cache metrics (hits, misses, revalidations) | `METRICS_TOKEN` |
| `GET /metrics` | Prometheus-formatted metrics | `METRICS_TOKEN` |

### Prometheus Metrics

Available at `GET /metrics` (requires `METRICS_TOKEN` bearer auth):

- `tapa_cache_hits_total` — Number of cache hits
- `tapa_cache_misses_total` — Number of cache misses
- `tapa_cache_sets_total` — Number of cache writes
- `tapa_cache_stale_hits_total` — Stale cache served during revalidation
- `tapa_cache_stampede_fallback_loads_total` — Cache stampede fallbacks
- `tapa_cache_invalidations_total` — Tag-based invalidation operations
- `tapa_socket_connections_total` — Socket.IO connections
- `tapa_socket_auth_failures_total` — Failed socket authentications
- `tapa_socket_join_trip_authorized_total` — Authorized trip subscriptions

---

## Security Model

### Password Security
- Passwords hashed with **Argon2id** (memory-hard, resistant to GPU attacks)
- Crypto operations run on **dedicated worker threads** (prevents main-thread blocking)
- Last 5 passwords stored in `passwordHistory` to prevent reuse
- Password expires after 14 days (enforced by middleware on every request)

### Wallet Security
- Balance encrypted with **AES-256-GCM** (authenticated encryption prevents tampering)
- Encryption key derived from the user's **wallet password** via **PBKDF2-SHA512** (310,000 iterations)
- Each encryption generates a fresh **random IV** and **salt** (forward secrecy)
- Wallet password verified via argon2id before key derivation
- Derived key optionally cached in Redis for 15 minutes (wallet unlock feature)

### API Security
- **Rate limiting** — Global (100/min) + per-endpoint limits
- **Helmet** — Security headers (CSP, HSTS, X-Frame-Options, etc.)
- **CORS** — Restricted to `https://tapa.rw` in production
- **Request ID** — Every request tracked via `x-request-id`
- **Sensitive data redaction** — Pino logger redacts passwords, tokens, OTP codes
- **Constant-time comparison** — Metrics token validation uses `timingSafeEqual`
- **Idempotency** — Prevents duplicate financial operations

---

## Troubleshooting

### Common Issues

#### Wallet operations fail with "Wallet setup required"

The wallet needs to be initialized with a password:

```bash
POST /api/wallet/setup
Authorization: Bearer <token>
Idempotency-Key: <uuid>
{"walletPassword": "yourWalletPin123"}
```

#### "Wallet is locked" error

The cached unlock key expired (15 min). Either:
- Call `POST /api/wallet/unlock` with your wallet password
- Or pass `walletPassword` directly in the operation request body

#### "Seat is temporarily reserved for another passenger"

Another waitlisted user has 3 minutes to purchase this seat. Wait for the reservation to expire.

#### Login returns "Email verification is still pending"

Check your email for the verification link, or request a new one by re-registering.

#### "BCRYPT_*" import errors after update

The `BCRYPT_HASH` and `BCRYPT_COMPARE` task types were renamed to `ARGON2_HASH` and `ARGON2_COMPARE`. Rebuild the project:

```bash
npm run build
```

### Debugging

1. Run with `NODE_ENV=development` for verbose logging (Prisma queries, HTTP requests)
2. Check Redis connectivity: `redis-cli ping`
3. Check database connectivity: `npm run db:studio`
4. View full request logs in development mode (colored output with timing)

---

## Contributing

### Code Style

- TypeScript strict mode with `noUncheckedIndexedAccess`
- ESLint + Prettier configured
- Follow the existing module pattern for new features
- All new endpoints need OpenAPI documentation

### Pull Request Checklist

- [ ] Typescript compiles without errors (`npm run build`)
- [ ] Tests pass (`npm test`)
- [ ] New endpoints documented in OpenAPI spec
- [ ] Error cases handled and tested
- [ ] Idempotency considered for financial operations

---

## License

ISC — Internal project use.
