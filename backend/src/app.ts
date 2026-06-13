import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { apiReference } from "@scalar/express-api-reference";
import { readFileSync } from "fs";
import path, { dirname } from "path";
import url from "url";
import { ZodError } from "zod";
import { timingSafeEqual } from "crypto";

import { env } from "./config/env.js";
import { formatCacheMetricsPrometheus, getCacheMetrics } from "./lib/cache.js";
import {
  formatSocketMetricsPrometheus,
  getSocketMetrics,
} from "./lib/socket.js";
import { httpLogger, logger } from './lib/logger.js';
import { NotFoundError, ValidationError, toAppError } from './lib/errors.js';

// ─── Route modules ─────────────────────────────────────────────────────────
import authRoutes from "./modules/auth/auth.routes.js";
import userRoutes from "./modules/users/users.routes.js";
import agencyRoutes from "./modules/agencies/agencies.routes.js";
import vehicleRoutes from "./modules/vehicles/vehicles.routes.js";
import stationRoutes from "./modules/stations/stations.routes.js";
import journeyRoutes from "./modules/journeys/journeys.routes.js";
import ticketRoutes from "./modules/tickets/tickets.routes.js";
import parcelRoutes from "./modules/parcels/parcels.routes.js";
import walletRoutes from "./modules/wallets/wallet.routes.js";
import bulkBookingRoutes from "./modules/bulk-bookings/bulk-bookings.routes.js";
import waitlistRoutes from "./modules/waitlist/waitlist.routes.js";
import paymentRoutes from "./modules/payments/payments.routes.js";

const __filename = url.fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const file = path.join(__dirname, "openapi.json");
const spec = JSON.parse(readFileSync(file, { encoding: "utf-8" }));

function isAuthorizedOpsRequest(req: Request) {
  if (env.NODE_ENV !== "production") return true;
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) return false;

  const suppliedToken = authHeader.slice("Bearer ".length);
  const expectedToken = env.METRICS_TOKEN;
  if (!expectedToken) return false;

  const supplied = Buffer.from(suppliedToken);
  const expected = Buffer.from(expectedToken);
  
  // To prevent timing attacks, we always perform timingSafeEqual comparison
  // even when lengths don't match, by padding the shorter buffer
  const maxLength = Math.max(supplied.length, expected.length);
  const paddedSupplied = Buffer.alloc(maxLength, 0);
  const paddedExpected = Buffer.alloc(maxLength, 0);
  
  supplied.copy(paddedSupplied);
  expected.copy(paddedExpected);
  
  // Always perform timingSafeEqual to maintain constant time execution
  const lengthMatch = supplied.length === expected.length;
  const contentMatch = timingSafeEqual(paddedSupplied, paddedExpected);
  
  return lengthMatch && contentMatch;
}

function requireOpsToken(req: Request, res: Response, next: NextFunction) {
  if (!isAuthorizedOpsRequest(req)) {
    res.status(401).json({
      error: "Unauthorized",
      code: "AUTHENTICATION_ERROR",
      status: 401,
      requestId: res.getHeader("x-request-id"),
    });
    return;
  }
  return next();
}

export async function buildApp() {
  const app = express();

  // ─── Security & Logging Middleware ───────────────────────────────────────
  app.use((req: import('express').Request, res: import('express').Response, next: import('express').NextFunction) => {
    const isDocs = req.path.startsWith('/docs');
    helmet({
      contentSecurityPolicy: {
        directives: {
          ...helmet.contentSecurityPolicy.getDefaultDirectives(),
          "script-src": [
            "'self'",
            "https://cdn.jsdelivr.net",
            ...(isDocs ? ["'unsafe-inline'"] : []),
          ],
          "style-src": [
            "'self'",
            "https://cdn.jsdelivr.net",
            ...(isDocs ? ["'unsafe-inline'"] : []),
          ],
          "img-src": ["'self'", "data:", "https://cdn.jsdelivr.net"],
          "connect-src": [
            "'self'",
            "https://api.scalar.com",
            "https://proxy.scalar.com",
          ],
          "worker-src": ["'self'", "blob:"],
        },
      },
      hsts: env.NODE_ENV === "production"
        ? { maxAge: 31536000, includeSubDomains: true, preload: true }
        : false,
    })(req, res, next);
  });
  app.use(
    cors({
      origin: env.NODE_ENV === "production" ? "https://tapa.rw" : true,
      credentials: true,
    }),
  );
  app.use(httpLogger);
  app.use(express.json({ limit: '1mb' }));

  const limiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 100,
  });
  app.use(limiter);

  // ─── Documentation ───────────────────────────────────────────────────────
  app.use(
    "/docs",
    apiReference({
      spec: { content: spec },
    }),
  );

  // ─── Routes ──────────────────────────────────────────────────────────────
  app.use("/api/auth", authRoutes);
  app.use("/api/users", userRoutes);
  app.use("/api/agencies", agencyRoutes);
  app.use("/api/vehicles", vehicleRoutes);
  app.use("/api/stations", stationRoutes);
  app.use("/api/journeys", journeyRoutes);
  app.use("/api/tickets", ticketRoutes);
  app.use("/api/parcels", parcelRoutes);
  app.use("/api/wallet", walletRoutes);
  app.use("/api/bulk-bookings", bulkBookingRoutes);
  app.use("/api/waitlist", waitlistRoutes);
  app.use("/api/payments", paymentRoutes);

  // ─── Mock RURA endpoint (development only) ────────────────────────────────
  if (env.NODE_ENV !== "production") {
    app.post("/mock/rura/verify", (req: Request, res: Response) => {
      const { ruraCode } = req.body as { ruraCode: string };
      const valid = typeof ruraCode === "string" && ruraCode.startsWith("RURA-");
      res.json({ verified: valid, code: ruraCode });
    });
  }

  // ─── Health check ─────────────────────────────────────────────────────────
  app.get("/health", (_req: Request, res: Response) => {
    res.json({
      status: "ok",
      timestamp: new Date().toISOString(),
    });
  });

  app.get("/health/cache", requireOpsToken, async (_req: Request, res: Response) => {
    try {
      const metrics = await getCacheMetrics();
      res.json({
        status: "ok",
        metrics,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      res.status(503).json({
        status: "degraded",
        error: "Cache metrics unavailable",
        timestamp: new Date().toISOString(),
      });
    }
  }); 

  app.get("/metrics", requireOpsToken, async (_req: Request, res: Response) => {
    try {
      const cacheMetrics = await getCacheMetrics();
      const socketMetrics = await getSocketMetrics();
      res
        .type("text/plain")
        .send(
          `${formatCacheMetricsPrometheus(cacheMetrics)}\n${formatSocketMetricsPrometheus(socketMetrics)}\n`,
        );
    } catch (_error) {
      res.status(503).type("text/plain").send("# Cache metrics unavailable\n");
    }
  });

  // ─── Error Handling ──────────────────────────────────────────────────────
  app.use((_req: Request, _res: Response, next: NextFunction) => {
    next(new NotFoundError("Resource not found"));
  });

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const appError =
      err instanceof ZodError
        ? new ValidationError("Invalid request payload", {
            issues: err.issues,
          })
        : toAppError(err);

    logger.error(
      {
        err,
        code: appError.code,
        statusCode: appError.statusCode,
        details: appError.details,
      },
      "Request failed",
    );

    res.status(appError.statusCode).json({
      error: appError.expose ? appError.message : "Internal Server Error",
      code: appError.code,
      status: appError.statusCode,
      requestId: res.getHeader("x-request-id"),
      ...(appError.expose && appError.details
        ? { details: appError.details }
        : {}),
    });
  });

  return app;
}
