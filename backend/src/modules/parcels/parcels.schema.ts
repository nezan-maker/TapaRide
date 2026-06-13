import { z } from 'zod';

export const createParcelSchema = z.object({
  journeyId: z.string().uuid().optional(),
  receiverName: z.string().min(2),
  receiverPhone: z.string().regex(/^\+?[1-9]\d{7,14}$/),
  fromStation: z.string().optional(),
  toStation: z.string().optional(),
  weight: z.number().positive().optional(),
  notes: z.string().optional(),
});

export const updateParcelStatusSchema = z.object({
  status: z.enum(['PENDING', 'IN_TRANSIT', 'DELIVERED']),
});

export type CreateParcelDto = z.infer<typeof createParcelSchema>;
export type UpdateParcelStatusDto = z.infer<typeof updateParcelStatusSchema>;
