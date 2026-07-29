import crypto from 'crypto';
import { env } from '../config/env.js';

const key = crypto.createHash('sha256').update(`${env.QR_ENCRYPTION_KEY}:credentials`).digest();

export function generateTemporaryPassword() {
  return `${crypto.randomBytes(9).toString('base64url')}!7a`;
}

export function encryptCredentialPayload(payload) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(payload)), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString('base64url');
}

export function decryptCredentialPayload(value) {
  const payload = Buffer.from(value, 'base64url');
  const iv = payload.subarray(0, 12);
  const tag = payload.subarray(12, 28);
  const encrypted = payload.subarray(28);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return JSON.parse(Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8'));
}
