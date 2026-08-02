import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { requestStudentOtp, verifyStudentOtp } from '../controllers/studentAuthController.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();
const otpLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 8, standardHeaders: true, legacyHeaders: false });

router.post('/request-otp', otpLimiter, asyncHandler(requestStudentOtp));
router.post('/verify-otp', otpLimiter, asyncHandler(verifyStudentOtp));

export default router;
