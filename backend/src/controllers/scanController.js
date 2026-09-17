import { getRequestModels } from '../config/database.js';
import { hashQrToken } from '../services/qrTokenService.js';
import { HttpError } from '../utils/httpError.js';

function publicStudent(student) {
  const group = student.groupIds?.[0];
  return {
    id: student._id,
    name: student.name,
    studentId: student.studentId,
    mobile: student.mobile,
    semester: student.semester,
  };
}

async function populatedStudent(Student, id) {
  return Student.findById(id)
    .select('name studentId mobile semester registrationStatus scanCount isActive')
    .lean();
}

export async function scanQr(req, res) {
  const { ScanEvent, Student } = getRequestModels(req);
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
  const details = await populatedStudent(Student, student._id);
  res.json({ student: publicStudent(details), firstScan, scanEventId: event._id });
}
