import mongoose from 'mongoose';
import Group from '../models/Group.js';
import Student from '../models/Student.js';
import { createQrToken } from '../services/qrTokenService.js';
import { studentInputSchema } from '../validators/studentValidator.js';
import { HttpError } from '../utils/httpError.js';

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function resolveGroups(groupIds) {
  const ids = [...new Set(groupIds)];
  const groups = await Group.find({ _id: { $in: ids }, isActive: true })
    .select('_id name code')
    .lean();
  if (groups.length !== ids.length) throw new HttpError(400, 'One or more selected groups are unavailable');
  return { ids };
}

function duplicateMessage(error) {
  const field = Object.keys(error.keyPattern || {})[0];
  if (field === 'studentId') return 'Student ID already exists';
  if (field === 'email') return 'Student email already exists';
  return 'Student record already exists';
}

export async function listStudents(req, res) {
  const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(10, Number.parseInt(req.query.limit, 10) || 25));
  const search = String(req.query.search || '').trim().slice(0, 120);
  const status = String(req.query.status || '').trim();
  const groupId = String(req.query.groupId || '').trim();
  const query = {};

  if (search) {
    const pattern = new RegExp(escapeRegex(search), 'i');
    query.$or = [{ name: pattern }, { studentId: pattern }, { email: pattern }];
  }
  if (['not_registered', 'registered', 'inactive'].includes(status)) query.registrationStatus = status;
  if (mongoose.isValidObjectId(groupId)) query.groupIds = groupId;

  const [students, total] = await Promise.all([
    Student.find(query)
      .populate('groupIds', 'name code whatsappLink')
      .populate('groupCoordinatorId', 'name mobile email')
      .select('name studentId email groupIds groupCoordinatorName groupCoordinatorMobile groupCoordinatorId registrationStatus qrGeneratedAt qrRevokedAt lastScannedAt scanCount isActive createdAt')
      .sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Student.countDocuments(query),
  ]);

  res.json({
    students: students.map((student) => ({
      ...student,
      groupCoordinatorId: student.groupCoordinatorId || (student.groupCoordinatorName ? {
        name: student.groupCoordinatorName,
        mobile: student.groupCoordinatorMobile,
      } : null),
    })),
    pagination: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) },
  });
}

export async function getStudent(req, res) {
  if (!mongoose.isValidObjectId(req.params.studentId)) throw new HttpError(400, 'Invalid student ID');
  const student = await Student.findById(req.params.studentId)
    .populate('groupIds', 'name code whatsappLink')
    .populate('groupCoordinatorId', 'name mobile email')
    .select('-qrTokenHash -qrTokenEncrypted')
    .lean();
  if (!student) throw new HttpError(404, 'Student not found');
  res.json({ student });
}

export async function createStudent(req, res) {
  const parsed = studentInputSchema.safeParse(req.body);
  if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message || 'Invalid student details');
  const { ids } = await resolveGroups(parsed.data.groupIds);
  const qr = createQrToken();
  try {
    const student = await Student.create({
      name: parsed.data.name,
      studentId: parsed.data.studentId,
      email: parsed.data.email.toLowerCase(),
      groupIds: ids,
      groupCoordinatorName: parsed.data.groupCoordinatorName,
      groupCoordinatorMobile: parsed.data.groupCoordinatorMobile,
      qrTokenHash: qr.tokenHash,
      qrTokenEncrypted: qr.tokenEncrypted,
    });
    res.status(201).json({ student: await Student.findById(student._id).populate('groupIds', 'name code').lean() });
  } catch (error) {
    if (error?.code === 11000) throw new HttpError(409, duplicateMessage(error));
    throw error;
  }
}

export async function updateStudent(req, res) {
  if (!mongoose.isValidObjectId(req.params.studentId)) throw new HttpError(400, 'Invalid student ID');
  const parsed = studentInputSchema.safeParse(req.body);
  if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message || 'Invalid student details');
  const { ids } = await resolveGroups(parsed.data.groupIds);
  try {
    const student = await Student.findByIdAndUpdate(req.params.studentId, {
      name: parsed.data.name,
      studentId: parsed.data.studentId,
      email: parsed.data.email.toLowerCase(),
      groupIds: ids,
      groupCoordinatorName: parsed.data.groupCoordinatorName,
      groupCoordinatorMobile: parsed.data.groupCoordinatorMobile,
    }, { new: true, runValidators: true }).populate('groupIds', 'name code');
    if (!student) throw new HttpError(404, 'Student not found');
    res.json({ student });
  } catch (error) {
    if (error?.code === 11000) throw new HttpError(409, duplicateMessage(error));
    throw error;
  }
}

export async function deactivateStudent(req, res) {
  if (!mongoose.isValidObjectId(req.params.studentId)) throw new HttpError(400, 'Invalid student ID');
  const student = await Student.findByIdAndUpdate(req.params.studentId, {
    isActive: false,
    registrationStatus: 'inactive',
    qrRevokedAt: new Date(),
  }, { new: true }).select('name studentId registrationStatus isActive qrRevokedAt');
  if (!student) throw new HttpError(404, 'Student not found');
  res.json({ student, message: 'Student deactivated and QR access revoked' });
}

export async function reactivateStudent(req, res) {
  if (!mongoose.isValidObjectId(req.params.studentId)) throw new HttpError(400, 'Invalid student ID');
  const student = await Student.findByIdAndUpdate(req.params.studentId, {
    $set: {
      isActive: true,
      registrationStatus: 'not_registered',
    },
    $unset: { qrRevokedAt: 1 },
  }, { new: true }).select('name studentId registrationStatus isActive');
  if (!student) throw new HttpError(404, 'Student not found');
  res.json({ student, message: 'Student reactivated' });
}
