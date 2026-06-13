import { Request, Response, NextFunction } from 'express';
import { paginationSchema } from '../../lib/pagination.js';
import { createParcelSchema, updateParcelStatusSchema } from './parcels.schema.js';
import * as ParcelsService from './parcels.service.js';

export async function createParcel(req: Request, res: Response, next: NextFunction) {
  try {
    const user = req.user as { id: string };
    const dto = createParcelSchema.parse(req.body);
    const result = await ParcelsService.createParcel(user.id, dto);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
}

export async function trackParcel(req: Request, res: Response, next: NextFunction) {
  try {
    const { code } = req.params;
    const result = await ParcelsService.trackParcel(code as string);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function updateStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const user = req.user as { id: string };
    const { id } = req.params;
    const dto = updateParcelStatusSchema.parse(req.body);
    const result = await ParcelsService.updateParcelStatus(id as string, dto, user.id);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function myParcels(req: Request, res: Response, next: NextFunction) {
  try {
    const user = req.user as { id: string };
    const pagination = paginationSchema.parse(req.query);
    const result = await ParcelsService.getUserParcels(user.id, pagination);
    res.json(result);
  } catch (error) {
    next(error);
  }
}
