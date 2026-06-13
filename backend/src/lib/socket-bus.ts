import { Emitter } from '@socket.io/redis-emitter';

import { createRedisConnection } from './redis.js';

export type RealtimeRoomEvent = {
  room: string;
  event: string;
  payload: unknown;
};

const emitterClient = createRedisConnection();
const emitter = new Emitter(emitterClient);

export async function publishRealtimeEvent(event: RealtimeRoomEvent) {
  emitter.to(event.room).emit(event.event, event.payload);
}

export async function stopRealtimeEventSubscriber() {
  emitterClient.disconnect();
}
