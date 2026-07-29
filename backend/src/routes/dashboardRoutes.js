import { Router } from 'express';
import { getAdminDashboard } from '../controllers/dashboardController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();
router.get('/admin', requireAuth, requireRole('admin'), asyncHandler(getAdminDashboard));
export default router;
