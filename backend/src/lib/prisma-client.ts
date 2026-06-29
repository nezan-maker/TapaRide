import { PrismaClient, type Prisma } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';
import { PrismaPg } from '@prisma/adapter-pg';
import { neonConfig } from '@neondatabase/serverless';
import pg from 'pg';
import ws from 'ws';

type PrismaLogConfig = Prisma.LogDefinition[];

export function isNeonDatabaseUrl(connectionString: string): boolean {
  try {
    const host = new URL(connectionString).hostname;
    return host.includes('neon.tech');
  } catch {
    return false;
  }
}

function createAdapter(connectionString: string) {
  if (isNeonDatabaseUrl(connectionString)) {
    neonConfig.webSocketConstructor = ws;
    return new PrismaNeon({ connectionString });
  }

  const pool = new pg.Pool({ connectionString });
  return new PrismaPg(pool);
}

export function createPrismaClient(options?: {
  connectionString?: string;
  log?: PrismaLogConfig;
}): PrismaClient {
  const connectionString = options?.connectionString ?? process.env['DATABASE_URL'];
  if (!connectionString) {
    throw new Error('DATABASE_URL is required');
  }

  return new PrismaClient({
    adapter: createAdapter(connectionString),
    log: options?.log,
  });
}
