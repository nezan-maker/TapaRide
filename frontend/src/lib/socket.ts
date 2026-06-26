import { io, Socket } from "socket.io-client";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5000";

let socket: Socket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

type PositionCallback = (data: { lat: number; lng: number; speed: number; timestamp: number }) => void;
type StopReachedCallback = (data: { tripId: string; stopId: string; timestamp: string; alightingPassengers: Array<{ id: string; userId: string; seatNumber: number }> }) => void;
type StopEtaCallback = (data: { stopName: string; etaMinutes: number; seatsExpected: number }) => void;
type PassengerSafeCallback = (data: { ticketId: string; timestamp: string }) => void;
type RateLimitCallback = (data: { event: string }) => void;

const listeners = {
  position: new Set<PositionCallback>(),
  stopReached: new Set<StopReachedCallback>(),
  stopEta: new Set<StopEtaCallback>(),
  passengerSafe: new Set<PassengerSafeCallback>(),
  rateLimit: new Set<RateLimitCallback>(),
  connect: new Set<() => void>(),
  disconnect: new Set<(reason: string) => void>(),
  error: new Set<(err: string) => void>(),
};

function getToken(): string | null {
  return localStorage.getItem("accessToken");
}

export function connectSocket(): Socket {
  if (socket?.connected) return socket;

  const token = getToken();
  if (!token) {
    // Will retry when token becomes available
    scheduleReconnect();
    throw new Error("No access token available for socket connection");
  }

  socket = io(API_BASE, {
    auth: { token },
    transports: ["websocket", "polling"],
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 2000,
    reconnectionDelayMax: 15000,
    timeout: 10000,
  });

  socket.on("connect", () => {
    listeners.connect.forEach((cb) => cb());
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
  });

  socket.on("disconnect", (reason) => {
    listeners.disconnect.forEach((cb) => cb(reason));
  });

  socket.on("connect_error", (err) => {
    listeners.error.forEach((cb) => cb(err.message));
  });

  socket.on("trip:position", (data: { lat: number; lng: number; speed: number; timestamp: number }) => {
    listeners.position.forEach((cb) => cb(data));
  });

  socket.on("stop:reached", (data: { tripId: string; stopId: string; timestamp: string; alightingPassengers: Array<{ id: string; userId: string; seatNumber: number }> }) => {
    listeners.stopReached.forEach((cb) => cb(data));
  });

  socket.on("stop:eta", (data: { stopName: string; etaMinutes: number; seatsExpected: number }) => {
    listeners.stopEta.forEach((cb) => cb(data));
  });

  socket.on("passenger:safe", (data: { ticketId: string; timestamp: string }) => {
    listeners.passengerSafe.forEach((cb) => cb(data));
  });

  socket.on("error:rate-limit", (data: { event: string }) => {
    listeners.rateLimit.forEach((cb) => cb(data));
  });

  return socket;
}

export function disconnectSocket(): void {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }
}

export function getSocket(): Socket | null {
  return socket;
}

function scheduleReconnect() {
  if (reconnectTimer) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    const token = getToken();
    if (token) {
      connectSocket();
    } else {
      scheduleReconnect();
    }
  }, 3000);
}

// Listen for new tokens while disconnected
if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === "accessToken" && e.newValue && !socket?.connected) {
      connectSocket();
    }
  });
}

// ─── Room Management ─────────────────────────────────────────────────────────

export function joinTrip(tripId: string): void {
  if (socket?.connected) {
    socket.emit("join:trip", { tripId });
  }
}

export function leaveTrip(tripId: string): void {
  if (socket?.connected) {
    socket.emit("leave:trip", { tripId });
  }
}

// ─── Driver GPS Room ──────────────────────────────────────────────────────────

export function joinDriverTrip(vehiclePlate: string): void {
  if (socket?.connected) {
    socket.emit("join:driver:trip", { vehiclePlate });
  }
}

export function leaveDriverTrip(vehiclePlate: string): void {
  if (socket?.connected) {
    socket.emit("leave:driver:trip", { vehiclePlate });
  }
}

// ─── GPS Updates ──────────────────────────────────────────────────────────────

export function sendGpsUpdate(tripId: string, lat: number, lng: number, accuracy: number): void {
  if (socket?.connected) {
    socket.emit("gps:update", { tripId, lat, lng, accuracy });
  }
}

export function sendDriverGpsUpdate(vehiclePlate: string, lat: number, lng: number, accuracy: number, speed?: number): void {
  if (socket?.connected) {
    socket.emit("driver:gps:update", { vehiclePlate, lat, lng, accuracy, speed });
  }
}

// ─── Event Subscriptions ──────────────────────────────────────────────────────

export function onTripPosition(cb: PositionCallback): () => void {
  listeners.position.add(cb);
  return () => { listeners.position.delete(cb); };
}

export function onStopReached(cb: StopReachedCallback): () => void {
  listeners.stopReached.add(cb);
  return () => { listeners.stopReached.delete(cb); };
}

export function onStopEta(cb: StopEtaCallback): () => void {
  listeners.stopEta.add(cb);
  return () => { listeners.stopEta.delete(cb); };
}

export function onPassengerSafe(cb: PassengerSafeCallback): () => void {
  listeners.passengerSafe.add(cb);
  return () => { listeners.passengerSafe.delete(cb); };
}

export function onRateLimit(cb: RateLimitCallback): () => void {
  listeners.rateLimit.add(cb);
  return () => { listeners.rateLimit.delete(cb); };
}

export function onSocketConnect(cb: () => void): () => void {
  listeners.connect.add(cb);
  return () => { listeners.connect.delete(cb); };
}

export function onSocketDisconnect(cb: (reason: string) => void): () => void {
  listeners.disconnect.add(cb);
  return () => { listeners.disconnect.delete(cb); };
}

export function onSocketError(cb: (err: string) => void): () => void {
  listeners.error.add(cb);
  return () => { listeners.error.delete(cb); };
}
