import { Router } from 'express';
import { createAdmin, listAdmins, resendAdminCredentials, setAdminActive, updateAdmin } from '../controllers/adminController.js';
import { requireAdminPermission, requireAuth, requireRole } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();
router.use(requireAuth, requireRole('admin'), requireAdminPermission('admins'));
router.get('/', asyncHandler(listAdmins));
router.post('/', asyncHandler(createAdmin));
router.put('/:adminId', asyncHandler(updateAdmin));
router.patch('/:adminId/status', asyncHandler(setAdminActive));
router.post('/:adminId/resend-credentials', asyncHandler(resendAdminCredentials));
export default router;
