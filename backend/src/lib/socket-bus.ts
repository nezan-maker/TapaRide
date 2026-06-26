import { Emitter } from '@socket.io/redis-emitter';

import { createRedisConnection } from './redis.js';

export type RealtimeRoomEvent = {
  room: string;
  event: string;
  payload: unknown;
};

let emitterClient: ReturnType<typeof createRedisConnection> | null = null;
let emitter: Emitter | null = null;

function initEmitter() {
  if (emitter) return emitter;
  
  emitterClient = createRedisConnection();
  emitterClient.on('error', (err) => {
    // Log but don't crash - emitter is optional
    console.error('Emitter Redis error:', err);
  });
  
  emitter = new Emitter(emitterClient);
  return emitter;
}

export async function publishRealtimeEvent(event: RealtimeRoomEvent) {
  try {
    const em = initEmitter();
    em.to(event.room).emit(event.event, event.payload);
  } catch (err) {
    // Log but don't throw - realtime events are best-effort
    console.error('Failed to publish realtime event:', err);
  }
}

export async function stopRealtimeEventSubscriber() {
  if (emitterClient) {
    try {
      await emitterClient.disconnect();
    } catch (err) {
      console.error('Error disconnecting emitter:', err);
    }
    emitterClient = null;
    emitter = null;
  }
}
