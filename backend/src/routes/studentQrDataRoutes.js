import { Router } from 'express';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import {
  commitStudentQrDataImport,
  createStudentQrData,
  deleteStudentQrData,
  downloadStudentQrDataTemplate,
  exportStudentQrData,
  listStudentQrData,
  previewStudentQrDataImport,
  updateStudentQrData,
} from '../controllers/studentQrDataController.js';
import { requireAdminPermission, requireAuth, requireRole } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => {
    const extension = file.originalname.toLowerCase().split('.').pop();
    callback(extension === 'xlsx' || extension === 'csv' ? null : new Error('Upload an .xlsx or .csv file'), extension === 'xlsx' || extension === 'csv');
  },
});
const importLimiter = rateLimit({ windowMs: 15 * 60_000, limit: 10, standardHeaders: true, legacyHeaders: false });

router.use(requireAuth, requireRole('admin'), requireAdminPermission('studentQrData'));
router.get('/template', downloadStudentQrDataTemplate);
router.post('/import/preview', importLimiter, upload.single('file'), asyncHandler(previewStudentQrDataImport));
router.post('/import/commit', importLimiter, upload.single('file'), asyncHandler(commitStudentQrDataImport));
router.get('/export.xlsx', asyncHandler(exportStudentQrData));
router.get('/', asyncHandler(listStudentQrData));
router.post('/', asyncHandler(createStudentQrData));
router.put('/:qrDataId', asyncHandler(updateStudentQrData));
router.delete('/:qrDataId', asyncHandler(deleteStudentQrData));

export default router;
