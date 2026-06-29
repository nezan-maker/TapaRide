# ─── Stage 1: Build ───────────────────────────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /build

RUN corepack enable pnpm

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY tsconfig.json ./
COPY prisma.config.ts ./
COPY src/           src/
COPY prisma/        prisma/
COPY scripts/       scripts/

RUN pnpm prisma generate && pnpm run build

# ─── Stage 2: Production ──────────────────────────────────────────────────────
FROM node:22-alpine AS production

RUN apk add --no-cache libcrypto3 openssl wget

WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /build/node_modules ./node_modules
COPY --from=builder /build/prisma       ./prisma
COPY --from=builder /build/dist         ./dist
COPY --from=builder /build/package.json ./package.json
COPY --from=builder /build/prisma.config.ts ./prisma.config.ts

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

CMD ["sh", "-c", "\
  echo '⏳ Running migrations...' && \
  pnpm exec prisma migrate deploy && \
  if [ \"$RUN_SEED\" = 'true' ]; then \
    echo '🌱 Seeding database...' && \
    pnpm exec tsx prisma/seed.ts && \
    echo '✅ Seed complete'; \
  fi && \
  echo '🚀 Starting server...' && \
  node --max-old-space-size=384 dist/server.js \
"]
