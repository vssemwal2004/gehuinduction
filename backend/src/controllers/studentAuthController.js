import crypto from 'node:crypto';
import { z } from 'zod';
import { getActiveDatabaseContexts, getModels } from '../config/database.js';
import { env } from '../config/env.js';
import { isMsg91OtpConfigured, sendMsg91Otp, toMsg91Mobile } from '../services/msg91OtpService.js';
import { HttpError } from '../utils/httpError.js';

const OTP_TTL_MS = env.MSG91_OTP_VALIDITY_MINUTES * 60 * 1000;
const otpStore = new Map();
const phoneSendHoldStore = new Map();
const phoneVerifyStore = new Map();

const phoneSchema = z.object({
  phone: z.string().trim().min(7).max(30).regex(/^[+0-9 ()-]+$/, 'Enter a valid phone number'),
});

const verifySchema = phoneSchema.extend({
  otp: z.string().trim().regex(/^\d{6}$/, 'Enter the 6 digit OTP'),
});

function normalizePhone(phone) {
  return toMsg91Mobile(phone);
}

function studentPayload(student) {
  return {
    id: student._id,
    name: student.name,
    email: student.email,
    phone: student.phone || '',
    qrLink: student.qrLink || '',
  };
}

function cleanupExpired(map, now = Date.now()) {
  for (const [key, value] of map.entries()) {
    const expiry = value.expiresAt || value.holdUntil;
    if (expiry && expiry <= now) map.delete(key);
  }
}

function assertPhoneCanRequestOtp(phoneKey) {
  const now = Date.now();
  cleanupExpired(phoneSendHoldStore, now);
  const existing = phoneSendHoldStore.get(phoneKey);
  if (existing?.holdUntil > now) {
    const seconds = Math.ceil((existing.holdUntil - now) / 1000);
    throw new HttpError(429, `Please wait ${seconds} seconds before requesting another OTP`);
  }
}

function holdPhoneOtpRequests(phoneKey) {
  phoneSendHoldStore.set(phoneKey, { holdUntil: Date.now() + env.STUDENT_OTP_PHONE_HOLD_MINUTES * 60 * 1000 });
}

function assertPhoneCanVerifyOtp(phoneKey) {
  const now = Date.now();
  cleanupExpired(phoneVerifyStore, now);
  const record = phoneVerifyStore.get(phoneKey);
  if (record?.count >= env.STUDENT_OTP_VERIFY_LIMIT) {
    throw new HttpError(429, 'Too many OTP verification attempts. Request a new OTP after 5 minutes.');
  }
}

function recordFailedVerify(phoneKey) {
  const now = Date.now();
  const current = phoneVerifyStore.get(phoneKey);
  if (!current || current.expiresAt <= now) {
    phoneVerifyStore.set(phoneKey, { count: 1, expiresAt: now + env.STUDENT_OTP_PHONE_HOLD_MINUTES * 60 * 1000 });
    return;
  }
  current.count += 1;
}

export async function requestStudentOtp(req, res) {
  const parsed = phoneSchema.safeParse(req.body);
  if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message || 'Enter a valid phone number');

  const phoneKey = normalizePhone(parsed.data.phone);
  assertPhoneCanRequestOtp(phoneKey);
  let qrRecord;
  let dbKey;
  for (const context of getActiveDatabaseContexts()) {
    const record = await context.models.StudentQrData.findOne({ phoneKey, isActive: true }).select('name phone phoneKey').lean();
    if (record) {
      qrRecord = record;
      dbKey = context.key;
      break;
    }
  }
  if (!qrRecord) throw new HttpError(404, 'No active student QR data found for this phone number');

  const otp = String(crypto.randomInt(100000, 1000000));
  otpStore.set(phoneKey, { otp, expiresAt: Date.now() + OTP_TTL_MS, attempts: 0, qrDataId: qrRecord._id.toString(), dbKey });
  if (isMsg91OtpConfigured()) {
    await sendMsg91Otp(phoneKey, otp);
    holdPhoneOtpRequests(phoneKey);
    res.json({ message: 'OTP sent', expiresInSeconds: OTP_TTL_MS / 1000 });
    return;
  }
  holdPhoneOtpRequests(phoneKey);
  res.json({ message: 'OTP generated', otp, expiresInSeconds: OTP_TTL_MS / 1000 });
}

export async function verifyStudentOtp(req, res) {
  const parsed = verifySchema.safeParse(req.body);
  if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message || 'Enter the phone number and OTP');

  const phoneKey = normalizePhone(parsed.data.phone);
  assertPhoneCanVerifyOtp(phoneKey);
  const record = otpStore.get(phoneKey);
  if (!record || record.expiresAt < Date.now()) {
    otpStore.delete(phoneKey);
    throw new HttpError(401, 'OTP expired. Request a new one.');
  }
  if (record.attempts >= 5) {
    otpStore.delete(phoneKey);
    throw new HttpError(429, 'Too many incorrect OTP attempts. Request a new one.');
  }
  if (record.otp !== parsed.data.otp) {
    record.attempts += 1;
    recordFailedVerify(phoneKey);
    throw new HttpError(401, 'Incorrect OTP');
  }

  otpStore.delete(phoneKey);
  phoneVerifyStore.delete(phoneKey);
  const { StudentQrData } = getModels(record.dbKey);
  const student = await StudentQrData.findById(record.qrDataId)
    .select('name email phone qrLink isActive')
    .lean();
  if (!student || !student.isActive) throw new HttpError(404, 'Student QR data is unavailable');
  res.json({ student: studentPayload(student) });
}
