import { Request, Response, NextFunction } from 'express';
import { createPaymentIntentSchema, confirmPaymentSchema } from './payments.schema.js';
import * as PaymentsService from './payments.service.js';

export async function createIntent(req: Request, res: Response, next: NextFunction) {
  try {
    const user = req.user as { id: string };
    const dto = createPaymentIntentSchema.parse(req.body);

    const result = await PaymentsService.createPaymentIntent(
      dto.amount,
      dto.currency,
      {
        userId: user.id,
        journeyId: dto.journeyId,
        seats: dto.seatNumbers.join(','),
      },
    );

    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
}

export async function confirmIntent(req: Request, res: Response, next: NextFunction) {
  try {
    const dto = confirmPaymentSchema.parse(req.body);
    const result = await PaymentsService.confirmPaymentIntent(dto.paymentIntentId);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function getPaymentStatus(_req: Request, res: Response, next: NextFunction) {
  try {
    const info = PaymentsService.getTestPaymentInfo();
    res.json(info);
  } catch (error) {
    next(error);
  }
}
