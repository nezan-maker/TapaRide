import { Router } from 'express';
import multer from 'multer';
import { authenticate, requireRoles } from '../../plugins/rbac.js';
import * as AgenciesController from './agencies.controller.js';

const router = Router();

// Agency logo upload: 5 MB in-memory cap. We never write to disk.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
});

router.get('/', AgenciesController.listAgencies);
router.get('/:id', AgenciesController.getAgency);
router.post(
  '/',
  authenticate,
  requireRoles('OWNER'),
  upload.single('logo'),
  AgenciesController.createAgency,
);
router.post('/:id/assign-manager', authenticate, requireRoles('OWNER'), AgenciesController.assignManager);
router.post('/:id/assign-manager-by-email', authenticate, requireRoles('OWNER'), AgenciesController.assignManagerByEmail);
router.post('/:id/assign-driver', authenticate, requireRoles('OWNER', 'MANAGER'), AgenciesController.assignDriver);
router.post('/:id/assign-driver-by-email', authenticate, requireRoles('OWNER', 'MANAGER'), AgenciesController.assignDriverByEmail);
router.post('/assign-driver', authenticate, requireRoles('MANAGER'), AgenciesController.assignDriverFromManager);

export default router;
