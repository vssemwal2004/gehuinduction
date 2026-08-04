import mongoose from 'mongoose';
import { getRequestModels } from '../config/database.js';
import { hashQrToken } from '../services/qrTokenService.js';
import { HttpError } from '../utils/httpError.js';

function publicStudent(student) {
  const group = student.groupIds?.[0];
  return {
    id: student._id,
    name: student.name,
    studentId: student.studentId,
    email: student.email,
    group: group ? { name: group.name, code: group.code, whatsappLink: group.whatsappLink } : null,
    coordinator: student.groupCoordinatorName || student.groupCoordinatorId ? {
      name: student.groupCoordinatorName || student.groupCoordinatorId?.name,
      mobile: student.groupCoordinatorMobile || student.groupCoordinatorId?.mobile,
    } : null,
    registrationStatus: student.registrationStatus,
    scanCount: student.scanCount,
  };
}

async function populatedStudent(Student, id) {
  return Student.findById(id)
    .select('name studentId email groupIds groupCoordinatorName groupCoordinatorMobile groupCoordinatorId registrationStatus scanCount isActive')
    .populate('groupIds', 'name code whatsappLink')
    .populate('groupCoordinatorId', 'name mobile')
    .lean();
}

export async function scanQr(req, res) {
  const { MailJob, ScanEvent, Student } = getRequestModels(req);
  const payload = String(req.body?.payload || '').trim();
  if (!/^GEUQR1:[A-Za-z0-9_-]{40,60}$/.test(payload)) throw new HttpError(400, 'This is not a valid GEU Induction QR code');
  const token = payload.slice(7);
  const tokenHash = hashQrToken(token);
  const now = new Date();

  const firstScanStudent = await Student.findOneAndUpdate(
    { qrTokenHash: tokenHash, isActive: true, qrRevokedAt: { $exists: false }, registrationStatus: 'not_registered' },
    { $set: { registrationStatus: 'registered', lastScannedAt: now }, $inc: { scanCount: 1 } },
    { new: true },
  );

  let student = firstScanStudent;
  let firstScan = Boolean(firstScanStudent);
  if (!student) {
    student = await Student.findOneAndUpdate(
      { qrTokenHash: tokenHash, isActive: true, qrRevokedAt: { $exists: false } },
      { $set: { lastScannedAt: now }, $inc: { scanCount: 1 } },
      { new: true },
    );
  }
  if (!student) throw new HttpError(404, 'Student QR is invalid, inactive or revoked');

  const event = await ScanEvent.create({ studentId: student._id, scannedBy: req.user._id, isFirstScan: firstScan });
  if (firstScan) {
    await MailJob.create({ type: 'scan_details', to: student.email, studentId: student._id, requestedBy: req.user._id, scanEventId: event._id });
  }
  const details = await populatedStudent(Student, student._id);
  res.json({ student: publicStudent(details), firstScan, mailQueued: firstScan, scanEventId: event._id });
}

export async function sendScanMailAgain(req, res) {
  const { MailJob, ScanEvent, Student } = getRequestModels(req);
  if (!mongoose.isValidObjectId(req.params.studentId)) throw new HttpError(400, 'Invalid student ID');
  const student = await Student.findOne({ _id: req.params.studentId, isActive: true, registrationStatus: 'registered' }).select('email').lean();
  if (!student) throw new HttpError(404, 'Registered student not found');
  const scannedRecently = await ScanEvent.exists({
    studentId: student._id,
    scannedBy: req.user._id,
    createdAt: { $gte: new Date(Date.now() - 10 * 60_000) },
  });
  if (!scannedRecently) throw new HttpError(403, 'Scan this student QR before sending their email again');
  const recent = await MailJob.exists({ studentId: student._id, requestedBy: req.user._id, createdAt: { $gte: new Date(Date.now() - 30_000) } });
  if (recent) throw new HttpError(429, 'Please wait 30 seconds before sending again');
  await MailJob.create({ type: 'scan_details', to: student.email, studentId: student._id, requestedBy: req.user._id });
  res.status(202).json({ mailQueued: true });
}
