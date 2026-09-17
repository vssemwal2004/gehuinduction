import { z } from 'zod';
import { getActiveDatabaseContexts } from '../config/database.js';
import { HttpError } from '../utils/httpError.js';

const loginSchema = z.object({ mobile: z.string().trim().min(7).max(30) });
const normalizeMobile = (value) => String(value).replace(/\D/g, '').replace(/^91(?=\d{10}$)/, '');

export async function loginStudent(req, res) {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message || 'Enter a valid mobile number');
  const matches = [];
  for (const context of getActiveDatabaseContexts()) {
    const candidates = await context.models.Student.find({ isActive: true, qrRevokedAt: { $exists: false } }).select('+qrTokenHash name studentId mobile semester qrLink').lean();
    matches.push(...candidates.filter((candidate) => normalizeMobile(candidate.mobile) === normalizeMobile(parsed.data.mobile)));
  }
  if (!matches.length) throw new HttpError(404, 'This mobile number is not registered');
  if (matches.length > 1) throw new HttpError(409, 'More than one student uses this mobile number. Please contact the administrator.');
  const [student] = matches;
  if (!student.qrLink) throw new HttpError(404, 'Your gate pass is not uploaded yet. Please contact the administrator.');
  res.json({ student: { id: student._id, name: student.name, studentId: student.studentId, mobile: student.mobile, semester: student.semester, qrLink: student.qrLink } });
}
