import type { PaginationInput } from "./pagination.js";

function stableSearchParams(params: Record<string, string | number | undefined>) {
  const search = new URLSearchParams();

  for (const [key, value] of Object.entries(params)
    .filter(([, value]) => value !== undefined)
    .sort(([left], [right]) => left.localeCompare(right))) {
    search.set(key, String(value));
  }

  return search.toString();
}

export const cacheKeys = {
  agenciesList(pagination: PaginationInput) {
    return `cache:agencies:list:${stableSearchParams(pagination)}`;
  },
  agency(id: string) {
    return `cache:agencies:${id}`;
  },
  userProfile(userId: string) {
    return `cache:users:${userId}:profile`;
  },
  userTickets(userId: string, pagination: PaginationInput) {
    return `cache:users:${userId}:tickets:${stableSearchParams(pagination)}`;
  },
  userParcels(userId: string, pagination: PaginationInput) {
    return `cache:users:${userId}:parcels:${stableSearchParams(pagination)}`;
  },
  walletTransactions(userId: string, pagination: PaginationInput) {
    return `cache:users:${userId}:wallet-transactions:${stableSearchParams(pagination)}`;
  },
  vehiclesList(agencyId: string | undefined, pagination: PaginationInput) {
    return `cache:vehicles:list:${stableSearchParams({ agencyId, ...pagination })}`;
  },
  stationsList(agencyId: string | undefined, pagination: PaginationInput) {
    return `cache:stations:list:${stableSearchParams({ agencyId, ...pagination })}`;
  },
  station(id: string) {
    return `cache:stations:${id}`;
  },
  journeysList(
    sourceId: string | undefined,
    destId: string | undefined,
    pagination: PaginationInput,
  ) {
    return `cache:journeys:list:${stableSearchParams({ sourceId, destId, ...pagination })}`;
  },
  journeyAvailability(id: string) {
    return `cache:journeys:${id}:availability`;
  },
  parcelTracking(code: string) {
    return `cache:parcels:track:${code}`;
  },
};

export const cacheTags = {
  agencies: "agencies",
  agency(id: string) {
    return `agency:${id}`;
  },
  user(id: string) {
    return `user:${id}`;
  },
  userTickets(id: string) {
    return `user:${id}:tickets`;
  },
  userParcels(id: string) {
    return `user:${id}:parcels`;
  },
  userWalletTransactions(id: string) {
    return `user:${id}:wallet-transactions`;
  },
  vehicles: "vehicles",
  agencyVehicles(id: string) {
    return `agency:${id}:vehicles`;
  },
  stations: "stations",
  agencyStations(id: string) {
    return `agency:${id}:stations`;
  },
  station(id: string) {
    return `station:${id}`;
  },
  journeys: "journeys",
  journey(id: string) {
    return `journey:${id}`;
  },
  parcels: "parcels",
  parcelTracking(code: string) {
    return `parcel:tracking:${code}`;
  },
};
