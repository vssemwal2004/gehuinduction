import mongoose from 'mongoose';
import { zipSync, strToU8 } from 'fflate';
import ImportJob from '../models/ImportJob.js';
import Student from '../models/Student.js';
import { createQrToken, decryptQrToken, hashQrToken } from '../services/qrTokenService.js';
import { createStudentQrCard, createStudentQrImage, createStudentQrTemplateSvg } from '../services/qrCardService.js';
import { validateStudentImport } from '../services/studentImportService.js';
import { createSimpleXlsx, createXlsxWithImages } from '../utils/xlsx.js';
import { HttpError } from '../utils/httpError.js';
import { studentFilterFromRequest } from '../utils/studentFilters.js';

const TEMPLATE_ROWS = [
  ['Student Name', 'Student ID', 'Email', 'Group Code', 'Group Coordinator Name', 'Group Coordinator Mobile'],
  ['Example Student', 'GEU2026001', 'student@example.com', 'G1', 'Coordinator Name', '+91 9999999999'],
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

function filteredExportName(prefix, req) {
  const groupId = String(req.query.groupId || '').trim();
  const addedDate = String(req.query.addedDate || '').trim();
  const importId = String(req.query.importId || '').trim();
  if (importId) return `${prefix}-batch-${safeFileName(importId)}`;
  if (addedDate) return `${prefix}-${safeFileName(addedDate)}`;
  return groupId ? `${prefix}-group-${safeFileName(groupId)}` : prefix;
}

function groupCodes(student) {
  return Array.isArray(student.groupIds)
    ? student.groupIds.map((group) => group?.code).filter(Boolean).join(', ')
    : '';
}

function publicQrUrl(tokenHash) {
  return `${QR_LINK_BASE}${encodeURIComponent(String(tokenHash).trim().toLowerCase())}`;
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
      groupCoordinatorName: row.groupCoordinatorName,
      groupCoordinatorMobile: row.groupCoordinatorMobile,
      qrTokenHash: qr.tokenHash,
      qrTokenEncrypted: qr.tokenEncrypted,
    };
  });

  const session = await mongoose.startSession();
  let job;
  try {
    await session.withTransaction(async () => {
      [job] = await ImportJob.create([{
        fileName: req.file.originalname,
        requestedBy: req.user._id,
        status: 'completed',
        totalRows: result.total,
        importedRows: result.total,
      }], { session });
      await Student.insertMany(documents.map((document) => ({ ...document, importJobId: job._id })), { ordered: true, session });
    });
  } catch (error) {
    throw new HttpError(error?.code === 11000 ? 409 : 500, error?.code === 11000 ? 'A student was added by another request. Preview the file again.' : 'Student import failed');
  } finally {
    await session.endSession();
  }
  res.status(201).json({ imported: result.total, importId: job._id });
}

export async function listImportHistory(_req, res) {
  const jobs = await ImportJob.find({ status: 'completed' }).populate('requestedBy', 'name email').sort({ createdAt: -1 }).limit(100).lean();
  const linkedCounts = await Student.aggregate([
    { $match: { importJobId: { $in: jobs.map((job) => job._id) } } },
    { $group: { _id: '$importJobId', count: { $sum: 1 } } },
  ]);
  const counts = new Map(linkedCounts.map((item) => [String(item._id), item.count]));
  res.json({ imports: jobs.map((job) => ({ ...job, linkedStudents: counts.get(String(job._id)) || 0 })) });
}

