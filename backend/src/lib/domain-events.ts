import { EventEmitter } from "events";

import { redis } from "./redis.js";

const DOMAIN_EVENT_CHANNEL = "domain-events";

type DomainEventMap = {
  "agency.created": {
    agencyId: string;
    ownerId: string;
  };
  "agency.manager-assigned": {
    agencyId: string;
    managerId: string;
    stationId: string;
  };
  "agency.driver-assigned": {
    agencyId: string;
    driverId: string;
  };
  "vehicle.created": {
    agencyId: string;
    vehicleId: string;
  };
  "vehicle.driver-assigned": {
    agencyId: string;
    vehicleId: string;
    driverId: string;
  };
  "station.created": {
    agencyId: string;
    stationId: string;
  };
  "journey.created": {
    journeyId: string;
  };
  "journey.updated": {
    journeyId: string;
  };
  "ticket.created": {
    journeyId: string;
    userId: string;
  };
  "ticket.cancelled": {
    journeyId: string;
    userId: string;
  };
  "wallet.transactions-changed": {
    userId: string;
  };
  "parcel.created": {
    parcelId: string;
    senderId: string;
  };
  "parcel.updated": {
    trackingCode: string;
    senderId: string;
  };
};

export type DomainEventName = keyof DomainEventMap;

export type DomainEvent<TName extends DomainEventName = DomainEventName> = {
  name: TName;
  payload: DomainEventMap[TName];
  occurredAt: string;
};

type DomainEventHandler<TName extends DomainEventName> = (
  event: DomainEvent<TName>,
) => Promise<void> | void;

const emitter = new EventEmitter();
let subscriberStarted = false;

function parseDomainEvent(rawEvent: string) {
  return JSON.parse(rawEvent) as DomainEvent;
}

export async function publishDomainEvent<TName extends DomainEventName>(
  name: TName,
  payload: DomainEventMap[TName],
) {
  const event: DomainEvent<TName> = {
    name,
    payload,
    occurredAt: new Date().toISOString(),
  };

  await redis.publish(DOMAIN_EVENT_CHANNEL, JSON.stringify(event));
}

export function onDomainEvent<TName extends DomainEventName>(
  name: TName,
  handler: DomainEventHandler<TName>,
) {
  emitter.on(name, handler as (...args: unknown[]) => void);
}

export async function startDomainEventSubscriber() {
  if (subscriberStarted) return;

  const subscriber = redis.duplicate();
  subscriber.on("message", (_channel, message) => {
    const event = parseDomainEvent(message);
    emitter.emit(event.name, event);
  });
  await subscriber.subscribe(DOMAIN_EVENT_CHANNEL);

  subscriberStarted = true;
}
