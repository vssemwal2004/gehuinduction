import { Router } from 'express';
import { createGroup, deleteGroup, listGroups, updateGroup } from '../controllers/groupController.js';
import { requireAuth, requireRole, requireSuperAdmin } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();
router.use(requireAuth, requireRole('admin'));
router.get('/', asyncHandler(listGroups));
router.post('/', requireSuperAdmin, asyncHandler(createGroup));
router.put('/:groupId', requireSuperAdmin, asyncHandler(updateGroup));
router.delete('/:groupId', requireSuperAdmin, asyncHandler(deleteGroup));
export default router;
