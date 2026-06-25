// src/modules/agencies/agencies.controller.ts
import { Request, Response, NextFunction } from 'express';
import { ValidationError } from '../../lib/errors.js';
import { db } from '../../lib/db.js';
import { paginationSchema } from '../../lib/pagination.js';
import {
  createAgencySchema,
  assignManagerSchema,
  assignDriverSchema,
  assignManagerByEmailSchema,
  assignDriverByEmailSchema,
} from './agencies.schema.js';
import * as AgenciesService from './agencies.service.js';

/**
 * POST /api/agencies
 * Multipart form:
 *   - name:       string (required)
 *   - ruraCode:   string (required)
 *   - logo:       PNG/JPEG/SVG file (optional). Pipeline sanitizes and
 *                 uploads to Cloudinary; only the URL is persisted.
 */
export async function createAgency(req: Request, res: Response, next: NextFunction) {
  try {
    const user = req.user as { id: string };

    // Multipart payload: parse text fields directly. multer puts non-files
    // on req.body. We re-validate through Zod so callers using JSON or
    // multipart both get the same error format.
    const dto = createAgencySchema.parse({
      name: req.body?.name,
      ruraCode: req.body?.ruraCode,
    });

    const result = await AgenciesService.createAgency({
      ownerId: user.id,
      dto,
      logo: req.file
        ? {
            buffer: req.file.buffer,
            mimetype: req.file.mimetype,
            size: req.file.size,
            originalname: req.file.originalname,
          }
        : null,
    });

    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
}

export async function listAgencies(_req: Request, res: Response, next: NextFunction) {
  try {
    const pagination = paginationSchema.parse(_req.query);
    const result = await AgenciesService.listAgencies(pagination);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function getAgency(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const result = await AgenciesService.getAgency(id as string);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function assignManager(req: Request, res: Response, next: NextFunction) {
  try {
    const user = req.user as { id: string };
    const { id: agencyId } = req.params;
    const dto = assignManagerSchema.parse(req.body);
    const result = await AgenciesService.assignManager(agencyId as string, user.id, dto);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function assignDriver(req: Request, res: Response, next: NextFunction) {
  try {
    const user = req.user as { id: string };
    const { id: agencyId } = req.params;
    const dto = assignDriverSchema.parse(req.body);
    const result = await AgenciesService.assignDriver(agencyId as string, user.id, dto);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function assignManagerByEmail(req: Request, res: Response, next: NextFunction) {
  try {
    const user = req.user as { id: string };
    const { id: agencyId } = req.params;
    const { email, stationId } = assignManagerByEmailSchema.parse(req.body);
    const result = await AgenciesService.assignManagerByEmail(agencyId as string, user.id, email, stationId);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function assignDriverByEmail(req: Request, res: Response, next: NextFunction) {
  try {
    const user = req.user as { id: string };
    const { id: agencyId } = req.params;
    const { email } = assignDriverByEmailSchema.parse(req.body);
    const result = await AgenciesService.assignDriverByEmail(agencyId as string, user.id, email);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/agencies/assign-driver
 * Manager convenience endpoint — resolves the agency from the manager's profile.
 */
export async function assignDriverFromManager(req: Request, res: Response, next: NextFunction) {
  try {
    const user = req.user as { id: string };
    const fullUser = await db.user.findUnique({
      where: { id: user.id },
      select: { managedAgencyId: true },
    });
    if (!fullUser?.managedAgencyId) {
      throw new ValidationError('You are not assigned to any agency as a manager.');
    }
    const { email } = assignDriverByEmailSchema.parse(req.body);
    const result = await AgenciesService.assignDriverByEmail(fullUser.managedAgencyId, user.id, email);
    res.json(result);
  } catch (error) {
    next(error);
  }
}
