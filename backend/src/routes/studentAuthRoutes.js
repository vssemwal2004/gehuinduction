import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { requestStudentOtp, verifyStudentOtp } from '../controllers/studentAuthController.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();
const limiter = rateLimit({ windowMs: 15 * 60_000, limit: 30, standardHeaders: true, legacyHeaders: false });
router.post('/request-otp', limiter, asyncHandler(requestStudentOtp));
router.post('/verify-otp', limiter, asyncHandler(verifyStudentOtp));
export default router;
