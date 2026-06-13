import { Request, Response, NextFunction } from 'express';
import { Role } from '@prisma/client';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { db } from '../lib/db.js';
import {
  AuthenticationError,
  AuthorizationError,
} from '../lib/errors.js';
import { checkPasswordExpiry } from '../modules/auth/password-policy.middleware.js';

/**
 * RBAC guard factory — returns an Express middleware that allows only the
 * specified roles.
 *
 * Usage:
 *   router.get('/secret', authenticate, requireRoles('OWNER', 'MANAGER'), handler);
 */
export function requireRoles(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const user = req.user;

    if (!user) {
      return next(new AuthenticationError('Not authenticated'));
    }

    if (!roles.includes(user.role)) {
      return next(new AuthorizationError(`This action requires one of: ${roles.join(', ')}`));
    }

    next();
  };
}

/**
 * Middleware to verify a JWT and attach the user payload to `req.user`.
 */
export async function authenticate(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(new AuthenticationError('Not authenticated'));
  }

  const token = authHeader.split(' ')[1];
  if (!token) {
    return next(new AuthenticationError('Not authenticated'));
  }

  const secret: string = env.JWT_SECRET;
  try {
    const payload = jwt.verify(token, secret) as unknown as {
      id: string;
      role: Role;
      isVerified?: boolean;
      phoneVerifiedAt?: string | null;
    };
    req.user = payload;
    await checkPasswordExpiry(req, res, next);
  } catch (err) {
    next(new AuthenticationError('Invalid or expired access token'));
  }
}

export async function requireVerifiedAccount(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  const user = req.user;

  if (!user) {
    return next(new AuthenticationError('Not authenticated'));
  }

  try {
    const currentUser = await db.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        role: true,
        isVerified: true,
        phoneVerifiedAt: true,
      },
    });

    if (!currentUser) {
      return next(new AuthenticationError('Unknown user'));
    }

    if (!currentUser.isVerified || !currentUser.phoneVerifiedAt) {
      return next(
        new AuthorizationError(
          'A fully verified account is required for this action',
        ),
      );
    }

    req.user = {
      id: currentUser.id,
      role: currentUser.role,
      isVerified: currentUser.isVerified,
      phoneVerifiedAt: currentUser.phoneVerifiedAt
        ? currentUser.phoneVerifiedAt.toISOString()
        : null,
    };
    next();
  } catch (error) {
    next(error);
  }
}
