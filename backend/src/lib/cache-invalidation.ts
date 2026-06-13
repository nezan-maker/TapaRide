import { invalidateCacheTags } from "./cache.js";
import { cacheTags } from "./cache-keys.js";
import type { DomainEvent } from "./domain-events.js";
import { onDomainEvent } from "./domain-events.js";

export function getCacheTagsForDomainEvent(event: DomainEvent) {
  switch (event.name) {
    case "agency.created": {
      const payload = event.payload as DomainEvent<"agency.created">["payload"];
      return [cacheTags.agencies, cacheTags.user(payload.ownerId)];
    }
    case "agency.manager-assigned": {
      const payload =
        event.payload as DomainEvent<"agency.manager-assigned">["payload"];
      return [
        cacheTags.agencies,
        cacheTags.agency(payload.agencyId),
        cacheTags.agencyStations(payload.agencyId),
        cacheTags.station(payload.stationId),
        cacheTags.user(payload.managerId),
      ];
    }
    case "agency.driver-assigned": {
      const payload =
        event.payload as DomainEvent<"agency.driver-assigned">["payload"];
      return [
        cacheTags.agencies,
        cacheTags.agency(payload.agencyId),
        cacheTags.vehicles,
        cacheTags.agencyVehicles(payload.agencyId),
        cacheTags.user(payload.driverId),
      ];
    }
    case "vehicle.created":
    case "vehicle.driver-assigned": {
      const payload = event.payload as
        | DomainEvent<"vehicle.created">["payload"]
        | DomainEvent<"vehicle.driver-assigned">["payload"];
      return [
        cacheTags.vehicles,
        cacheTags.agencies,
        cacheTags.agency(payload.agencyId),
        cacheTags.agencyVehicles(payload.agencyId),
      ];
    }
    case "station.created": {
      const payload = event.payload as DomainEvent<"station.created">["payload"];
      return [
        cacheTags.stations,
        cacheTags.agencies,
        cacheTags.agency(payload.agencyId),
        cacheTags.agencyStations(payload.agencyId),
      ];
    }
    case "journey.created":
    case "journey.updated": {
      const payload = event.payload as
        | DomainEvent<"journey.created">["payload"]
        | DomainEvent<"journey.updated">["payload"];
      return [cacheTags.journeys, cacheTags.journey(payload.journeyId)];
    }
    case "ticket.created":
    case "ticket.cancelled": {
      const payload = event.payload as
        | DomainEvent<"ticket.created">["payload"]
        | DomainEvent<"ticket.cancelled">["payload"];
      return [
        cacheTags.journeys,
        cacheTags.journey(payload.journeyId),
        cacheTags.userTickets(payload.userId),
        cacheTags.userWalletTransactions(payload.userId),
      ];
    }
    case "wallet.transactions-changed": {
      const payload =
        event.payload as DomainEvent<"wallet.transactions-changed">["payload"];
      return [cacheTags.userWalletTransactions(payload.userId)];
    }
    case "parcel.created": {
      const payload = event.payload as DomainEvent<"parcel.created">["payload"];
      return [cacheTags.parcels, cacheTags.userParcels(payload.senderId)];
    }
    case "parcel.updated": {
      const payload = event.payload as DomainEvent<"parcel.updated">["payload"];
      return [
        cacheTags.parcels,
        cacheTags.parcelTracking(payload.trackingCode),
        cacheTags.userParcels(payload.senderId),
      ];
    }
    default:
      return [];
  }
}

export function registerCacheInvalidationHandlers() {
  const handler = async (event: DomainEvent) => {
    const tags = getCacheTagsForDomainEvent(event);
    if (tags.length > 0) {
      await invalidateCacheTags(tags);
    }
  };

  onDomainEvent("agency.created", handler);
  onDomainEvent("agency.manager-assigned", handler);
  onDomainEvent("agency.driver-assigned", handler);
  onDomainEvent("vehicle.created", handler);
  onDomainEvent("vehicle.driver-assigned", handler);
  onDomainEvent("station.created", handler);
  onDomainEvent("journey.created", handler);
  onDomainEvent("journey.updated", handler);
  onDomainEvent("ticket.created", handler);
  onDomainEvent("ticket.cancelled", handler);
  onDomainEvent("wallet.transactions-changed", handler);
  onDomainEvent("parcel.created", handler);
  onDomainEvent("parcel.updated", handler);
}
