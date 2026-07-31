import { Router } from 'express';
import { openPublicStudentQr } from '../controllers/studentImportController.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();
router.get('/qr/:tokenHash', asyncHandler(openPublicStudentQr));

export default router;
