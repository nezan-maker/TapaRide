import { z } from 'zod';

export const createParcelSchema = z.object({
  journeyId: z.string().uuid().optional(),
  receiverName: z.string().min(2),
  receiverPhone: z.string().regex(/^\+?[1-9]\d{7,14}$/),
  fromStation: z.string().optional(),
  toStation: z.string().optional(),
  weight: z.number().positive().optional(),
  notes: z.string().optional(),
  walletPassword: z.string().min(4).optional(),
});

export const quoteParcelSchema = z.object({
  journeyId: z.string().uuid().optional(),
  fromStation: z.string().optional(),
  toStation: z.string().optional(),
  weight: z.coerce.number().positive().optional(),
});

export const updateParcelStatusSchema = z.object({
  status: z.enum(['IN_TRANSIT', 'DELIVERED']),
});

export type CreateParcelDto = z.infer<typeof createParcelSchema>;
export type QuoteParcelDto = z.infer<typeof quoteParcelSchema>;
export type UpdateParcelStatusDto = z.infer<typeof updateParcelStatusSchema>;

export const startClaimSchema = z.object({
  claimKey: z.string().min(8).max(20),
});

export const claimParcelSchema = z.object({
  claimKey: z.string().min(8).max(20),
  receiverPhone: z.string().regex(/^\+?[1-9]\d{7,14}$/),
});

export type StartClaimDto = z.infer<typeof startClaimSchema>;
export type ClaimParcelDto = z.infer<typeof claimParcelSchema>;
