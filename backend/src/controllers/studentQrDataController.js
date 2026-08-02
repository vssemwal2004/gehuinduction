import mongoose from 'mongoose';
import { z } from 'zod';
import StudentQrData from '../models/StudentQrData.js';
import { toMsg91Mobile } from '../services/msg91OtpService.js';
import { createSimpleXlsx } from '../utils/xlsx.js';
import { HttpError } from '../utils/httpError.js';
import { validateStudentQrDataImport } from '../services/studentQrDataImportService.js';

const TEMPLATE_ROWS = [
  ['Student Name', 'Email', 'Phone Number', 'QR Link'],
  ['Example Student', 'student@example.com', '+91 9999999999', 'https://example.com/student-qr.png'],
];

const qrDataSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(180),
  phone: z.string().trim().min(7).max(30).regex(/^[+0-9 ()-]+$/, 'Enter a valid phone number'),
  qrLink: z.string().trim().url('Enter a valid QR link').max(1000),
});

function duplicateMessage(error) {
  const field = Object.keys(error.keyPattern || {})[0];
  if (field === 'email') return 'Email already exists';
  if (field === 'phone' || field === 'phoneKey') return 'Phone number already exists';
  return 'QR data already exists';
}

export async function listStudentQrData(req, res) {
  const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(10, Number.parseInt(req.query.limit, 10) || 25));
  const search = String(req.query.search || '').trim();
  const query = search ? { $text: { $search: search } } : {};

  const [items, total] = await Promise.all([
    StudentQrData.find(query).sort({ createdAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    StudentQrData.countDocuments(query),
  ]);
  res.json({ items, pagination: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) } });
}

export async function createStudentQrData(req, res) {
  const parsed = qrDataSchema.safeParse(req.body);
  if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message || 'Invalid QR data');
  try {
    const item = await StudentQrData.create({ ...parsed.data, email: parsed.data.email.toLowerCase(), phoneKey: toMsg91Mobile(parsed.data.phone) });
    res.status(201).json({ item });
  } catch (error) {
    if (error?.code === 11000) throw new HttpError(409, duplicateMessage(error));
    throw error;
  }
}

export async function updateStudentQrData(req, res) {
  if (!mongoose.isValidObjectId(req.params.qrDataId)) throw new HttpError(400, 'Invalid QR data ID');
  const parsed = qrDataSchema.safeParse(req.body);
  if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message || 'Invalid QR data');
  try {
    const item = await StudentQrData.findByIdAndUpdate(req.params.qrDataId, { ...parsed.data, email: parsed.data.email.toLowerCase(), phoneKey: toMsg91Mobile(parsed.data.phone) }, { new: true, runValidators: true });
    if (!item) throw new HttpError(404, 'QR data not found');
    res.json({ item });
  } catch (error) {
    if (error?.code === 11000) throw new HttpError(409, duplicateMessage(error));
    throw error;
  }
}

export async function deleteStudentQrData(req, res) {
  if (!mongoose.isValidObjectId(req.params.qrDataId)) throw new HttpError(400, 'Invalid QR data ID');
  const item = await StudentQrData.findByIdAndDelete(req.params.qrDataId).select('_id').lean();
  if (!item) throw new HttpError(404, 'QR data not found');
  res.status(204).end();
}

export function downloadStudentQrDataTemplate(_req, res) {
  const workbook = createSimpleXlsx(TEMPLATE_ROWS, 'Student QR Data');
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="student-qr-data-template.xlsx"');
  res.send(workbook);
}

export async function previewStudentQrDataImport(req, res) {
  try {
    res.json(await validateStudentQrDataImport(req.file));
  } catch (error) {
    throw new HttpError(400, error.message);
  }
}

export async function commitStudentQrDataImport(req, res) {
  let result;
  try {
    result = await validateStudentQrDataImport(req.file);
  } catch (error) {
    throw new HttpError(400, error.message);
  }
  if (result.errorCount) throw new HttpError(400, `Import has ${result.errorCount} invalid row${result.errorCount === 1 ? '' : 's'}. Correct them before importing.`);
  try {
    await StudentQrData.insertMany(result.rows.map((row) => ({
      name: row.name,
      email: row.email,
      phone: row.phone,
      phoneKey: row.phoneKey,
      qrLink: row.qrLink,
    })), { ordered: true });
  } catch (error) {
    if (error?.code === 11000) throw new HttpError(409, 'A QR data row was added by another request. Preview the file again.');
    throw error;
  }
  res.status(201).json({ imported: result.total });
}

export async function exportStudentQrData(req, res) {
  const search = String(req.query.search || '').trim();
  const query = search ? { $text: { $search: search } } : {};
  const items = await StudentQrData.find(query).sort({ name: 1 }).lean();
  if (!items.length) throw new HttpError(404, 'No student QR data found for this export');
  const rows = [['Student Name', 'Email', 'Phone Number', 'QR Link'], ...items.map((item) => [item.name, item.email, item.phone, item.qrLink])];
  const workbook = createSimpleXlsx(rows, 'Student QR Data');
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="student-qr-data.xlsx"');
  res.send(workbook);
}
