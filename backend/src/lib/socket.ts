import { Server } from "socket.io";
import type { Server as HttpServer } from "http";
import { createAdapter } from "@socket.io/redis-adapter";
import jwt from "jsonwebtoken";

import { createRedisConnection, redis } from "./redis.js";
import { db } from "./db.js";
import { env } from "../config/env.js";
import { logger } from "./logger.js";

let io: Server;
const SOCKET_METRICS_KEY = "socket:metrics";
const JOIN_TRIP_WINDOW_SECONDS = 60;
const JOIN_TRIP_MAX_EVENTS = 30;
const GPS_WINDOW_SECONDS = 60;
const GPS_MAX_EVENTS = 240;

type AuthenticatedSocketUser = {
  id: string;
  role: string;
};

function extractSocketToken(rawToken?: string) {
  if (!rawToken) return null;
  return rawToken.startsWith("Bearer ") ? rawToken.slice(7) : rawToken;
}

async function recordSocketMetric(metric: string, increment = 1) {
  await redis.hincrby(SOCKET_METRICS_KEY, metric, increment);
}

async function enforceSocketRateLimit(
  userId: string,
  eventName: string,
  maxEvents: number,
  windowSeconds: number,
) {
  const key = `socket:rate:${eventName}:${userId}`;
  const count = await redis.incr(key);
  if (count === 1) {
    await redis.expire(key, windowSeconds);
  }

  if (count > maxEvents) {
    await recordSocketMetric(`${eventName}_rate_limit_violations`);
    return false;
  }

  return true;
}

/**
 * Initializes the Socket.io server and defines global event handlers.
 */
