import { useEffect, useState, useCallback, useRef } from "react";
import {
  connectSocket,
  disconnectSocket,
  joinTrip,
  leaveTrip,
  onTripPosition,
  onStopReached,
  onStopEta,
  onSocketError,
  onSocketConnect,
  onSocketDisconnect,
  getSocket,
} from "./socket";

export interface TripPosition {
  lat: number;
  lng: number;
  speed: number;
  timestamp: number;
}

export interface StopReachedEvent {
  tripId: string;
  stopId: string;
  timestamp: string;
  alightingPassengers: Array<{ id: string; userId: string; seatNumber: number }>;
}

export interface StopEtaEvent {
  stopName: string;
  etaMinutes: number;
  seatsExpected: number;
}

export interface PassengerSafeEvent {
  ticketId: string;
  timestamp: string;
}

interface UseRealtimeTripOptions {
  autoConnect?: boolean;
}

interface UseRealtimeTripResult {
  position: TripPosition | null;
  lastStop: StopReachedEvent | null;
  etaUpdates: StopEtaEvent[];
  connected: boolean;
  error: string | null;
  reconnect: () => void;
}

export function useRealtimeTrip(tripId: string | null, options: UseRealtimeTripOptions = {}): UseRealtimeTripResult {
  const { autoConnect = true } = options;
  const [position, setPosition] = useState<TripPosition | null>(null);
  const [lastStop, setLastStop] = useState<StopReachedEvent | null>(null);
  const [etaUpdates, setEtaUpdates] = useState<StopEtaEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const joinedRef = useRef(false);

  const doConnect = useCallback(() => {
    try {
      connectSocket();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to connect");
    }
  }, []);

  useEffect(() => {
    if (!autoConnect || !tripId) return;
    doConnect();
  }, [autoConnect, tripId, doConnect]);

  useEffect(() => {
    if (!tripId) return;

    const unsubPosition = onTripPosition((data) => {
      setPosition(data);
    });

    const unsubStop = onStopReached((data) => {
      setLastStop(data);
    });

    const unsubEta = onStopEta((data) => {
      setEtaUpdates((prev) => [...prev.slice(-9), data]);
    });

    const unsubError = onSocketError((msg) => {
      setError(msg);
    });

    const unsubConnect = onSocketConnect(() => {
      setConnected(true);
      setError(null);
      if (tripId) {
        joinTrip(tripId);
        joinedRef.current = true;
      }
    });

    const unsubDisconnect = onSocketDisconnect((reason) => {
      setConnected(false);
      if (reason !== "io client disconnect") {
        setError(`Disconnected: ${reason}`);
      }
    });

    // If socket is already connected, join immediately
    const sock = getSocket();
    if (sock?.connected && !joinedRef.current) {
      joinTrip(tripId);
      joinedRef.current = true;
      setConnected(true);
    }

    return () => {
      if (joinedRef.current && tripId) {
        leaveTrip(tripId);
        joinedRef.current = false;
      }
      unsubPosition();
      unsubStop();
      unsubEta();
      unsubError();
      unsubConnect();
      unsubDisconnect();
    };
  }, [tripId]);

  const reconnect = useCallback(() => {
    setError(null);
    disconnectSocket();
    doConnect();
  }, [doConnect]);

  return { position, lastStop, etaUpdates, connected, error, reconnect };
}
