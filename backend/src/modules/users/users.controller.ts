import { Request, Response, NextFunction } from 'express';
import { paginationSchema } from '../../lib/pagination.js';
import * as UsersService from './users.service.js';

export async function getMe(req: Request, res: Response, next: NextFunction) {
  try {
    const user = req.user as { id: string };
    const result = await UsersService.getUserProfile(user.id);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function listUsers(req: Request, res: Response, next: NextFunction) {
  try {
    const user = req.user as { id: string };
    const pagination = paginationSchema.parse(req.query);
    const result = await UsersService.listUsers(user.id, pagination);
    res.json(result);
  } catch (error) {
    next(error);
  }
}
