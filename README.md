# TapaRide

Rwanda inter-city bus transport platform with encrypted wallets, live GPS tracking, and parcel logistics.

## Local development (recommended)

PostgreSQL runs on your machine. Redis is provided via Docker for cache, queues, and Socket.IO.

### Prerequisites

- Node.js 22+
- pnpm (`corepack enable`)
- PostgreSQL with database `tapa_ride`
- Docker (optional, for Redis)

### Setup

```bash
# 1. Install dependencies
pnpm install

# 2. Configure environment
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
pnpm env:generate   # append generated secrets to backend/.env

# Edit backend/.env:
#   DATABASE_URL=postgresql://YOUR_USER:YOUR_PASSWORD@localhost:5432/tapa_ride
#   GOOGLE_CLIENT_ID=<your Google OAuth web client id>
# Edit frontend/.env:
#   VITE_GOOGLE_CLIENT_ID=<same client id>

# 3. Start Redis
docker compose up -d redis

# 4. Migrate and seed
pnpm db:migrate
pnpm db:seed

# 5. Run apps
pnpm dev
```

- Frontend: http://localhost:5173
- Backend API: http://localhost:3000
- API docs: http://localhost:3000/docs

### Tests

```bash
pnpm test
pnpm test:integration   # requires local Postgres + Redis
```

## Deployment

- `backend/Dockerfile` — API with automatic `prisma migrate deploy`
- `frontend/Dockerfile` — static build served by nginx
## Deployment (Neon)

On Render or any cloud host, keep using your Neon URLs:

```env
DATABASE_URL=postgresql://...@ep-xxx-pooler....neon.tech/neondb?sslmode=require
DIRECT_URL=postgresql://...@ep-xxx....neon.tech/neondb?sslmode=require
```

The backend detects `neon.tech` in the host and uses the Neon serverless driver automatically. Local development uses the standard `pg` driver — no code changes between environments.

Set `CORS_ORIGIN` to your frontend URL(s), comma-separated.

Build frontend with runtime API URL:

```bash
docker build frontend \
  --build-arg VITE_API_BASE=https://api.example.com \
  --build-arg VITE_GOOGLE_CLIENT_ID=... \
  -t taparide-frontend
```

## Architecture notes

- **Database**: Prisma auto-selects Neon (serverless) or local `pg` driver from `DATABASE_URL`
- **Maps**: Journey tracking reads station coordinates from PostgreSQL (`lat,lng` or city labels)
- **Google OAuth**: Frontend obtains an ID token via GIS; backend verifies with `GOOGLE_CLIENT_ID`
