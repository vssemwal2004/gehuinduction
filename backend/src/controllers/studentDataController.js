import { parse } from 'csv-parse/sync';
import { getRequestModels } from '../config/database.js';
import { parseSimpleXlsx } from '../utils/xlsx.js';
import { HttpError } from '../utils/httpError.js';

const HEADERS = ['student id', 'student name', 'mobile', 'semester', 'qr file name', 'qr link'];
const ALLOWED_BASE = 'https://files.geu.ac.in/induction/btech12/';
const text = (value) => String(value ?? '').trim();
function rowsFromFile(file) {
  if (!file) throw new HttpError(400, 'Select the QR mapping Excel or CSV file');
  const rows = file.originalname.toLowerCase().endsWith('.csv') ? parse(file.buffer, { skipEmptyLines: true, relaxColumnCount: true }) : parseSimpleXlsx(file.buffer);
  const headers = (rows[0] || []).map((item) => text(item).toLowerCase());
  if (HEADERS.some((header, index) => headers[index] !== header)) throw new HttpError(400, `Required columns: ${HEADERS.join(', ')}`);
  return rows.slice(1).map((row, index) => ({ row: index + 2, studentId: text(row[0]), name: text(row[1]), mobile: text(row[2]), semester: text(row[3]), qrFileName: text(row[4]), qrLink: text(row[5]) }));
}

export async function getStudentDataStatus(req, res) {
  const { Student } = getRequestModels(req);
  const [total, linked, pending] = await Promise.all([Student.countDocuments({ isActive: true }), Student.countDocuments({ isActive: true, qrLink: { $regex: '^https://files\\.geu\\.ac\\.in/induction/btech12/' } }), Student.countDocuments({ isActive: true, $or: [{ qrLink: { $exists: false } }, { qrLink: '' }] })]);
  res.json({ total, linked, pending });
}

export async function uploadStudentData(req, res) {
  const { Student } = getRequestModels(req);
  const rows = rowsFromFile(req.file);
  if (!rows.length) throw new HttpError(400, 'The mapping file has no student rows');
  const ids = rows.map((row) => row.studentId);
  const students = await Student.find({ studentId: { $in: ids } }).select('studentId').lean();
  const known = new Set(students.map((student) => student.studentId));
  const errors = [];
  const seen = new Set();
  for (const row of rows) {
    if (!row.studentId || !known.has(row.studentId)) errors.push(`Row ${row.row}: student ID not found`);
    if (seen.has(row.studentId)) errors.push(`Row ${row.row}: duplicate student ID`);
    seen.add(row.studentId);
    if (!/^[A-Za-z0-9_-]+\.jpg$/i.test(row.qrFileName)) errors.push(`Row ${row.row}: invalid JPG file name`);
    if (row.qrLink !== `${ALLOWED_BASE}${row.qrFileName}`) errors.push(`Row ${row.row}: QR link must match its file name under ${ALLOWED_BASE}`);
  }
  if (errors.length) throw new HttpError(400, errors.slice(0, 20).join('; '));
  await Student.bulkWrite(rows.map((row) => ({ updateOne: { filter: { studentId: row.studentId }, update: { $set: { qrFileName: row.qrFileName, qrLink: row.qrLink } } } })), { ordered: true });
  res.json({ updated: rows.length });
}
