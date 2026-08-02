import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { requestStudentOtp, verifyStudentOtp } from '../controllers/studentAuthController.js';
import { env } from '../config/env.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();
const otpLimiter = rateLimit({
  windowMs: env.STUDENT_OTP_IP_WINDOW_MINUTES * 60 * 1000,
  limit: env.STUDENT_OTP_IP_LIMIT,
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/request-otp', otpLimiter, asyncHandler(requestStudentOtp));
router.post('/verify-otp', otpLimiter, asyncHandler(verifyStudentOtp));

export default router;
