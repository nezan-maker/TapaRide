# ─── Stage 1: Build ───────────────────────────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /build

RUN corepack enable pnpm

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY tsconfig.json ./
COPY src/           src/
COPY prisma/        prisma/
COPY scripts/       scripts/

RUN pnpm prisma generate && pnpm run build

# ─── Stage 2: Production ──────────────────────────────────────────────────────
FROM node:22-alpine AS production

RUN apk add --no-cache libcrypto3 openssl

WORKDIR /app

COPY --from=builder /build/node_modules ./node_modules
COPY --from=builder /build/prisma       ./prisma
COPY --from=builder /build/dist         ./dist
COPY --from=builder /build/package.json ./

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

# ──────────────────────────────────────────────────────────────────────────────
# Startup sequence:
#   1. Always run migrations (idempotent — safe on every deploy)
#   2. Seed only when RUN_SEED=true is set in Render Environment vars
#   3. Start the server
#
# To seed on Render (free tier):
#   → Add  RUN_SEED=true  in dashboard → Environment
#   → Trigger a Manual Deploy
#   → Remove RUN_SEED after deploy completes
#   → Trigger one more Manual Deploy (server-only from that point on)
# ──────────────────────────────────────────────────────────────────────────────
CMD ["sh", "-c", "\
  echo '⏳ Running migrations...' && \
  npx prisma migrate deploy && \
  if [ \"$RUN_SEED\" = 'true' ]; then \
    echo '🌱 Seeding database...' && \
    node --import tsx/esm prisma/seed.ts && \
    echo '✅ Seed complete'; \
  fi && \
  echo '🚀 Starting server...' && \
  node --max-old-space-size=384 dist/server.js \
"]