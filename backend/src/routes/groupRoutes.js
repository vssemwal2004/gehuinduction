import { Router } from 'express';
import { createGroup, deleteGroup, listGroups, updateGroup } from '../controllers/groupController.js';
import { requireAdminPermission, requireAuth, requireRole } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();
router.use(requireAuth, requireRole('admin'));
router.get('/', asyncHandler(listGroups));
router.post('/', requireAdminPermission('groups'), asyncHandler(createGroup));
router.put('/:groupId', requireAdminPermission('groups'), asyncHandler(updateGroup));
router.delete('/:groupId', requireAdminPermission('groups'), asyncHandler(deleteGroup));
export default router;
