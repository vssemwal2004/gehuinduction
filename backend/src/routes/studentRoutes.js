import { Router } from 'express';
import {
  createStudent,
  deactivateStudent,
  getStudent,
  listStudents,
  reactivateStudent,
  updateStudent,
} from '../controllers/studentController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import {
  commitStudentImport,
  downloadQrPackage,
  downloadStudentTemplate,
  exportStudentsExcel,
  listImportHistory,
  previewStudentImport,
} from '../controllers/studentImportController.js';

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
const qrPackageLimiter = rateLimit({ windowMs: 60 * 60_000, limit: 5, standardHeaders: true, legacyHeaders: false });
router.use(requireAuth, requireRole('admin'));
router.get('/import/template', downloadStudentTemplate);
router.post('/import/preview', importLimiter, upload.single('file'), asyncHandler(previewStudentImport));
router.post('/import/commit', importLimiter, upload.single('file'), asyncHandler(commitStudentImport));
router.get('/import/history', asyncHandler(listImportHistory));
router.get('/export.xlsx', asyncHandler(exportStudentsExcel));
router.get('/qr-package.zip', qrPackageLimiter, asyncHandler(downloadQrPackage));
router.get('/', asyncHandler(listStudents));
router.post('/', asyncHandler(createStudent));
router.get('/:studentId', asyncHandler(getStudent));
router.put('/:studentId', asyncHandler(updateStudent));
router.delete('/:studentId', asyncHandler(deactivateStudent));
router.post('/:studentId/reactivate', asyncHandler(reactivateStudent));
export default router;
