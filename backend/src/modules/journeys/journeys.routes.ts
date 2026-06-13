import { Router } from 'express';
import { authenticate, requireRoles } from '../../plugins/rbac.js';
import * as JourneysController from './journeys.controller.js';

const router = Router();

router.get('/', JourneysController.listJourneys);
router.get('/:id/availability', JourneysController.getAvailability);
router.post('/', authenticate, requireRoles('MANAGER'), JourneysController.createJourney);

router.post(
  '/:id/stops/reached', 
  authenticate, 
  requireRoles('DRIVER', 'MANAGER'), 
  JourneysController.markStopAsReached
);

router.post(
  '/:id/alight', 
  authenticate, 
  requireRoles('DRIVER', 'MANAGER'), 
  JourneysController.confirmAlighting
);

export default router;
