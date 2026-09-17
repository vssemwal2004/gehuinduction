import { Router } from 'express';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import { getStudentDataStatus, uploadStudentData } from '../controllers/studentDataController.js';
import { requireAdminPermission, requireAuth, requireRole } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024, files: 1 }, fileFilter: (_req, file, cb) => { const ok = /\.(xlsx|csv)$/i.test(file.originalname); cb(ok ? null : new Error('Upload an .xlsx or .csv file'), ok); } });
router.use(requireAuth, requireRole('admin'), requireAdminPermission('students'));
router.get('/status', asyncHandler(getStudentDataStatus));
router.post('/upload', rateLimit({ windowMs: 15 * 60_000, limit: 10 }), upload.single('file'), asyncHandler(uploadStudentData));
export default router;
