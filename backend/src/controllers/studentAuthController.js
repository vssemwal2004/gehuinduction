import crypto from 'node:crypto';
import { z } from 'zod';
import StudentQrData from '../models/StudentQrData.js';
import { isMsg91OtpConfigured, sendMsg91Otp, toMsg91Mobile } from '../services/msg91OtpService.js';
import { HttpError } from '../utils/httpError.js';

const OTP_TTL_MS = 5 * 60 * 1000;
const otpStore = new Map();

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

export async function requestStudentOtp(req, res) {
  const parsed = phoneSchema.safeParse(req.body);
  if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message || 'Enter a valid phone number');

  const phoneKey = normalizePhone(parsed.data.phone);
  const qrRecord = await StudentQrData.findOne({ phoneKey, isActive: true }).select('name phone phoneKey').lean();
  if (!qrRecord) throw new HttpError(404, 'No active student QR data found for this phone number');

  const otp = String(crypto.randomInt(100000, 1000000));
  otpStore.set(phoneKey, { otp, expiresAt: Date.now() + OTP_TTL_MS, attempts: 0, qrDataId: qrRecord._id.toString() });
  if (isMsg91OtpConfigured()) {
    await sendMsg91Otp(phoneKey, otp);
    res.json({ message: 'OTP sent', expiresInSeconds: OTP_TTL_MS / 1000 });
    return;
  }
  res.json({ message: 'OTP generated', otp, expiresInSeconds: OTP_TTL_MS / 1000 });
}

export async function verifyStudentOtp(req, res) {
  const parsed = verifySchema.safeParse(req.body);
  if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message || 'Enter the phone number and OTP');

  const phoneKey = normalizePhone(parsed.data.phone);
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
    throw new HttpError(401, 'Incorrect OTP');
  }

  otpStore.delete(phoneKey);
  const student = await StudentQrData.findById(record.qrDataId)
    .select('name email phone qrLink isActive')
    .lean();
  if (!student || !student.isActive) throw new HttpError(404, 'Student QR data is unavailable');
  res.json({ student: studentPayload(student) });
}