export async function initSocket(server: HttpServer) {
  io = new Server(server, {
    cors: {
      origin: env.NODE_ENV === "production" ? "https://taparide.onrender.com" : "*",
      methods: ["GET", "POST"],
    },
  });

  // Create Redis pub/sub clients with error handling
  const pubClient = createRedisConnection();
  const subClient = pubClient.duplicate();

  // Add error handlers for pub/sub clients to prevent crashes
  pubClient.on('error', (err) => {
    logger.error({ err }, 'Socket.io pubClient error');
  });
  subClient.on('error', (err) => {
    logger.error({ err }, 'Socket.io subClient error');
  });

  pubClient.on('close', () => {
    logger.warn('Socket.io pubClient connection closed');
  });
  subClient.on('close', () => {
    logger.warn('Socket.io subClient connection closed');
  });

  // Connect with retry logic
  try {
    await Promise.all([
      pubClient.connect().catch((err) => {
        logger.error({ err }, 'Failed to connect pubClient');
        throw err;
      }),
      subClient.connect().catch((err) => {
        logger.error({ err }, 'Failed to connect subClient');
        throw err;
      }),
    ]);
  } catch (err) {
    logger.error({ err }, 'Failed to connect Redis pub/sub clients');
    throw err;
  }

  io.adapter(createAdapter(pubClient, subClient));

  io.use(async (socket, next) => {
    const rawToken =
      typeof socket.handshake.auth.token === "string"
        ? socket.handshake.auth.token
        : typeof socket.handshake.headers.authorization === "string"
          ? socket.handshake.headers.authorization
          : undefined;

    const token = extractSocketToken(rawToken);
    if (!token) {
      return next(new Error("Authentication required"));
    }

    try {
      const payload = jwt.verify(token, env.JWT_SECRET) as AuthenticatedSocketUser;
      const currentUser = await db.user.findUnique({
        where: { id: payload.id },
        select: { id: true, role: true, isVerified: true },
      });

      if (!currentUser) {
        return next(new Error("Unknown user"));
      }

      if (!currentUser.isVerified) {
        return next(new Error("Verified account required"));
      }

      socket.data.user = {
        id: currentUser.id,
        role: currentUser.role,
      };
      await recordSocketMetric("connections");
      return next();
    } catch {
      await recordSocketMetric("auth_failures");
      return next(new Error("Invalid or expired access token"));
    }
  });

  io.on("connection", (socket) => {
    const user = socket.data.user as AuthenticatedSocketUser;
    socket.join(`user:${user.id}`);

    // Join a room for a specific trip to receive real-time updates
    // SECURITY: Verify user has authorization to track this trip
    socket.on("join:trip", async ({ tripId }: { tripId: string }) => {
      try {
        const withinRateLimit = await enforceSocketRateLimit(
          user.id,
          "join_trip",
          JOIN_TRIP_MAX_EVENTS,
          JOIN_TRIP_WINDOW_SECONDS,
        );
        if (!withinRateLimit) {
          socket.emit("error:rate-limit", { event: "join:trip" });
          return;
        }

        if (typeof tripId !== "string" || tripId.length === 0) {
          await recordSocketMetric("join_trip_invalid_payloads");
          return;
        }

        const journey = await db.journey.findUnique({
          where: { id: tripId },
          include: {
            vehicle: { select: { agencyId: true, driverId: true } },
            tickets: { where: { userId: user.id }, select: { id: true } },
          },
        });

        if (!journey) return;

        // Authorization logic:
        // 1. Passenger with a ticket
        // 2. The assigned driver
        // 3. A manager/owner of the agency
        const isPassenger = journey.tickets.length > 0;
        const isDriver = journey.vehicle.driverId === user.id;

        const currentUser = await db.user.findUnique({
          where: { id: user.id },
          select: { role: true, managedAgencyId: true, ownedAgencies: { select: { id: true } } },
        });
        const isAgencyOwner =
          currentUser?.role === "OWNER" &&
          currentUser.ownedAgencies.some(
            (agency) => agency.id === journey.vehicle.agencyId,
          );
        const isAgencyStaff =
          isAgencyOwner ||
          (currentUser?.role === "MANAGER" &&
            currentUser.managedAgencyId === journey.vehicle.agencyId);

        if (isPassenger || isDriver || isAgencyStaff) {
          socket.join(`trip:${tripId}`);
          await recordSocketMetric("join_trip_authorized");
          logger.info({ tripId, userId: user.id }, "Authorized trip socket access");
        } else {
          await recordSocketMetric("join_trip_unauthorized");
          logger.warn(
            { tripId, userId: user.id },
            "Unauthorized attempt to track trip",
          );
        }
      } catch (err) {
        await recordSocketMetric("join_trip_errors");
        logger.error({ err, userId: user.id }, "Socket authorization error");
      }
    });

    // Join a personal room for private notifications (waitlist, wallet, etc.)
        socket.on("join:user", () => {
          socket.join(`user:${user.id}`);
        });

        // ─── Driver GPS room ────────────────────────────────────────────────────────
        // Driver joins via vehicle plate; server resolves journeyId and joins
        // both driver:trip:<journeyId> (driver GPS input) and trip:<journeyId> (broadcast).
        socket.on("join:driver:trip", async ({ vehiclePlate }: { vehiclePlate: string }) => {
          try {
            const withinRateLimit = await enforceSocketRateLimit(
              user.id,
              "join_driver_trip",
              JOIN_TRIP_MAX_EVENTS,
              JOIN_TRIP_WINDOW_SECONDS,
            );
            if (!withinRateLimit) {
              socket.emit("error:rate-limit", { event: "join:driver:trip" });
              return;
            }

            // Verify user is the assigned driver for a vehicle with this plate
            const vehicle = await db.vehicle.findUnique({
              where: { plateNumber: vehiclePlate },
              include: { journeys: { where: { departureTime: { gte: new Date() } }, select: { id: true } } },
            });
            if (!vehicle || vehicle.driverId !== user.id) {
              await recordSocketMetric("join_driver_trip_unauthorized");
              logger.warn({ vehiclePlate, userId: user.id }, "Unauthorized driver trip join");
              return;
            }

            // Get active journey for this vehicle (assuming one active at a time)
            const activeJourney = vehicle.journeys[0];
            if (!activeJourney) {
              await recordSocketMetric("join_driver_trip_no_journey");
              return;
            }

            const journeyId = activeJourney.id;

            // Join driver GPS input room + sync to passenger broadcast room
            socket.join(`driver:trip:${journeyId}`);
            socket.join(`trip:${journeyId}`);
            await recordSocketMetric("join_driver_trip_authorized");
            logger.info({ journeyId, vehiclePlate, userId: user.id }, "Driver joined trip rooms");
          } catch (err) {
            await recordSocketMetric("join_driver_trip_errors");
            logger.error({ err, userId: user.id }, "Driver trip join error");
          }
        });

        // ─── GPS updates from DRIVER (bypasses passenger accuracy threshold) ────────
        socket.on("driver:gps:update", async (data: { vehiclePlate: string; lat: number; lng: number; accuracy: number; speed?: number }) => {
          const withinRateLimit = await enforceSocketRateLimit(
            user.id,
            "driver_gps_update",
            GPS_MAX_EVENTS,
            GPS_WINDOW_SECONDS,
          );
          if (!withinRateLimit) {
            socket.emit("error:rate-limit", { event: "driver:gps:update" });
            return;
          }

          // Verify driver owns this vehicle
          const vehicle = await db.vehicle.findUnique({
            where: { plateNumber: data.vehiclePlate },
            select: { driverId: true, journeys: { where: { departureTime: { gte: new Date() } }, select: { id: true } } },
          });
          if (!vehicle || vehicle.driverId !== user.id) return;

          const journeyId = vehicle.journeys[0]?.id;
          if (!journeyId) return;
          if (!socket.rooms.has(`driver:trip:${journeyId}`)) return;

          if (
            !Number.isFinite(data.lat) ||
            !Number.isFinite(data.lng) ||
            !Number.isFinite(data.accuracy) ||
            data.lat < -90 || data.lat > 90 ||
            data.lng < -180 || data.lng > 180
          ) {
            await recordSocketMetric("driver_gps_update_invalid_payloads");
            return;
          }
          // Driver GPS: no 50m accuracy ceiling, optional speed field
          const bufferKey = `gps:buffer:trip:${journeyId}`;
          const ping = JSON.stringify({
            lat: data.lat,
            lng: data.lng,
            timestamp: Date.now(),
            source: "driver",
            speed: data.speed ?? null,
          });

          await redis.lpush(bufferKey, ping);
          await redis.ltrim(bufferKey, 0, 50);
          await redis.expire(bufferKey, 60);
          await redis.sadd("gps:active_trips", journeyId);
          await recordSocketMetric("driver_gps_updates_accepted");
        });

        // ─── Passenger GPS updates (existing) ──────────────────────────────────────
        socket.on("gps:update", async (data: { tripId: string; lat: number; lng: number; accuracy: number }) => {
      const withinRateLimit = await enforceSocketRateLimit(
        user.id,
        "gps_update",
        GPS_MAX_EVENTS,
        GPS_WINDOW_SECONDS,
      );
      if (!withinRateLimit) {
        socket.emit("error:rate-limit", { event: "gps:update" });
        return;
      }

      if (!socket.rooms.has(`trip:${data.tripId}`)) return;
      if (
        !Number.isFinite(data.lat) ||
        !Number.isFinite(data.lng) ||
        !Number.isFinite(data.accuracy) ||
        data.lat < -90 ||
        data.lat > 90 ||
        data.lng < -180 ||
        data.lng > 180 ||
        data.accuracy < 0
      ) {
        await recordSocketMetric("gps_update_invalid_payloads");
        return;
      }
      if (data.accuracy > 50) return; // Requirement: Accuracy < 50m

      const bufferKey = `gps:buffer:trip:${data.tripId}`;
      const ping = JSON.stringify({
        lat: data.lat,
        lng: data.lng,
        timestamp: Date.now(),
      });

      // Buffer pings in Redis (List) for aggregation service
      await redis.lpush(bufferKey, ping);
      await redis.ltrim(bufferKey, 0, 50); // Keep recent 50 pings
      await redis.expire(bufferKey, 60);    // TTL 60s
      await redis.sadd("gps:active_trips", data.tripId);
      await recordSocketMetric("gps_updates_accepted");
    });

    socket.on("disconnect", () => {
      void recordSocketMetric("disconnects");
      // Cleanup handled by socket.io automatically
    });
  });

  return io;
}

