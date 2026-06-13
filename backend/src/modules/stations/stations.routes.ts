import { Router } from 'express';
import { authenticate, requireRoles } from '../../plugins/rbac.js';
import * as StationsController from './stations.controller.js';

const router = Router();

router.get('/', StationsController.listStations);
router.get('/:id', StationsController.getStation);
router.post('/', authenticate, requireRoles('OWNER'), StationsController.createStation);

export default router;