export async function exportStudentsExcel(req, res) {
  const students = await Student.find(studentFilterFromRequest(req))
    .select('+qrTokenEncrypted +qrTokenHash name studentId email groupIds groupCoordinatorName groupCoordinatorMobile groupCoordinatorId registrationStatus qrGeneratedAt qrRevokedAt lastScannedAt scanCount isActive createdAt updatedAt')
    .populate('groupIds', 'name code whatsappLink')
    .populate('groupCoordinatorId', 'name mobile email')
    .sort({ studentId: 1 })
    .lean();
  if (!students.length) throw new HttpError(404, 'No students found for this export');

  const rows = [
    [
      'Student Name',
      'Student ID',
      'Email',
      'Groups',
      'Group Coordinator',
      'Coordinator Mobile',
      'Registration Status',
      'Active',
      'Scan Count',
      'Last Scanned At',
      'QR Generated At',
      'QR Revoked At',
      'Created At',
      'Updated At',
      'QR Link',
      'QR Image',
    ],
  ];
  const imagesByRow = new Map();
  for (const student of students) {
    const canExportQr = student.isActive && !student.qrRevokedAt;
    let qrLink = 'Inactive';
    if (canExportQr) {
      const qr = await ensureQrData(student);
      qrLink = publicQrUrl(qr.tokenHash);
      const rowIndex = rows.length;
      imagesByRow.set(rowIndex, { name: `${qr.tokenHash}.png`, buffer: createStudentQrImage(qr.token) });
    }
    rows.push([
      student.name,
      student.studentId,
      student.email,
      groupCodes(student),
      student.groupCoordinatorName || student.groupCoordinatorId?.name || '',
      student.groupCoordinatorMobile || student.groupCoordinatorId?.mobile || '',
      student.registrationStatus,
      student.isActive ? 'Yes' : 'No',
      student.scanCount || 0,
      student.lastScannedAt ? new Date(student.lastScannedAt).toISOString() : '',
      student.qrGeneratedAt ? new Date(student.qrGeneratedAt).toISOString() : '',
      student.qrRevokedAt ? new Date(student.qrRevokedAt).toISOString() : '',
      student.createdAt ? new Date(student.createdAt).toISOString() : '',
      student.updatedAt ? new Date(student.updatedAt).toISOString() : '',
      qrLink,
      canExportQr ? 'QR image' : 'Inactive',
    ]);
  }

  const workbook = createXlsxWithImages(rows, imagesByRow, 'Students');
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filteredExportName('geu-induction-students', req)}.xlsx"`);
  res.send(workbook);
}

export async function downloadQrPackage(req, res) {
  const students = await Student.find({ ...studentFilterFromRequest(req), isActive: true, qrRevokedAt: { $exists: false } })
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
      const fileName = `${safeFileName(student.studentId)}.svg`;
      const image = await createStudentQrTemplateSvg(qr.token);
      return { student, fileName, image, tokenHash: qr.tokenHash };
    }));
    generated.forEach(({ student, fileName, image, tokenHash }) => {
      files[`qr-codes/${fileName}`] = strToU8(image);
      mappingRows.push([student.studentId, student.name, student.email, groupCodes(student), publicQrUrl(tokenHash), fileName]);
    });
  }
  files['students.xlsx'] = new Uint8Array(createSimpleXlsx(mappingRows, 'QR Mapping'));
  files['README.txt'] = strToU8('GEU Induction Programme 2026\nEach student-ID-named SVG is a self-contained card with the compressed poster template and a sharply aligned vector QR. No external asset folder is required. SVG cards open in modern browsers and print at any size without losing QR quality. QR images contain secure opaque tokens only; student data is resolved by the authenticated scan coordinator application.');
  const archive = Buffer.from(zipSync(files, { level: 6 }));
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="${filteredExportName('geu-induction-qr-package', req)}-${Date.now()}.zip"`);
  res.send(archive);
}

export async function openPublicStudentQr(req, res) {
  const tokenHash = String(req.params.tokenHash || '').trim().toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(tokenHash)) throw new HttpError(404, 'QR card not found');
  const student = await Student.findOne({ qrTokenHash: tokenHash, isActive: true, qrRevokedAt: { $exists: false } })
    .select('+qrTokenEncrypted')
    .lean();
  if (!student) throw new HttpError(404, 'QR card not found');
  const token = decryptQrToken(student.qrTokenEncrypted);
  const image = await createStudentQrTemplateSvg(token);
  res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
  res.setHeader('Content-Disposition', 'inline');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.send(image);
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
