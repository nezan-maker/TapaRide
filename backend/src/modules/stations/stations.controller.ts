import { Request, Response, NextFunction } from 'express';
import { paginationSchema } from '../../lib/pagination.js';
import { createStationSchema } from './stations.schema.js';
import * as StationsService from './stations.service.js';

export async function createStation(req: Request, res: Response, next: NextFunction) {
  try {
    const user = req.user as { id: string };
    const dto = createStationSchema.parse(req.body);
    const result = await StationsService.createStation(user.id, dto);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
}

export async function listStations(req: Request, res: Response, next: NextFunction) {
  try {
    const { agencyId } = req.query as { agencyId?: string };
    const pagination = paginationSchema.parse(req.query);
    const result = await StationsService.listStations(pagination, agencyId);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function getStation(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const result = await StationsService.getStation(id as string);
    res.json(result);
  } catch (error) {
    next(error);
  }
}
