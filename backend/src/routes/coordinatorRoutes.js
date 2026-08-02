import { Router } from 'express';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import { commitCoordinatorImport, createCoordinator, downloadCoordinatorTemplate, listCoordinators, previewCoordinatorImport, resendCoordinatorCredentials, setCoordinatorActive, updateCoordinator } from '../controllers/coordinatorController.js';
import { requireAuth, requireRole, requireSuperAdmin } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 4 * 1024 * 1024, files: 1 }, fileFilter: (_req, file, callback) => {
  const valid = /\.(xlsx|csv)$/i.test(file.originalname);
  callback(valid ? null : new Error('Upload an .xlsx or .csv file'), valid);
} });
const importLimiter = rateLimit({ windowMs: 15 * 60_000, limit: 10, standardHeaders: true, legacyHeaders: false });
router.use(requireAuth, requireRole('admin'), requireSuperAdmin);
router.get('/import/template', downloadCoordinatorTemplate);
router.post('/import/preview', importLimiter, upload.single('file'), asyncHandler(previewCoordinatorImport));
router.post('/import/commit', importLimiter, upload.single('file'), asyncHandler(commitCoordinatorImport));
router.get('/', asyncHandler(listCoordinators));
router.post('/', asyncHandler(createCoordinator));
router.put('/:coordinatorId', asyncHandler(updateCoordinator));
router.patch('/:coordinatorId/status', asyncHandler(setCoordinatorActive));
router.post('/:coordinatorId/resend-credentials', asyncHandler(resendCoordinatorCredentials));
export default router;
