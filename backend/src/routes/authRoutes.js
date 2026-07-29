import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { changePassword, login, logout, me } from '../controllers/authController.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: true, legacyHeaders: false });
const accountLoginLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => String(req.body?.email || 'missing-email').trim().toLowerCase().slice(0, 180),
});

router.post('/login', loginLimiter, accountLoginLimiter, asyncHandler(login));
router.post('/logout', requireAuth, logout);
router.get('/me', requireAuth, me);
router.post('/change-password', requireAuth, asyncHandler(changePassword));

export default router;