/**
 * Returns the initialized Socket.io instance.
 */
export function getIO() {
  if (!io) {
    throw new Error("Socket.io has not been initialized. Call initSocket first.");
  }
  return io;
}

/**
 * Gracefully shuts down Socket.IO and its Redis adapter clients.
 */
export async function shutdownSocket() {
  if (!io) return;

  // Close all socket connections
  await new Promise<void>((resolve) => {
    io?.close(() => resolve());
  });

  logger.info('Socket.IO server closed');
}

export async function getSocketMetrics() {
  const metrics = await redis.hgetall(SOCKET_METRICS_KEY);

  return {
    connections: Number(metrics["connections"] ?? 0),
    disconnects: Number(metrics["disconnects"] ?? 0),
    authFailures: Number(metrics["auth_failures"] ?? 0),
    joinTripAuthorized: Number(metrics["join_trip_authorized"] ?? 0),
    joinTripUnauthorized: Number(metrics["join_trip_unauthorized"] ?? 0),
    joinTripErrors: Number(metrics["join_trip_errors"] ?? 0),
    joinTripInvalidPayloads: Number(metrics["join_trip_invalid_payloads"] ?? 0),
    joinTripRateLimitViolations: Number(
      metrics["join_trip_rate_limit_violations"] ?? 0,
    ),
    gpsUpdatesAccepted: Number(metrics["gps_updates_accepted"] ?? 0),
    gpsUpdateInvalidPayloads: Number(
      metrics["gps_update_invalid_payloads"] ?? 0,
    ),
    gpsUpdateRateLimitViolations: Number(
      metrics["gps_update_rate_limit_violations"] ?? 0,
    ),
  };
}

