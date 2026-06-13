import { Request, Response, NextFunction } from 'express';
import { requireIdempotencyKey, runIdempotentMutation } from '../../lib/idempotency.js';
import { paginationSchema } from '../../lib/pagination.js';
import { buyTicketSchema, cancelTicketSchema } from './tickets.schema.js';
import * as TicketsService from './tickets.service.js';

export async function buyTicket(req: Request, res: Response, next: NextFunction) {
  try {
    const user = req.user as { id: string };
    const dto = buyTicketSchema.parse(req.body);
    const result = await runIdempotentMutation({
      userId: user.id,
      route: 'tickets.buy',
      idempotencyKey: requireIdempotencyKey(req),
      requestBody: dto,
      execute: async () => ({
        statusCode: 201,
        body: await TicketsService.buyTicket(user.id, dto),
      }),
    });
    res.status(result.statusCode).json(result.body);
  } catch (error) {
    next(error);
  }
}

export async function cancelTicket(req: Request, res: Response, next: NextFunction) {
  try {
    const user = req.user as { id: string };
    const { id } = req.params;
    const { walletPassword } = cancelTicketSchema.parse(req.body);
    const result = await runIdempotentMutation({
      userId: user.id,
      route: 'tickets.cancel',
      idempotencyKey: requireIdempotencyKey(req),
      requestBody: { ticketId: id, walletPassword },
      execute: async () => ({
        statusCode: 200,
        body: await TicketsService.cancelTicket(id as string, user.id, walletPassword),
      }),
    });
    res.status(result.statusCode).json(result.body);
  } catch (error) {
    next(error);
  }
}

export async function getMyTickets(req: Request, res: Response, next: NextFunction) {
  try {
    const user = req.user as { id: string };
    const pagination = paginationSchema.parse(req.query);
    const result = await TicketsService.getUserTickets(user.id, pagination);
    res.json(result);
  } catch (error) {
    next(error);
  }
}
