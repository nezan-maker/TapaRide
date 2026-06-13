import { z } from 'zod';

export const createVehicleSchema = z.object({
  plateNumber: z.string().min(3),
  model: z.string().min(2),
  capacity: z.number().int().positive(),
  agencyId: z.string().uuid(),
  amenities: z.array(z.string()).optional().default([]),
  seatLayout: z.object({
    rows: z.number().int().positive(),
    columns: z.number().int().positive(),
    aisleAfterColumn: z.number().int().optional(),
    labelScheme: z.enum(['alpha-numeric', 'numeric']).optional().default('alpha-numeric'),
    totalSeats: z.number().int().positive(),
  }).optional(),
});

export const assignVehicleDriverSchema = z.object({
  driverId: z.string().uuid(),
});

export type CreateVehicleDto = z.infer<typeof createVehicleSchema>;
export type AssignVehicleDriverDto = z.infer<typeof assignVehicleDriverSchema>;
