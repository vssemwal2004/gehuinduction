import mongoose from 'mongoose';
import { getRequestModels } from '../config/database.js';
import { createQrToken } from '../services/qrTokenService.js';
import { getEmailTemplateSetting } from '../services/emailTemplateService.js';
import { toMsg91Mobile } from '../services/msg91OtpService.js';
import { studentInputSchema } from '../validators/studentValidator.js';
import { HttpError } from '../utils/httpError.js';
import { studentFilterFromRequest } from '../utils/studentFilters.js';

async function resolveGroups(Group, groupIds) {
  const ids = [...new Set(groupIds)];
  const groups = await Group.find({ _id: { $in: ids }, isActive: true })
    .select('_id name code')
    .lean();
  if (groups.length !== ids.length) throw new HttpError(400, 'One or more selected groups are unavailable');
  return { ids };
}

async function requireGroupDetails(req) {
  const setting = await getEmailTemplateSetting(getRequestModels(req));
  return setting.useDefault !== false;
}

function assertStudentDetails(parsed, needsGroupDetails) {
  if (!needsGroupDetails) {
    if (parsed.groupCoordinatorMobile && !/^[+0-9 ()-]{7,30}$/.test(parsed.groupCoordinatorMobile)) {
      throw new HttpError(400, 'Enter a valid coordinator mobile number');
    }
    return;
  }
  if (!parsed.groupIds.length) throw new HttpError(400, 'Select at least one group');
  if (parsed.groupCoordinatorName.length < 2) throw new HttpError(400, 'Group coordinator name is required');
  if (!/^[+0-9 ()-]{7,30}$/.test(parsed.groupCoordinatorMobile)) throw new HttpError(400, 'Enter a valid coordinator mobile number');
}

async function attachQrPhone(models, students) {
  const emails = students.map((student) => student.email).filter(Boolean);
  if (!emails.length) return students;
  const qrRows = await models.StudentQrData.find({ email: { $in: emails } }).select('email phone isActive qrLink').lean();
  const qrByEmail = new Map(qrRows.map((row) => [row.email, row]));
  return students.map((student) => {
    const qrData = qrByEmail.get(student.email);
    return {
      ...student,
      qrDataPhone: qrData?.phone || '',
      hasStudentQrData: Boolean(qrData?.qrLink && qrData?.phone),
      studentQrDataActive: qrData?.isActive ?? false,
    };
  });
}

async function updateStudentQrPhone(models, student, phone) {
  if (phone === undefined) return;
  const qrData = await models.StudentQrData.findOne({ email: student.email.toLowerCase() });
  if (!qrData) throw new HttpError(404, 'Student QR data is not available for this student');
  const normalizedPhone = String(phone || '').trim();
  if (!/^[+0-9 ()-]{7,30}$/.test(normalizedPhone)) throw new HttpError(400, 'Enter a valid student phone number');
  qrData.phone = normalizedPhone;
  qrData.phoneKey = toMsg91Mobile(normalizedPhone);
  try {
    await qrData.save();
  } catch (error) {
    if (error?.code === 11000) throw new HttpError(409, 'Phone number already exists in QR login data');
    throw error;
  }
}

function duplicateMessage(error) {
  const field = Object.keys(error.keyPattern || {})[0];
  if (field === 'studentId') return 'Student ID already exists';
  if (field === 'email') return 'Student email already exists';
  return 'Student record already exists';
}

export async function listStudents(req, res) {
  const models = getRequestModels(req);
  const { Student } = models;
  const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(10, Number.parseInt(req.query.limit, 10) || 25));
  const query = studentFilterFromRequest(req);

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
    students: await attachQrPhone(models, students.map((student) => ({
      ...student,
      groupCoordinatorId: student.groupCoordinatorId || (student.groupCoordinatorName ? {
        name: student.groupCoordinatorName,
        mobile: student.groupCoordinatorMobile,
      } : null),
    }))),
    options: { requireGroupDetails: await requireGroupDetails(req) },
    pagination: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) },
  });
}

export async function getStudent(req, res) {
  const models = getRequestModels(req);
  const { Student } = models;
  if (!mongoose.isValidObjectId(req.params.studentId)) throw new HttpError(400, 'Invalid student ID');
  const student = await Student.findById(req.params.studentId)
    .populate('groupIds', 'name code whatsappLink')
    .populate('groupCoordinatorId', 'name mobile email')
    .select('-qrTokenHash -qrTokenEncrypted')
    .lean();
  if (!student) throw new HttpError(404, 'Student not found');
  const [withQrPhone] = await attachQrPhone(models, [student]);
  res.json({ student: withQrPhone });
}

export async function createStudent(req, res) {
  const { Group, Student } = getRequestModels(req);
  const parsed = studentInputSchema.safeParse(req.body);
  if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message || 'Invalid student details');
  const needsGroupDetails = await requireGroupDetails(req);
  assertStudentDetails(parsed.data, needsGroupDetails);
  const { ids } = await resolveGroups(Group, parsed.data.groupIds || []);
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
  const models = getRequestModels(req);
  const { Group, Student } = models;
  if (!mongoose.isValidObjectId(req.params.studentId)) throw new HttpError(400, 'Invalid student ID');
  const parsed = studentInputSchema.safeParse(req.body);
  if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message || 'Invalid student details');
  const needsGroupDetails = await requireGroupDetails(req);
  assertStudentDetails(parsed.data, needsGroupDetails);
  const { ids } = await resolveGroups(Group, parsed.data.groupIds || []);
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
    await updateStudentQrPhone(models, student, req.body?.qrDataPhone);
    res.json({ student });
  } catch (error) {
    if (error?.code === 11000) throw new HttpError(409, duplicateMessage(error));
    throw error;
  }
}

export async function deactivateStudent(req, res) {
  const { Student } = getRequestModels(req);
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
  const { Student } = getRequestModels(req);
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
