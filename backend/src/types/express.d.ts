import { Role } from '@prisma/client';

declare global {
  namespace Express {
    interface Request {
      id?: string;
      log?: {
        info: (...args: unknown[]) => void;
        warn: (...args: unknown[]) => void;
        error: (...args: unknown[]) => void;
        debug: (...args: unknown[]) => void;
      };
      user?: {
        id: string;
        role: Role;
        isVerified?: boolean;
        phoneVerifiedAt?: string | null;
      };
    }
  }
}
