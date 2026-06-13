import { Request, Response, NextFunction } from 'express';
import * as BulkBookingService from './bulk-bookings.service.js';
import { createBulkBookingSchema, validateBoardingSchema } from './bulk-bookings.schema.js';

export async function createBulkBooking(req: Request, res: Response, next: NextFunction) {
  try {
    const user = req.user as { id: string };
    const dto = createBulkBookingSchema.parse(req.body);
    const result = await BulkBookingService.createBulkBooking(user.id, dto);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
}

export async function validateBoarding(req: Request, res: Response, next: NextFunction) {
  try {
    const user = req.user as { id: string; role: string };
    const dto = validateBoardingSchema.parse(req.body);
    const result = await BulkBookingService.validateBoarding(user, dto);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function markAsAlighted(req: Request, res: Response, next: NextFunction) {
  try {
    const user = req.user as { id: string; role: string };
    const { id } = req.params;
    const result = await BulkBookingService.markAsAlighted(id as string, user.id);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function createOrganization(req: Request, res: Response, next: NextFunction) {
  try {
    const user = req.user as { id: string };
    const { name } = req.body as { name: string };
    const result = await BulkBookingService.createOrganization(user.id, name);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
}

export async function getMyOrganizations(req: Request, res: Response, next: NextFunction) {
  try {
    const user = req.user as { id: string };
    const result = await BulkBookingService.getMyOrganizations(user.id);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function listBulkBookings(req: Request, res: Response, next: NextFunction) {
  try {
    const user = req.user as { id: string };
    const organizationId = req.query.organizationId as string | undefined;
    const result = await BulkBookingService.listBulkBookings(user.id, organizationId);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

