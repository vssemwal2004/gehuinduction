import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { env } from './config/env.js';
import authRoutes from './routes/authRoutes.js';
import dashboardRoutes from './routes/dashboardRoutes.js';
import groupRoutes from './routes/groupRoutes.js';
import studentRoutes from './routes/studentRoutes.js';
import studentQrDataRoutes from './routes/studentQrDataRoutes.js';
import coordinatorRoutes from './routes/coordinatorRoutes.js';
import scanRoutes from './routes/scanRoutes.js';
import operationsRoutes from './routes/operationsRoutes.js';
import emailTemplateRoutes from './routes/emailTemplateRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import publicRoutes from './routes/publicRoutes.js';
import studentAuthRoutes from './routes/studentAuthRoutes.js';
import { activityLogger } from './middleware/activityLogger.js';
import { requireTrustedOrigin } from './middleware/originGuard.js';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors({ origin: env.FRONTEND_ORIGIN, credentials: true }));
  app.use(cookieParser());
  app.use(express.json({ limit: '1mb' }));
  app.set('trust proxy', env.TRUST_PROXY);
  app.use(rateLimit({ windowMs: 60000, limit: 300, standardHeaders: true, legacyHeaders: false }));
  app.use(requireTrustedOrigin);
  app.use(activityLogger);
  app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'geu-induction-connect' }));
  app.use('/api/public', publicRoutes);
  app.use('/api/student-auth', studentAuthRoutes);
  app.use('/api/auth', authRoutes);
  app.use('/api/dashboard', dashboardRoutes);
  app.use('/api/groups', groupRoutes);
  app.use('/api/students', studentRoutes);
  app.use('/api/student-qr-data', studentQrDataRoutes);
  app.use('/api/coordinators', coordinatorRoutes);
  app.use('/api/admins', adminRoutes);
  app.use('/api/scans', scanRoutes);
  app.use('/api/operations', operationsRoutes);
  app.use('/api/email-template', emailTemplateRoutes);
  app.use((_req, res) => res.status(404).json({ error: 'Route not found' }));
  app.use((err, _req, res, _next) => {
    const statusCode = err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError'
      ? 401
      : err.code === 'LIMIT_FILE_SIZE' || err.name === 'MulterError'
        ? 400
        : (err.statusCode || (err.message === 'Upload an .xlsx or .csv file' ? 400 : 500));
    if (statusCode >= 500) console.error(err);
    res.status(statusCode).json({ error: statusCode < 500 ? err.message : 'Internal server error' });
  });
  return app;
}
