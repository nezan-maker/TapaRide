import { useEffect, useState, useCallback, useRef } from "react";
import { sendGpsUpdate } from "./socket";

interface UseGpsTrackerOptions {
  tripId: string | null;
  enabled?: boolean;
  minAccuracy?: number;       // Minimum accuracy in meters (default 50)
  updateInterval?: number;     // Interval between updates in ms (default 5000)
}

interface UseGpsTrackerResult {
  tracking: boolean;
  accuracy: number | null;
  position: GeolocationPosition | null;
  error: string | null;
  startTracking: () => void;
  stopTracking: () => void;
}

export function useGpsTracker(options: UseGpsTrackerOptions): UseGpsTrackerResult {
  const {
    tripId,
    enabled = true,
    minAccuracy = 50,
    updateInterval = 5000,
  } = options;

  const [tracking, setTracking] = useState(false);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [position, setPosition] = useState<GeolocationPosition | null>(null);
  const [error, setError] = useState<string | null>(null);

  const watchIdRef = useRef<number | null>(null);
  const lastSentRef = useRef<number>(0);
  const tripIdRef = useRef(tripId);
  tripIdRef.current = tripId;

  const startTracking = useCallback(() => {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by this browser");
      return;
    }

    setError(null);

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        setPosition(pos);
        setAccuracy(pos.coords.accuracy);
        setTracking(true);

        // Send GPS update at the specified interval if accuracy is good
        const now = Date.now();
        if (
          tripIdRef.current &&
          pos.coords.accuracy <= minAccuracy &&
          now - lastSentRef.current >= updateInterval
        ) {
          sendGpsUpdate(
            tripIdRef.current,
            pos.coords.latitude,
            pos.coords.longitude,
            pos.coords.accuracy
          );
          lastSentRef.current = now;
        }
      },
      (err) => {
        switch (err.code) {
          case err.PERMISSION_DENIED:
            setError("Location permission denied. Enable GPS in your browser settings.");
            break;
          case err.POSITION_UNAVAILABLE:
            setError("GPS signal unavailable. Try moving to an open area.");
            break;
          case err.TIMEOUT:
            setError("GPS request timed out. Retrying...");
            break;
          default:
            setError(`GPS error: ${err.message}`);
        }
        setTracking(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 3000,
      }
    );
  }, [minAccuracy, updateInterval]);

  const stopTracking = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setTracking(false);
  }, []);

  useEffect(() => {
    if (enabled && tripId) {
      startTracking();
    } else {
      stopTracking();
    }

    return () => {
      stopTracking();
    };
  }, [enabled, tripId, startTracking, stopTracking]);

  return { tracking, accuracy, position, error, startTracking, stopTracking };
}
