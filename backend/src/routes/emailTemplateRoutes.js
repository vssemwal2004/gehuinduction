import { Router } from 'express';
import {
  getEmailTemplate,
  previewEmailTemplate,
  saveEmailTemplate,
  sendTestEmailTemplate,
} from '../controllers/emailTemplateController.js';
import { requireAdminPermission, requireAuth, requireRole } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();
router.use(requireAuth, requireRole('admin'), requireAdminPermission('settings'));
router.get('/', asyncHandler(getEmailTemplate));
router.put('/', asyncHandler(saveEmailTemplate));
router.post('/preview', asyncHandler(previewEmailTemplate));
router.post('/test', asyncHandler(sendTestEmailTemplate));

export default router;
