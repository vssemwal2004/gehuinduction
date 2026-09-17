import mongoose from 'mongoose';
import { getRequestModels } from '../config/database.js';
import { createQrToken } from '../services/qrTokenService.js';
import { studentInputSchema } from '../validators/studentValidator.js';
import { HttpError } from '../utils/httpError.js';
import { studentFilterFromRequest } from '../utils/studentFilters.js';

const validId = (value) => { if (!mongoose.isValidObjectId(value)) throw new HttpError(400, 'Invalid student ID'); };
const duplicateMessage = (error) => Object.keys(error.keyPattern || {})[0] === 'studentId' ? 'Student ID already exists' : 'Student record already exists';

export async function listStudents(req, res) {
  const { Student } = getRequestModels(req);
  const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(10, Number.parseInt(req.query.limit, 10) || 25));
  const query = studentFilterFromRequest(req);
  const [students, total] = await Promise.all([
    Student.find(query).select('name studentId mobile semester registrationStatus qrGeneratedAt qrRevokedAt lastScannedAt scanCount isActive createdAt').sort({ createdAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Student.countDocuments(query),
  ]);
  res.json({ students, options: {}, pagination: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) } });
}

export async function getStudentOptions(_req, res) { res.json({ options: {} }); }
export async function getStudent(req, res) { const { Student } = getRequestModels(req); validId(req.params.studentId); const student = await Student.findById(req.params.studentId).select('-qrTokenHash -qrTokenEncrypted').lean(); if (!student) throw new HttpError(404, 'Student not found'); res.json({ student }); }

export async function createStudent(req, res) {
  const { Student } = getRequestModels(req);
  const parsed = studentInputSchema.safeParse(req.body);
  if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message || 'Invalid student details');
  const qr = createQrToken();
  try { const student = await Student.create({ name: parsed.data.name, studentId: parsed.data.studentId, mobile: parsed.data.mobile, semester: parsed.data.semester, qrTokenHash: qr.tokenHash, qrTokenEncrypted: qr.tokenEncrypted }); res.status(201).json({ student }); }
  catch (error) { if (error?.code === 11000) throw new HttpError(409, duplicateMessage(error)); throw error; }
}

export async function updateStudent(req, res) {
  const { Student } = getRequestModels(req); validId(req.params.studentId);
  const parsed = studentInputSchema.safeParse(req.body);
  if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message || 'Invalid student details');
  try { const student = await Student.findByIdAndUpdate(req.params.studentId, { name: parsed.data.name, studentId: parsed.data.studentId, mobile: parsed.data.mobile, semester: parsed.data.semester }, { new: true, runValidators: true }); if (!student) throw new HttpError(404, 'Student not found'); res.json({ student }); }
  catch (error) { if (error?.code === 11000) throw new HttpError(409, duplicateMessage(error)); throw error; }
}

export async function deactivateStudent(req, res) { const { Student } = getRequestModels(req); validId(req.params.studentId); const student = await Student.findByIdAndUpdate(req.params.studentId, { isActive: false, registrationStatus: 'inactive', qrRevokedAt: new Date() }, { new: true }); if (!student) throw new HttpError(404, 'Student not found'); res.json({ student, message: 'Student deactivated and gate pass revoked' }); }
export async function reactivateStudent(req, res) { const { Student } = getRequestModels(req); validId(req.params.studentId); const student = await Student.findByIdAndUpdate(req.params.studentId, { $set: { isActive: true, registrationStatus: 'not_registered', scanCount: 0 }, $unset: { qrRevokedAt: 1, lastScannedAt: 1 } }, { new: true }); if (!student) throw new HttpError(404, 'Student not found'); res.json({ student, message: 'Student reactivated for gate entry' }); }
