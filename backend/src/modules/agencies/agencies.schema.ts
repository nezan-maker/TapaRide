import { z } from 'zod';

export const createAgencySchema = z.object({
  name: z.string().min(2),
  ruraCode: z.string().min(1, 'RURA code required for agency registration'),
});

export const assignManagerSchema = z.object({
  managerId: z.string().uuid(),
  stationId: z.string().uuid(),
});

export const assignDriverSchema = z.object({
  driverId: z.string().uuid(),
});

export const assignManagerByEmailSchema = z.object({
  email: z.string().email(),
  stationId: z.string().uuid(),
});

export const assignDriverByEmailSchema = z.object({
  email: z.string().email(),
});

export type CreateAgencyDto = z.infer<typeof createAgencySchema>;
export type AssignManagerDto = z.infer<typeof assignManagerSchema>;
export type AssignDriverDto = z.infer<typeof assignDriverSchema>;
