import { Router } from 'express';
import { authenticate, requireRoles } from '../../plugins/rbac.js';
import * as BulkBookingController from './bulk-bookings.controller.js';

const router = Router();

// Only organization owners can create bulk bookings.
router.post(
  '/', 
  authenticate, 
  requireRoles('ORGANIZATION'), 
  BulkBookingController.createBulkBooking
);

// List bulk bookings (scoped to user's organizations)
router.get(
  '/',
  authenticate,
  requireRoles('ORGANIZATION'),
  BulkBookingController.listBulkBookings
);

// Register and query organizations
router.post(
  '/organizations',
  authenticate,
  requireRoles('ORGANIZATION'),
  BulkBookingController.createOrganization
);

router.get(
  '/organizations',
  authenticate,
  requireRoles('ORGANIZATION'),
  BulkBookingController.getMyOrganizations
);

// Drivers can validate boarding (Master scan or individual scan)
router.post(
  '/validate', 
  authenticate, 
  requireRoles('DRIVER', 'MANAGER'), 
  BulkBookingController.validateBoarding
);

// Drivers mark arrival
router.post(
  '/passengers/:id/alight', 
  authenticate, 
  requireRoles('DRIVER', 'MANAGER', 'OWNER'), 
  BulkBookingController.markAsAlighted
);

export default router;
