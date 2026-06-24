import { Request, Response, NextFunction } from 'express';
import { paginationSchema } from '../../lib/pagination.js';
import { createJourneySchema } from './journeys.schema.js';
import * as JourneysService from './journeys.service.js';

export async function createJourney(req: Request, res: Response, next: NextFunction) {
  try {
    const user = req.user as { id: string };
    const dto = createJourneySchema.parse(req.body);
    const result = await JourneysService.createJourney(user.id, dto);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
}

export async function listJourneys(req: Request, res: Response, next: NextFunction) {
  try {
    const { sourceId, destId } = req.query as { sourceId?: string; destId?: string };
    const pagination = paginationSchema.parse(req.query);
    const result = await JourneysService.listJourneys(pagination, sourceId, destId);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function getAvailability(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const result = await JourneysService.getJourneyAvailability(id as string);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function getJourney(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const result = await JourneysService.getJourneyDetail(id as string);
    res.json(result);
  } catch (error) {
    next(error);
  }
}
export async function markStopAsReached(req: Request, res: Response, next: NextFunction) {
  try {
    const user = req.user as { id: string };
    const { id: journeyId } = req.params;
    const { stationId } = req.body as { stationId: string };
    const result = await JourneysService.markStopAsReached(user.id, journeyId as string, stationId);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function confirmAlighting(req: Request, res: Response, next: NextFunction) {
  try {
    const user = req.user as { id: string };
    const { id: journeyId } = req.params;
    const { ticketId, stationId, seatNumber } = req.body as { ticketId: string; stationId: string; seatNumber: number };
    const result = await JourneysService.confirmAlighting(user.id, ticketId, journeyId as string, stationId, seatNumber);
    res.json(result);
  } catch (error) {
    next(error);
  }
}
