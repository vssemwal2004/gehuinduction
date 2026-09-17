import crypto from 'node:crypto';
import { z } from 'zod';
import { getActiveDatabaseContexts, getModels } from '../config/database.js';
import { env } from '../config/env.js';
import { isMsg91OtpConfigured, sendMsg91Otp, toMsg91Mobile } from '../services/msg91OtpService.js';
import { HttpError } from '../utils/httpError.js';

const mobileSchema = z.object({ mobile: z.string().trim().min(7).max(30) });
const verifySchema = mobileSchema.extend({ otp: z.string().trim().regex(/^\d{4}$/, 'Enter the 4 digit OTP') });
const otpStore = new Map();
const OTP_TTL_MS = env.MSG91_OTP_VALIDITY_MINUTES * 60_000;
const normalizeMobile = (value) => toMsg91Mobile(value);
const otpHash = (mobile, otp) => crypto.createHash('sha256').update(`${mobile}:${otp}:${env.QR_ENCRYPTION_KEY}`).digest('hex');

async function findStudent(mobile) {
  const matches = [];
  for (const context of getActiveDatabaseContexts()) {
    const candidates = await context.models.Student.find({ isActive: true, qrRevokedAt: { $exists: false } }).select('name studentId mobile semester qrLink').lean();
    matches.push(...candidates.filter((student) => normalizeMobile(student.mobile) === mobile).map((student) => ({ student, dbKey: context.key })));
  }
  if (!matches.length) throw new HttpError(404, 'This mobile number is not registered');
  if (matches.length > 1) throw new HttpError(409, 'More than one student uses this mobile number. Please contact the administrator.');
  if (!matches[0].student.qrLink) throw new HttpError(404, 'Your gate pass is not uploaded yet. Please contact the administrator.');
  return matches[0];
}

export async function requestStudentOtp(req, res) {
  const parsed = mobileSchema.safeParse(req.body);
  if (!parsed.success) throw new HttpError(400, 'Enter a valid mobile number');
  const mobile = normalizeMobile(parsed.data.mobile);
  const current = otpStore.get(mobile);
  if (current?.resendAt > Date.now()) throw new HttpError(429, `Please wait ${Math.ceil((current.resendAt - Date.now()) / 1000)} seconds before requesting another OTP`);
  const { student, dbKey } = await findStudent(mobile);
  const otp = String(crypto.randomInt(1000, 10000));
  otpStore.set(mobile, { hash: otpHash(mobile, otp), studentId: String(student._id), dbKey, expiresAt: Date.now() + OTP_TTL_MS, resendAt: Date.now() + 60_000, attempts: 0 });
  try {
    if (isMsg91OtpConfigured()) await sendMsg91Otp(mobile, otp);
    else if (env.NODE_ENV === 'production') throw new HttpError(503, 'OTP service is temporarily unavailable');
  } catch (error) {
    otpStore.delete(mobile);
    throw error;
  }
  res.json({ message: '4 digit OTP sent', expiresInSeconds: OTP_TTL_MS / 1000, ...(env.NODE_ENV !== 'production' && !isMsg91OtpConfigured() ? { otp } : {}) });
}

export async function verifyStudentOtp(req, res) {
  const parsed = verifySchema.safeParse(req.body);
  if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message || 'Enter the 4 digit OTP');
  const mobile = normalizeMobile(parsed.data.mobile);
  const record = otpStore.get(mobile);
  if (!record || record.expiresAt < Date.now()) { otpStore.delete(mobile); throw new HttpError(401, 'OTP expired. Request a new OTP.'); }
  if (record.attempts >= env.STUDENT_OTP_VERIFY_LIMIT) { otpStore.delete(mobile); throw new HttpError(429, 'Too many incorrect attempts. Request a new OTP.'); }
  if (record.hash !== otpHash(mobile, parsed.data.otp)) { record.attempts += 1; throw new HttpError(401, 'Incorrect OTP'); }
  otpStore.delete(mobile);
  const student = await getModels(record.dbKey).Student.findById(record.studentId).select('name studentId mobile semester qrLink isActive').lean();
  if (!student?.isActive || !student.qrLink) throw new HttpError(404, 'Gate pass is unavailable');
  res.json({ student: { id: student._id, name: student.name, studentId: student.studentId, mobile: student.mobile, semester: student.semester, qrLink: student.qrLink } });
}
