import { z } from 'zod';

export const createJourneySchema = z.object({
  sourceStationId: z.string().uuid(),
  destinationStationId: z.string().uuid(),
  vehicleId: z.string().uuid(),
  departureTime: z.string().datetime(),
  price: z.number().int().positive('Price must be a positive integer (smallest currency unit)'),
});

export type CreateJourneyDto = z.infer<typeof createJourneySchema>;
