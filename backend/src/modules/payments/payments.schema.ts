import { z } from 'zod';

export const createPaymentIntentSchema = z.object({
  amount: z.number().int().positive(),
  currency: z.string().default('rwf'),
  journeyId: z.string().uuid(),
  seatNumbers: z.array(z.number().int().positive()).min(1),
  paymentMethod: z.enum(['card', 'wallet']).default('card'),
});

export const confirmPaymentSchema = z.object({
  paymentIntentId: z.string().min(1),
  journeyId: z.string().uuid(),
  seatNumbers: z.array(z.number().int().positive()).min(1),
});

export type CreatePaymentIntentDto = z.infer<typeof createPaymentIntentSchema>;
export type ConfirmPaymentDto = z.infer<typeof confirmPaymentSchema>;
