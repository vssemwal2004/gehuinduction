import QRCode from 'qrcode';
import mongoose from 'mongoose';
import { zipSync, strToU8 } from 'fflate';
import ImportJob from '../models/ImportJob.js';
import Student from '../models/Student.js';
import { createQrToken, decryptQrToken, hashQrToken } from '../services/qrTokenService.js';
import { createStudentQrCard } from '../services/qrCardService.js';
import { validateStudentImport } from '../services/studentImportService.js';
import { createSimpleXlsx, createXlsxWithImages } from '../utils/xlsx.js';
import { HttpError } from '../utils/httpError.js';

const TEMPLATE_ROWS = [
  ['Student Name', 'Student ID', 'Email', 'Group Code'],
  ['Example Student', 'GEU2026001', 'student@example.com', 'G1'],
];
const QR_LINK_BASE = 'https://files.geu.ac.in/induction/btech/';

function safeFileName(value) {
  return String(value).replace(/[^A-Za-z0-9_-]+/g, '_').slice(0, 80);
}

async function ensureQrToken(student) {
  return (await ensureQrData(student)).token;
}

async function ensureQrData(student) {
  if (student.qrTokenEncrypted) {
    const token = decryptQrToken(student.qrTokenEncrypted);
    const tokenHash = student.qrTokenHash || hashQrToken(token);
    if (!student.qrTokenHash) await Student.updateOne({ _id: student._id }, { qrTokenHash: tokenHash });
    return { token, tokenHash };
  }
  const qr = createQrToken();
  await Student.updateOne({ _id: student._id }, { qrTokenHash: qr.tokenHash, qrTokenEncrypted: qr.tokenEncrypted, qrGeneratedAt: new Date() });
  return { token: qr.token, tokenHash: qr.tokenHash };
}

function groupFilterFromRequest(req) {
  const groupId = String(req.query.groupId || '').trim();
  if (!groupId) return {};
  if (!mongoose.isValidObjectId(groupId)) throw new HttpError(400, 'Invalid group ID');
  return { groupIds: groupId };
}

function filteredExportName(prefix, req) {
  const groupId = String(req.query.groupId || '').trim();
  return groupId ? `${prefix}-group-${safeFileName(groupId)}` : prefix;
}

export function downloadStudentTemplate(_req, res) {
  const workbook = createSimpleXlsx(TEMPLATE_ROWS, 'Student Import');
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="geu-student-import-template.xlsx"');
  res.send(workbook);
}

export async function previewStudentImport(req, res) {
  try {
    const result = await validateStudentImport(req.file);
    res.json(result);
  } catch (error) {
    throw new HttpError(400, error.message);
  }
}

export async function commitStudentImport(req, res) {
  let result;
  try {
    result = await validateStudentImport(req.file);
  } catch (error) {
    throw new HttpError(400, error.message);
  }
  if (result.errorCount) {
    await ImportJob.create({
      fileName: req.file.originalname,
      requestedBy: req.user._id,
      status: 'rejected',
      totalRows: result.total,
      errorRows: result.errorCount,
      validationErrors: result.rows.filter((row) => !row.valid).slice(0, 500).map((row) => ({ row: row.row, messages: row.errors })),
    });
    throw new HttpError(400, `Import has ${result.errorCount} invalid row${result.errorCount === 1 ? '' : 's'}. Correct them before importing.`);
  }

  const documents = result.rows.map((row) => {
    const qr = createQrToken();
    return {
      name: row.name,
      studentId: row.studentId,
      email: row.email,
      groupIds: [row.groupId],
      groupCoordinatorId: row.coordinatorId,
      qrTokenHash: qr.tokenHash,
      qrTokenEncrypted: qr.tokenEncrypted,
    };
  });

  const session = await mongoose.startSession();
  let job;
  try {
    await session.withTransaction(async () => {
      await Student.insertMany(documents, { ordered: true, session });
      [job] = await ImportJob.create([{
        fileName: req.file.originalname,
        requestedBy: req.user._id,
        status: 'completed',
        totalRows: result.total,
        importedRows: result.total,
      }], { session });
    });
  } catch (error) {
    throw new HttpError(error?.code === 11000 ? 409 : 500, error?.code === 11000 ? 'A student was added by another request. Preview the file again.' : 'Student import failed');
  } finally {
    await session.endSession();
  }
  res.status(201).json({ imported: result.total, importId: job._id });
}

export async function listImportHistory(_req, res) {
  const jobs = await ImportJob.find().populate('requestedBy', 'name email').sort({ createdAt: -1 }).limit(50).lean();
  res.json({ imports: jobs });
}

