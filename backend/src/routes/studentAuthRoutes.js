import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { loginStudent } from '../controllers/studentAuthController.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();
router.post('/login', rateLimit({ windowMs: 15 * 60_000, limit: 20, standardHeaders: true, legacyHeaders: false }), asyncHandler(loginStudent));
export default router;
