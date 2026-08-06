import nodemailer from 'nodemailer';
import { env } from '../config/env.js';

export const transport = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  secure: env.SMTP_SECURE,
  auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
  pool: true,
  maxConnections: 2,
  maxMessages: 50,
  rateDelta: 1000,
  rateLimit: 3,
  connectionTimeout: 15_000,
  greetingTimeout: 15_000,
  socketTimeout: 30_000,
});
