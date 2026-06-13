import { Router } from 'express';
import { authenticate, requireRoles } from '../../plugins/rbac.js';
import * as UsersController from './users.controller.js';

const router = Router();

router.get('/me', authenticate, UsersController.getMe);
router.get('/', authenticate, requireRoles('OWNER', 'MANAGER'), UsersController.listUsers);

export default router;
