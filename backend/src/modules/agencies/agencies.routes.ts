import { Router } from 'express';
import { authenticate, requireRoles } from '../../plugins/rbac.js';
import * as AgenciesController from './agencies.controller.js';

const router = Router();

router.get('/', AgenciesController.listAgencies);
router.get('/:id', AgenciesController.getAgency);
router.post('/', authenticate, requireRoles('OWNER'), AgenciesController.createAgency);
router.post('/:id/assign-manager', authenticate, requireRoles('OWNER'), AgenciesController.assignManager);
router.post('/:id/assign-manager-by-email', authenticate, requireRoles('OWNER'), AgenciesController.assignManagerByEmail);
router.post('/:id/assign-driver', authenticate, requireRoles('OWNER', 'MANAGER'), AgenciesController.assignDriver);
router.post('/:id/assign-driver-by-email', authenticate, requireRoles('OWNER', 'MANAGER'), AgenciesController.assignDriverByEmail);
router.post('/assign-driver', authenticate, requireRoles('MANAGER'), AgenciesController.assignDriverFromManager);

export default router;
