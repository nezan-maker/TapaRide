import { db } from '../../lib/db.js';
import { withRedisLock } from '../../lib/lock.js';
import { redis } from '../../lib/redis.js';
import { publishRealtimeEvent } from '../../lib/socket-bus.js';

/**
 * Computes the distance between two GPS points in meters using the Haversine formula.
 */
export function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // Earth radius in meters
  const p1 = (lat1 * Math.PI) / 180;
  const p2 = (lat2 * Math.PI) / 180;
  const dp = ((lat2 - lat1) * Math.PI) / 180;
  const dl = ((lon2 - lon1) * Math.PI) / 180;

  const a = Math.sin(dp / 2) * Math.sin(dp / 2) +
            Math.cos(p1) * Math.cos(p2) *
            Math.sin(dl / 2) * Math.sin(dl / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * Aggregates GPS pings from passengers to estimate the vehicle's position and ETA.
 * Runs on a 15-second interval.
 */
export async function aggregateTripGPS() {
  const activeTripIds = await redis.smembers("gps:active_trips");

  for (const journeyId of activeTripIds) {
    const key = `gps:buffer:trip:${journeyId}`;
    const pingsRaw = await redis.lrange(key, 0, -1);

    if (pingsRaw.length === 0) {
      await redis.srem("gps:active_trips", journeyId);
      continue;
    }

    if (pingsRaw.length < 3) continue; // Minimum data for accuracy

    const pings = pingsRaw.map(p => JSON.parse(p));
    
    // Separate driver and passenger pings
    const driverPings = pings.filter(p => p.source === "driver");
    const passengerPings = pings.filter(p => p.source !== "driver");

    // Prefer driver GPS if available (higher accuracy, no 50m ceiling)
    const useDriverGPS = driverPings.length > 0;
    const primaryPings = useDriverGPS ? driverPings : passengerPings;

    // 1. Median Aggregation (Outlier Rejection) on primary source
    const lats = primaryPings.map((p) => p.lat).sort((a, b) => a - b);
    const lngs = primaryPings.map((p) => p.lng).sort((a, b) => a - b);

    const medianLat = lats[Math.floor(lats.length / 2)];
    const medianLng = lngs[Math.floor(lngs.length / 2)];

    // 2. Compute Speed & ETA
    // Prefer driver-reported speed if available
    let estimatedSpeed = 0; // m/s
    const driverSpeedPings = driverPings.filter(p => typeof p.speed === "number" && p.speed > 0);
    if (driverSpeedPings.length > 0) {
      // Use median of driver-reported speeds
      const speeds = driverSpeedPings.map(p => p.speed!).sort((a, b) => a - b);
      estimatedSpeed = speeds[Math.floor(speeds.length / 2)];
    } else {
      // Fallback: calculate from position change
      const prevPosRaw = await redis.get(`trip:${journeyId}:last_position`);
      if (prevPosRaw) {
        const prevPos = JSON.parse(prevPosRaw);
        const dist = calculateDistance(prevPos.lat, prevPos.lng, medianLat, medianLng);
        const timeDiff = (Date.now() - prevPos.timestamp) / 1000;
        if (timeDiff > 0) estimatedSpeed = dist / timeDiff;
      }
    }

    // 3. Broadcast Aggregated Position
    await publishRealtimeEvent({
      room: `trip:${journeyId}`,
      event: 'trip:position',
      payload: {
        lat: medianLat,
        lng: medianLng,
        speed: estimatedSpeed,
        timestamp: Date.now(),
        source: useDriverGPS ? "driver" : "passenger",
      },
    });

    // 4. Persistence & Cache
    await redis.set(`trip:${journeyId}:last_position`, JSON.stringify({
      lat: medianLat,
      lng: medianLng,
      timestamp: Date.now(),
    }), 'EX', 60);

    // Persist every aggregation for post-incident analysis
    await db.tripPositionLog.create({
      data: { journeyId, lat: medianLat, lng: medianLng },
    });

    // 5. ETA Calculation for Upcoming Stops
    const upcomingStops = await db.journeyStop.findMany({
      where: { journeyId, reachedAt: null },
      include: { station: true },
      orderBy: { order: 'asc' }
    });

    for (const stop of upcomingStops) {
      if (!stop.station.location) continue;

      const [stopLatStr, stopLngStr] = stop.station.location.split(',');
      if (!stopLatStr || !stopLngStr) continue;

      const stopLat = parseFloat(stopLatStr);
      const stopLng = parseFloat(stopLngStr);
      if (Number.isNaN(stopLat) || Number.isNaN(stopLng)) continue;

      const distToStop = calculateDistance(medianLat, medianLng, stopLat, stopLng);
      const etaMinutes = estimatedSpeed > 0 ? Math.round((distToStop / estimatedSpeed) / 60) : -1;

      await publishRealtimeEvent({
        room: `trip:${journeyId}`,
        event: 'stop:eta',
        payload: {
          stopName: stop.station.name,
          etaMinutes,
          seatsExpected: 0,
        },
      });
    }
  }
}

export async function aggregateTripGPSWithLock() {
  return withRedisLock("jobs:gps-aggregation", 10, aggregateTripGPS);
}
