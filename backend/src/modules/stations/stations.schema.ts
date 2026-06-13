import { z } from 'zod';

export const createStationSchema = z.object({
  name: z.string().min(2),
  location: z.string().min(2),
  agencyId: z.string().uuid(),
});

export type CreateStationDto = z.infer<typeof createStationSchema>;
