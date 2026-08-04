import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { z } from 'zod';

const configDir = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(configDir, '../../.env'), quiet: true, override: true });

const optionalTrimmed = (schema) => z.preprocess((value) => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed || undefined;
}, schema.optional());

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4100),
  MONGODB_URI: z.string().min(1),
  MONGODB_DB_NAME: z.string().trim().min(1).default('rfid_registration'),
  MONGODB_SECONDARY_URI: optionalTrimmed(z.string().min(1)),
  MONGODB_SECONDARY_DB_NAME: optionalTrimmed(z.string().min(1)),
  JWT_SECRET: z.string().min(24),
  QR_ENCRYPTION_KEY: z.string().min(32),
  FRONTEND_ORIGIN: z.string().url(),
  ADMIN_EMAIL: z.string().email(),
  ADMIN_PASSWORD: z.string().min(8),
  RESET_SEEDED_ADMIN_PASSWORDS: z.string().transform((value) => value === 'true').default('false'),
  PRIMARY_SUPER_ADMIN_EMAIL: optionalTrimmed(z.string().email()),
  PRIMARY_SUPER_ADMIN_PASSWORD: optionalTrimmed(z.string().min(8)),
  SECONDARY_SUPER_ADMIN_EMAIL: optionalTrimmed(z.string().email()),
  SECONDARY_SUPER_ADMIN_PASSWORD: optionalTrimmed(z.string().min(8)),
  SMTP_HOST: z.string().min(1),
  SMTP_PORT: z.coerce.number().int().positive(),
  SMTP_SECURE: z.string().transform((value) => value === 'true'),
  SMTP_USER: z.string().min(1),
  SMTP_PASS: z.string().min(1),
  MAIL_FROM: z.string().email(),
  MSG91_AUTHKEY: z.string().trim().optional(),
  MSG91_OTP_TEMPLATE_ID: z.string().trim().optional(),
  MSG91_SMS_TEMPLATE_ID: z.string().trim().optional(),
  MSG91_OTP_VALIDITY_MINUTES: z.coerce.number().int().positive().default(5),
  MSG91_DEFAULT_COUNTRY_CODE: z.string().trim().regex(/^\d{1,4}$/).default('91'),
  STUDENT_OTP_IP_LIMIT: z.coerce.number().int().positive().default(300),
  STUDENT_OTP_IP_WINDOW_MINUTES: z.coerce.number().int().positive().default(15),
  STUDENT_OTP_PHONE_HOLD_MINUTES: z.coerce.number().int().positive().default(5),
  STUDENT_OTP_VERIFY_LIMIT: z.coerce.number().int().positive().default(5),
  TRUST_PROXY: z.string().regex(/^(false|[1-9]\d*)$/).default('false').transform((value) => value === 'false' ? false : Number(value)),
}).superRefine((value, context) => {
  if (value.MSG91_AUTHKEY && !value.MSG91_OTP_TEMPLATE_ID && !value.MSG91_SMS_TEMPLATE_ID) {
    context.addIssue({ code: 'custom', path: ['MSG91_AUTHKEY'], message: 'Configure MSG91_SMS_TEMPLATE_ID or MSG91_OTP_TEMPLATE_ID with MSG91_AUTHKEY' });
  }
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
  for (const [path, password] of [
    ['PRIMARY_SUPER_ADMIN_PASSWORD', value.PRIMARY_SUPER_ADMIN_PASSWORD],
    ['SECONDARY_SUPER_ADMIN_PASSWORD', value.SECONDARY_SUPER_ADMIN_PASSWORD],
  ]) {
    if (password && (password.length < 12 || ['admin123', 'password'].includes(password.toLowerCase()))) {
      context.addIssue({ code: 'custom', path: [path], message: 'Production super administrator password must be strong and at least 12 characters' });
    }
  }
  if (value.MONGODB_SECONDARY_URI && !value.SECONDARY_SUPER_ADMIN_EMAIL) {
    context.addIssue({ code: 'custom', path: ['SECONDARY_SUPER_ADMIN_EMAIL'], message: 'Configure SECONDARY_SUPER_ADMIN_EMAIL when MONGODB_SECONDARY_URI is set' });
  }
  if (value.SECONDARY_SUPER_ADMIN_EMAIL && !value.SECONDARY_SUPER_ADMIN_PASSWORD) {
    context.addIssue({ code: 'custom', path: ['SECONDARY_SUPER_ADMIN_PASSWORD'], message: 'Configure SECONDARY_SUPER_ADMIN_PASSWORD for the second database super administrator' });
  }
  if (!value.SMTP_SECURE) {
    context.addIssue({ code: 'custom', path: ['SMTP_SECURE'], message: 'Production SMTP connection must use TLS' });
  }
  if (!value.MSG91_AUTHKEY || (!value.MSG91_OTP_TEMPLATE_ID && !value.MSG91_SMS_TEMPLATE_ID)) {
    context.addIssue({ code: 'custom', path: ['MSG91_AUTHKEY'], message: 'Production student OTP login requires MSG91_AUTHKEY and a MSG91 template ID' });
  }
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid environment configuration:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
