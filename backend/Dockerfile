# ─── Stage 1: Build ────────────────────────────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /build

RUN corepack enable pnpm

# Install dependencies (all, including devDeps for tsc)
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --ignore-scripts

# Copy source
COPY tsconfig.json ./
COPY src/ src/
COPY prisma/ prisma/
COPY scripts/ scripts/

# Generate Prisma client, then compile TypeScript, then sync OpenAPI
RUN pnpm prisma generate && pnpm run build

# ─── Stage 2: Production ──────────────────────────────────────────────────────
FROM node:22-alpine AS production

# Required for argon2 native bindings
RUN apk add --no-cache libcrypto3 openssl

WORKDIR /app

# Install production deps only
COPY package.json pnpm-lock.yaml ./
RUN corepack enable pnpm && \
    pnpm install --frozen-lockfile --prod --ignore-scripts

# Prisma needs its generated client — copy from builder
COPY --from=builder /build/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /build/prisma ./prisma

# Copy compiled output
COPY --from=builder /build/dist ./dist

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

CMD ["node", "dist/server.js"]