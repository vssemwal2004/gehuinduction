import { Router } from 'express';
import { createGroup, deleteGroup, listGroups, updateGroup } from '../controllers/groupController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();
router.use(requireAuth, requireRole('admin'));
router.get('/', asyncHandler(listGroups));
router.post('/', asyncHandler(createGroup));
router.put('/:groupId', asyncHandler(updateGroup));
router.delete('/:groupId', asyncHandler(deleteGroup));
export default router;
