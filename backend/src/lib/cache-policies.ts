export const cachePolicies = {
  agenciesList: { ttlSeconds: 60, staleWhileRevalidateSeconds: 120 },
  agencyDetail: { ttlSeconds: 120, staleWhileRevalidateSeconds: 240 },
  userProfile: { ttlSeconds: 60, staleWhileRevalidateSeconds: 120 },
  userTickets: { ttlSeconds: 30, staleWhileRevalidateSeconds: 60 },
  userParcels: { ttlSeconds: 30, staleWhileRevalidateSeconds: 60 },
  walletTransactions: { ttlSeconds: 30, staleWhileRevalidateSeconds: 60 },
  vehiclesList: { ttlSeconds: 60, staleWhileRevalidateSeconds: 120 },
  stationsList: { ttlSeconds: 60, staleWhileRevalidateSeconds: 120 },
  stationDetail: { ttlSeconds: 120, staleWhileRevalidateSeconds: 240 },
  journeysList: { ttlSeconds: 30, staleWhileRevalidateSeconds: 45 },
  journeyAvailability: { ttlSeconds: 15, staleWhileRevalidateSeconds: 30 },
  parcelTracking: { ttlSeconds: 60, staleWhileRevalidateSeconds: 120 },
} as const;
