import crypto from 'crypto';
import { env } from '../config/env.js';

const encryptionKey = crypto.createHash('sha256').update(env.QR_ENCRYPTION_KEY).digest();

export function createQrToken() {
  const token = crypto.randomBytes(32).toString('base64url');
  return {
    token,
    tokenHash: hashQrToken(token),
    tokenEncrypted: encryptQrToken(token),
  };
}

export function hashQrToken(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

export function encryptQrToken(token) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey, iv);
  const encrypted = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString('base64url');
}

export function decryptQrToken(value) {
  const payload = Buffer.from(value, 'base64url');
  const iv = payload.subarray(0, 12);
  const tag = payload.subarray(12, 28);
  const encrypted = payload.subarray(28);
  const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
}
