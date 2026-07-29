import { Router } from 'express';
import { listActivityLogs, listMailJobs, retryMailJob } from '../controllers/operationsController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();
router.use(requireAuth, requireRole('admin'));
router.get('/activity', asyncHandler(listActivityLogs));
router.get('/mail-jobs', asyncHandler(listMailJobs));
router.post('/mail-jobs/:jobId/retry', asyncHandler(retryMailJob));
export default router;
