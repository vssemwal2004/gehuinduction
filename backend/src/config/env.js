import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { z } from 'zod';

const configDir = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(configDir, '../../.env'), quiet: true });

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4100),
  MONGODB_URI: z.string().min(1),
  JWT_SECRET: z.string().min(24),
  QR_ENCRYPTION_KEY: z.string().min(32),
  FRONTEND_ORIGIN: z.string().url(),
  ADMIN_EMAIL: z.string().email(),
  ADMIN_PASSWORD: z.string().min(8),
  SMTP_HOST: z.string().min(1),
  SMTP_PORT: z.coerce.number().int().positive(),
  SMTP_SECURE: z.string().transform((value) => value === 'true'),
  SMTP_USER: z.string().min(1),
  SMTP_PASS: z.string().min(1),
  MAIL_FROM: z.string().email(),
  TRUST_PROXY: z.string().regex(/^(false|[1-9]\d*)$/).default('false').transform((value) => value === 'false' ? false : Number(value)),
}).superRefine((value, context) => {
  if (value.NODE_ENV !== 'production') return;
  if (value.JWT_SECRET.length < 48 || /change|secret/i.test(value.JWT_SECRET)) {
    context.addIssue({ code: 'custom', path: ['JWT_SECRET'], message: 'Production JWT secret must be random and at least 48 characters' });
  }
  if (value.QR_ENCRYPTION_KEY.length < 48 || /change|secret/i.test(value.QR_ENCRYPTION_KEY)) {
    context.addIssue({ code: 'custom', path: ['QR_ENCRYPTION_KEY'], message: 'Production QR encryption key must be random and at least 48 characters' });
  }
  if (value.ADMIN_PASSWORD.length < 12 || ['admin123', 'password'].includes(value.ADMIN_PASSWORD.toLowerCase())) {
    context.addIssue({ code: 'custom', path: ['ADMIN_PASSWORD'], message: 'Production administrator password must be strong and at least 12 characters' });
  }
  if (!value.SMTP_SECURE) {
    context.addIssue({ code: 'custom', path: ['SMTP_SECURE'], message: 'Production SMTP connection must use TLS' });
  }
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid environment configuration:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
