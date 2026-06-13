import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import * as WaitlistService from './waitlist.service.js';

const addToWaitlistSchema = z.object({
  journeyId: z.string().uuid(),
  boardingStopId: z.string().uuid().optional(),
});

const waitlistStatusSchema = z.object({
  journeyId: z.string().uuid(),
  stopId: z.string().uuid(),
});

export async function addToWaitlist(req: Request, res: Response, next: NextFunction) {
  try {
    const user = req.user as { id: string };
    const { journeyId, boardingStopId } = addToWaitlistSchema.parse(req.body);

    // If no boarding stop specified, use the first stop on the journey
    let resolvedStopId: string | undefined = boardingStopId;
    if (!resolvedStopId) {
      const firstStop = await WaitlistService.getFirstJourneyStop(journeyId);
      if (firstStop) resolvedStopId = firstStop;
    }

    // If still no stop, use empty string (service handles this gracefully)
    const result = await WaitlistService.addToWaitlist(user.id, journeyId, resolvedStopId || '');
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
}

export async function getStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const user = req.user as { id: string };
    const { journeyId, stopId } = waitlistStatusSchema.parse(req.query);
    const result = await WaitlistService.getWaitlistStatus(user.id, journeyId, stopId);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function getMyWaitlist(req: Request, res: Response, next: NextFunction) {
  try {
    const user = req.user as { id: string };
    const result = await WaitlistService.getUserWaitlist(user.id);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function cancelWaitlistEntry(req: Request, res: Response, next: NextFunction) {
  try {
    const user = req.user as { id: string };
    const { id } = req.params;
    const result = await WaitlistService.cancelWaitlistEntry(user.id, id as string);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

const approveAlightingSchema = z.object({
  ticketId: z.string().uuid(),
});

export async function approveAlighting(req: Request, res: Response, next: NextFunction) {
  try {
    const user = req.user as { id: string };
    const { ticketId } = approveAlightingSchema.parse(req.body);
    const result = await WaitlistService.approveAlighting(user.id, ticketId);
    res.json(result);
  } catch (error) {
    next(error);
  }
}
