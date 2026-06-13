import { Request, Response, NextFunction } from 'express';
import { db } from '../../lib/db.js';

const EXPIRE_DAYS = 14;

/**
 * Middleware that blocks requests if the user's password has expired (14 days).
 * Users are redirected to the change-password flow.
 */
export async function checkPasswordExpiry(req: Request, res: Response, next: NextFunction) {
  const user = req.user as { id: string };
  if (!user) return next();

  // Allow essential routes even if password is expired
  const excludedPaths = [
    '/api/auth/change-password',
    '/api/auth/logout',
    '/health',
    '/docs'
  ];
  if (excludedPaths.some(path => req.path.startsWith(path))) {
    return next();
  }

  const dbUser = await db.user.findUnique({
    where: { id: user.id },
    select: { lastPasswordChangedAt: true },
  });

  if (!dbUser) return next();
  if (!dbUser.lastPasswordChangedAt) {
    return res.status(403).json({
      code: 'PASSWORD_CHANGE_REQUIRED',
      message: 'You must set a password before continuing.',
      redirectTo: '/change-password',
    });
  }

  const daysSinceChange = (Date.now() - dbUser.lastPasswordChangedAt.getTime()) / (1000 * 60 * 60 * 24);

  if (daysSinceChange > EXPIRE_DAYS) {
    return res.status(403).json({
      code: 'PASSWORD_EXPIRED',
      message: 'Your password expired after 14 days of use. You must change it to continue.',
      redirectTo: '/change-password',
    });
  }

  next();
}
