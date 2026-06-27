# ─── Stage 1: Build ────────────────────────────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /build

RUN corepack enable pnpm

COPY package.json pnpm-lock.yaml ./

# Install ALL deps (including devDeps for tsc)
RUN pnpm install --frozen-lockfile --ignore-scripts

COPY tsconfig.json ./
COPY src/ src/
COPY prisma/ prisma/
COPY scripts/ scripts/

# Prisma generate — errors here mean schema issues
RUN pnpm prisma generate

# TypeScript compile — errors here are type/config issues
# NO cache: force fresh compile every time
RUN pnpm run build 2>&1 | tee /build/build.log && \
    grep -i "error TS" /build/build.log && exit 1 || true

# Hard assert: fail loudly if the entry point is missing
RUN test -f /build/dist/server.js \
    || (echo "❌ dist/server.js not found. Build output:" && \
        find /build/dist -type f | sort && exit 1)

# Show what was actually built (visible in build logs)
RUN echo "✅ Build output:" && find /build/dist -type f | sort

# ─── Stage 2: Production ──────────────────────────────────────────────────────
FROM node:22-alpine AS production

RUN apk add --no-cache libcrypto3 openssl

WORKDIR /app

COPY --from=builder /build/dist ./dist
COPY --from=builder /build/node_modules ./node_modules
COPY --from=builder /build/package.json ./
COPY --from=builder /build/prisma ./prisma

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

CMD ["node", "dist/server.js"]