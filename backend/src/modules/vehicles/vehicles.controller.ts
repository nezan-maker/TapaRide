import { Request, Response, NextFunction } from 'express';
import { paginationSchema } from '../../lib/pagination.js';
import { createVehicleSchema, assignVehicleDriverSchema } from './vehicles.schema.js';
import * as VehiclesService from './vehicles.service.js';

export async function createVehicle(req: Request, res: Response, next: NextFunction) {
  try {
    const user = req.user as { id: string };
    const dto = createVehicleSchema.parse(req.body);
    const result = await VehiclesService.createVehicle(user.id, dto);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
}

export async function listVehicles(req: Request, res: Response, next: NextFunction) {
  try {
    const user = req.user as { id: string };
    const { agencyId } = req.query as { agencyId?: string };
    const pagination = paginationSchema.parse(req.query);
    const result = await VehiclesService.listVehicles(user.id, pagination, agencyId);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function assignDriver(req: Request, res: Response, next: NextFunction) {
  try {
    const user = req.user as { id: string };
    const { id } = req.params;
    const dto = assignVehicleDriverSchema.parse(req.body);
    const result = await VehiclesService.assignDriver(id as string, user.id, dto);
    res.json(result);
  } catch (error) {
    next(error);
  }
}
