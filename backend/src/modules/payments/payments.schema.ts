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

/**
 * Top-up schema — sender funds their Tapa wallet via Stripe Elements.
 * The amount is in whole RWF. We convert to USD (Stripe's supported
 * currency for Rwandan card issuers) at intent-creation time using a
 * snapshot exchange rate stored in the PaymentIntent metadata.
 */
export const topupSchema = z.object({
  amount: z
    .number()
    .int()
    .positive('Top-up amount must be a positive integer (RWF)')
    .max(5_000_000, 'Top-up cannot exceed 5,000,000 RWF per transaction'),
});

export type CreatePaymentIntentDto = z.infer<typeof createPaymentIntentSchema>;
export type ConfirmPaymentDto = z.infer<typeof confirmPaymentSchema>;
export type TopupDto = z.infer<typeof topupSchema>;
