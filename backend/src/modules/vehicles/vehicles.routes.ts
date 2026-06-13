import { Router } from 'express';
import { authenticate, requireRoles } from '../../plugins/rbac.js';
import * as VehiclesController from './vehicles.controller.js';

const router = Router();

router.get('/', authenticate, requireRoles('OWNER', 'MANAGER', 'DRIVER'), VehiclesController.listVehicles);
router.post('/', authenticate, requireRoles('OWNER'), VehiclesController.createVehicle);
router.post('/:id/assign-driver', authenticate, requireRoles('OWNER'), VehiclesController.assignDriver);

export default router;