export function formatSocketMetricsPrometheus(
  metrics: Awaited<ReturnType<typeof getSocketMetrics>>,
) {
  return [
    "# HELP tapa_socket_connections_total Total authenticated socket connections",
    "# TYPE tapa_socket_connections_total counter",
    `tapa_socket_connections_total ${metrics.connections}`,
    "# HELP tapa_socket_disconnects_total Total socket disconnects",
    "# TYPE tapa_socket_disconnects_total counter",
    `tapa_socket_disconnects_total ${metrics.disconnects}`,
    "# HELP tapa_socket_auth_failures_total Total socket authentication failures",
    "# TYPE tapa_socket_auth_failures_total counter",
    `tapa_socket_auth_failures_total ${metrics.authFailures}`,
    "# HELP tapa_socket_join_trip_authorized_total Total authorized trip subscriptions",
    "# TYPE tapa_socket_join_trip_authorized_total counter",
    `tapa_socket_join_trip_authorized_total ${metrics.joinTripAuthorized}`,
    "# HELP tapa_socket_join_trip_unauthorized_total Total unauthorized trip subscriptions",
    "# TYPE tapa_socket_join_trip_unauthorized_total counter",
    `tapa_socket_join_trip_unauthorized_total ${metrics.joinTripUnauthorized}`,
    "# HELP tapa_socket_join_trip_errors_total Total trip subscription errors",
    "# TYPE tapa_socket_join_trip_errors_total counter",
    `tapa_socket_join_trip_errors_total ${metrics.joinTripErrors}`,
    "# HELP tapa_socket_join_trip_invalid_payloads_total Total invalid join trip payloads",
    "# TYPE tapa_socket_join_trip_invalid_payloads_total counter",
    `tapa_socket_join_trip_invalid_payloads_total ${metrics.joinTripInvalidPayloads}`,
    "# HELP tapa_socket_join_trip_rate_limit_violations_total Total join trip rate limit violations",
    "# TYPE tapa_socket_join_trip_rate_limit_violations_total counter",
    `tapa_socket_join_trip_rate_limit_violations_total ${metrics.joinTripRateLimitViolations}`,
    "# HELP tapa_socket_gps_updates_accepted_total Total accepted GPS updates",
    "# TYPE tapa_socket_gps_updates_accepted_total counter",
    `tapa_socket_gps_updates_accepted_total ${metrics.gpsUpdatesAccepted}`,
    "# HELP tapa_socket_gps_update_invalid_payloads_total Total invalid GPS payloads",
    "# TYPE tapa_socket_gps_update_invalid_payloads_total counter",
    `tapa_socket_gps_update_invalid_payloads_total ${metrics.gpsUpdateInvalidPayloads}`,
    "# HELP tapa_socket_gps_update_rate_limit_violations_total Total GPS rate limit violations",
    "# TYPE tapa_socket_gps_update_rate_limit_violations_total counter",
    `tapa_socket_gps_update_rate_limit_violations_total ${metrics.gpsUpdateRateLimitViolations}`,
  ].join("\n");
}
