import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { scanQr, sendScanMailAgain } from '../controllers/scanController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();
router.use(requireAuth, requireRole('scan_coordinator'));
router.use(rateLimit({ windowMs: 60_000, limit: 120, standardHeaders: true, legacyHeaders: false, keyGenerator: (req) => String(req.user._id) }));
router.post('/', asyncHandler(scanQr));
router.post('/:studentId/send-again', asyncHandler(sendScanMailAgain));
export default router;
