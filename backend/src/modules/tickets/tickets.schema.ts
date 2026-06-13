import { z } from 'zod';

export const buyTicketSchema = z.object({
  journeyId: z.string().uuid(),
  seatNumber: z.number().int().positive(),
  walletPassword: z.string().optional(),
});

export const cancelTicketSchema = z.object({
  walletPassword: z.string().optional(),
});

export type BuyTicketDto = z.infer<typeof buyTicketSchema>;
