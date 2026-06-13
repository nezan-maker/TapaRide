import { z } from 'zod';

export const createBulkBookingSchema = z.object({
  organizationId: z.string().uuid(),
  journeyId: z.string().uuid(),
  destination: z.string().min(2),
  departureTime: z.string().datetime(),
  passengers: z.array(z.object({
    name: z.string().min(2),
    nationalId: z.string().min(5),
    seatNumber: z.number().int().positive(),
    parentPhone: z.string().optional(),
    parentEmail: z.string().email().optional(),
  })).min(1),
}).superRefine((value, ctx) => {
  const seenSeats = new Set<number>();
  value.passengers.forEach((passenger, index) => {
    if (seenSeats.has(passenger.seatNumber)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['passengers', index, 'seatNumber'],
        message: `Seat ${passenger.seatNumber} is duplicated in this booking`,
      });
    }
    seenSeats.add(passenger.seatNumber);
  });
});

export const validateBoardingSchema = z.object({
  type: z.enum(['MASTER', 'PASSENGER']).optional().default('PASSENGER'),
  bookingId: z.string().uuid().optional(), 
  boardingHash: z.string().optional(),     
  passengerId: z.string().uuid().optional(),
  signature: z.string().optional(),        
  location: z.string().optional(),
});

export type CreateBulkBookingDto = z.infer<typeof createBulkBookingSchema>;
export type ValidateBoardingDto = z.infer<typeof validateBoardingSchema>;