export async function exportStudentsExcel(req, res) {
  const students = await Student.find(groupFilterFromRequest(req))
    .select('+qrTokenEncrypted +qrTokenHash name studentId email groupIds groupCoordinatorId registrationStatus qrGeneratedAt qrRevokedAt lastScannedAt scanCount isActive createdAt updatedAt')
    .populate('groupIds', 'name code whatsappLink')
    .populate('groupCoordinatorId', 'name mobile email')
    .sort({ studentId: 1 })
    .lean();
  if (!students.length) throw new HttpError(404, 'No students found for this export');

  const rows = [
    ['Student Name', 'Student ID', 'Email', 'Group Codes', 'Group Names', 'WhatsApp Links', 'Coordinator', 'Coordinator Mobile', 'Coordinator Email', 'Registration Status', 'Active', 'Scan Count', 'Last Scan', 'QR Generated At', 'QR Revoked At', 'Created At', 'Updated At', 'QR Link', 'QR Code'],
  ];
  const imagesByRow = new Map();
  const qrLinksByRow = new Map();
  const batchSize = 20;
  for (let index = 0; index < students.length; index += batchSize) {
    const batch = students.slice(index, index + batchSize);
    const generated = await Promise.all(batch.map(async (student, batchIndex) => {
      if (!student.isActive || student.qrRevokedAt) return null;
      const qr = await ensureQrData(student);
      const image = await QRCode.toBuffer(`GEUQR1:${qr.token}`, { type: 'png', errorCorrectionLevel: 'M', width: 240, margin: 1 });
      return { rowIndex: index + batchIndex + 1, image, link: `${QR_LINK_BASE}${qr.tokenHash}` };
    }));
    generated.forEach((item) => {
      if (item) {
        imagesByRow.set(item.rowIndex, { name: `qr-${item.rowIndex}.png`, buffer: item.image });
        qrLinksByRow.set(item.rowIndex, item.link);
      }
    });
  }

  students.forEach((student, index) => {
    const rowIndex = index + 1;
    const groups = student.groupIds || [];
    rows.push([
      student.name,
      student.studentId,
      student.email,
      groups.map((group) => group.code).join(', '),
      groups.map((group) => group.name).join(', '),
      groups.map((group) => group.whatsappLink).filter(Boolean).join(', '),
      student.groupCoordinatorId?.name || '',
      student.groupCoordinatorId?.mobile || '',
      student.groupCoordinatorId?.email || '',
      student.registrationStatus,
      student.isActive ? 'Yes' : 'No',
      student.scanCount || 0,
      student.lastScannedAt ? new Date(student.lastScannedAt).toISOString() : '',
      student.qrGeneratedAt ? new Date(student.qrGeneratedAt).toISOString() : '',
      student.qrRevokedAt ? new Date(student.qrRevokedAt).toISOString() : '',
      student.createdAt ? new Date(student.createdAt).toISOString() : '',
      student.updatedAt ? new Date(student.updatedAt).toISOString() : '',
      student.isActive && !student.qrRevokedAt ? qrLinksByRow.get(rowIndex) || '' : 'Inactive',
      student.isActive && !student.qrRevokedAt ? 'QR image' : 'Inactive',
    ]);
  });

  const workbook = createXlsxWithImages(rows, imagesByRow, 'Students');
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filteredExportName('geu-induction-students', req)}.xlsx"`);
  res.send(workbook);
}

export async function downloadQrPackage(req, res) {
  const students = await Student.find({ ...groupFilterFromRequest(req), isActive: true, qrRevokedAt: { $exists: false } })
    .select('+qrTokenEncrypted +qrTokenHash name studentId email registrationStatus')
    .populate('groupIds', 'name code')
    .sort({ studentId: 1 })
    .lean();
  if (!students.length) throw new HttpError(404, 'No active student QR codes are available');

  const files = {};
  const mappingRows = [['Student ID', 'Student Name', 'Email', 'Group', 'QR Link', 'QR File Name']];
  const batchSize = 20;
  for (let index = 0; index < students.length; index += batchSize) {
    const batch = students.slice(index, index + batchSize);
    const generated = await Promise.all(batch.map(async (student) => {
      const qr = await ensureQrData(student);
      const fileName = `${qr.tokenHash}.png`;
      const image = await createStudentQrCard(qr.token);
      return { student, fileName, image };
    }));
    generated.forEach(({ student, fileName, image }) => {
      files[`qr-codes/${fileName}`] = new Uint8Array(image);
      mappingRows.push([student.studentId, student.name, student.email, student.groupIds.map((group) => group.code).join(', '), `${QR_LINK_BASE}${fileName.replace(/\.png$/, '')}`, fileName]);
    });
  }
  files['students.xlsx'] = new Uint8Array(createSimpleXlsx(mappingRows, 'QR Mapping'));
  files['README.txt'] = strToU8('GEU Induction Programme 2026\nQR images contain secure opaque tokens only. Student data is resolved by the authenticated scan coordinator application.');
  const archive = Buffer.from(zipSync(files, { level: 6 }));
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="${filteredExportName('geu-induction-qr-package', req)}-${Date.now()}.zip"`);
  res.send(archive);
}

export async function downloadStudentQr(req, res) {
  if (!mongoose.isValidObjectId(req.params.studentId)) throw new HttpError(400, 'Invalid student ID');
  const student = await Student.findById(req.params.studentId)
    .select('+qrTokenEncrypted +qrTokenHash name studentId isActive qrRevokedAt')
    .lean();
  if (!student) throw new HttpError(404, 'Student not found');
  if (!student.isActive || student.qrRevokedAt) throw new HttpError(400, 'QR is unavailable for inactive students');

  const token = await ensureQrToken(student);
  const image = await createStudentQrCard(token);
  res.setHeader('Content-Type', 'image/png');
  res.setHeader('Content-Disposition', `attachment; filename="${safeFileName(student.studentId)}_${safeFileName(student.name)}.png"`);
  res.send(image);
}
