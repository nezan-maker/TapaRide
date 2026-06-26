import { Request, Response, NextFunction } from 'express';
import { paginationSchema } from '../../lib/pagination.js';
import {
  createParcelSchema,
  updateParcelStatusSchema,
  quoteParcelSchema,
  startClaimSchema,
  claimParcelSchema,
} from './parcels.schema.js';
import * as ParcelsService from './parcels.service.js';

export async function quoteParcel(req: Request, res: Response, next: NextFunction) {
  try {
    const dto = quoteParcelSchema.parse(req.query);
    const result = await ParcelsService.quoteParcel(dto);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

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

export async function cancelParcel(req: Request, res: Response, next: NextFunction) {
  try {
    const user = req.user as { id: string };
    const { id } = req.params;
    const result = await ParcelsService.cancelParcel(id as string, user.id);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function startClaim(req: Request, res: Response, next: NextFunction) {
  try {
    const dto = startClaimSchema.parse(req.body);
    const result = await ParcelsService.startClaimParcel(dto.claimKey);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function claimParcel(req: Request, res: Response, next: NextFunction) {
  try {
    const dto = claimParcelSchema.parse(req.body);
    const result = await ParcelsService.claimParcel(dto.claimKey, dto.receiverPhone);
    res.json(result);
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
