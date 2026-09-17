import mongoose from 'mongoose';
import crypto from 'node:crypto';
import { zipSync, strToU8 } from 'fflate';
import { getActiveDatabaseContexts, getDatabaseContext, getRequestModels } from '../config/database.js';
import { createQrToken, decryptQrToken, hashQrToken } from '../services/qrTokenService.js';
import {
  createStudentQrCard,
  createCompactStudentQrCardJpeg,
  createStudentQrImage,
  createStudentQrTemplateSvg,
} from '../services/qrCardService.js';
import { validateStudentImport } from '../services/studentImportService.js';
import { createSimpleXlsx, createXlsxWithImages } from '../utils/xlsx.js';
import { HttpError } from '../utils/httpError.js';
import { studentFilterFromRequest } from '../utils/studentFilters.js';

const STUDENT_TEMPLATE_ROWS = [
  ['Student Name', 'Student ID', 'Student Mobile', 'Semester'],
  ['Example Student', 'GEU2026001', '+91 9999999999', '1'],
];
const QR_LINK_BASE = 'https://files.geu.ac.in/induction/btech12/';

function safeFileName(value) {
  return String(value).replace(/[^A-Za-z0-9_-]+/g, '_').slice(0, 80);
}

async function ensureQrToken(Student, student) {
  return (await ensureQrData(Student, student)).token;
}

async function ensureQrData(Student, student) {
  if (student.qrTokenEncrypted) {
    try {
      const token = decryptQrToken(student.qrTokenEncrypted);
      const tokenHash = student.qrTokenHash || hashQrToken(token);
      if (!student.qrTokenHash) await Student.updateOne({ _id: student._id }, { qrTokenHash: tokenHash });
      return { token, tokenHash };
    } catch (error) {
      console.warn(`Regenerating unreadable QR token for student ${student._id}: ${error.message}`);
    }
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

export async function downloadStudentTemplate(_req, res) {
  const workbook = createSimpleXlsx(STUDENT_TEMPLATE_ROWS, 'Student Import');
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="geu-student-import-template.xlsx"');
  res.send(workbook);
}

export async function previewStudentImport(req, res) {
  try {
    const result = await validateStudentImport(req.file, getRequestModels(req));
    res.json(result);
  } catch (error) {
    throw new HttpError(400, error.message);
  }
}

export async function commitStudentImport(req, res) {
  const { ImportJob, Student } = getRequestModels(req);
  let result;
  try {
    result = await validateStudentImport(req.file, getRequestModels(req));
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
      mobile: row.mobile,
      semester: row.semester,
      qrTokenHash: qr.tokenHash,
      qrTokenEncrypted: qr.tokenEncrypted,
    };
  });

  const session = await getDatabaseContext(req.dbKey).connection.startSession();
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

export async function listImportHistory(req, res) {
  const { ImportJob, Student } = getRequestModels(req);
  const jobs = await ImportJob.find({ status: 'completed' }).populate('requestedBy', 'name email').sort({ createdAt: -1 }).limit(100).lean();
  const linkedCounts = await Student.aggregate([
    { $match: { importJobId: { $in: jobs.map((job) => job._id) } } },
    { $group: { _id: '$importJobId', count: { $sum: 1 } } },
  ]);
  const counts = new Map(linkedCounts.map((item) => [String(item._id), item.count]));
  res.json({ imports: jobs.map((job) => ({ ...job, linkedStudents: counts.get(String(job._id)) || 0 })) });
}

export async function exportStudentsExcel(req, res) {
  const { Student } = getRequestModels(req);
  const students = await Student.find(studentFilterFromRequest(req))
    .select('+qrTokenEncrypted +qrTokenHash name studentId mobile semester registrationStatus qrGeneratedAt qrRevokedAt lastScannedAt scanCount isActive createdAt updatedAt')
    .sort({ studentId: 1 })
    .lean();
  if (!students.length) throw new HttpError(404, 'No students found for this export');

  const rows = [
    [
      'Student Name',
      'Student ID',
      'Mobile',
      'Semester',
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
      const qr = await ensureQrData(Student, student);
      qrLink = publicQrUrl(qr.tokenHash);
      const rowIndex = rows.length;
      imagesByRow.set(rowIndex, { name: `${qr.tokenHash}.png`, buffer: createStudentQrImage(qr.token) });
    }
    rows.push([
      student.name,
      student.studentId,
      student.mobile,
      student.semester,
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

const qrPackageJobs = new Map();
const jobForRequest = (req) => {
  const job = qrPackageJobs.get(String(req.params.jobId));
  if (!job || job.owner !== String(req.user._id)) throw new HttpError(404, 'QR package job not found');
  return job;
};

async function buildQrArchive(Student, filter, updateProgress) {
  const students = await Student.find({ ...filter, isActive: true, qrRevokedAt: { $exists: false } })
    .select('+qrTokenEncrypted +qrTokenHash name studentId mobile semester registrationStatus')
    .sort({ studentId: 1 })
    .lean();
  if (!students.length) throw new HttpError(404, 'No active student QR codes are available');
  const files = {};
  const mappingRows = [['Student ID', 'Student Name', 'Mobile', 'Semester', 'QR File Name', 'QR Link']];
  const batchSize = 8;
  for (let index = 0; index < students.length; index += batchSize) {
    const batch = students.slice(index, index + batchSize);
    const generated = await Promise.all(batch.map(async (student) => {
      const qr = await ensureQrData(Student, student);
      const randomName = crypto.randomBytes(12).toString('hex');
      const fileName = `${randomName}.jpg`;
      const image = await createCompactStudentQrCardJpeg(qr.token);
      const qrLink = `${QR_LINK_BASE}${fileName}`;
      await Student.updateOne({ _id: student._id }, { qrFileName: fileName });
      return { student, fileName, image, qrLink };
    }));
    generated.forEach(({ student, fileName, image, qrLink }) => {
      files[`qr-codes/${fileName}`] = new Uint8Array(image);
      mappingRows.push([student.studentId, student.name, student.mobile, student.semester, fileName, qrLink]);
    });
    updateProgress(Math.min(94, Math.round(((index + generated.length) / students.length) * 94)), students.length);
    await new Promise((resolve) => setImmediate(resolve));
  }
  files['students.xlsx'] = new Uint8Array(createSimpleXlsx(mappingRows, 'QR Mapping'));
  files['README.txt'] = strToU8('GEHU Freshers Gate Entry 2026\nEach JPG is a compact complete gate pass with a secure one-time-entry QR. Upload every JPG from qr-codes/ to https://files.geu.ac.in/induction/btech12/ without renaming it, then upload students.xlsx in Student Data Upload.');
  updateProgress(96, students.length);
  const archive = Buffer.from(zipSync(files, { level: 1 }));
  return { archive, count: students.length };
}

export async function startQrPackageJob(req, res) {
  const { Student } = getRequestModels(req);
  const jobId = crypto.randomUUID();
  const job = { owner: String(req.user._id), status: 'processing', percent: 0, count: 0, archive: null, error: '', createdAt: Date.now() };
  qrPackageJobs.set(jobId, job);
  const filter = studentFilterFromRequest(req);
  setImmediate(async () => {
    try {
      const result = await buildQrArchive(Student, filter, (percent, count) => Object.assign(job, { percent, count }));
      Object.assign(job, { archive: result.archive, count: result.count, percent: 100, status: 'ready' });
    } catch (error) {
      Object.assign(job, { status: 'failed', error: error.message || 'QR package generation failed' });
    }
  });
  res.status(202).json({ jobId });
}

export function getQrPackageJob(req, res) {
  const job = jobForRequest(req);
  res.json({ status: job.status, percent: job.percent, count: job.count, error: job.error });
}

export function downloadQrPackageJob(req, res) {
  const job = jobForRequest(req);
  if (job.status !== 'ready' || !job.archive) throw new HttpError(409, 'QR package is not ready');
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="gehu-gate-pass-package-${job.count}-${Date.now()}.zip"`);
  res.setHeader('Content-Length', job.archive.length);
  res.send(job.archive);
  qrPackageJobs.delete(String(req.params.jobId));
}

setInterval(() => { const cutoff = Date.now() - 30 * 60_000; for (const [id, job] of qrPackageJobs) if (job.createdAt < cutoff) qrPackageJobs.delete(id); }, 10 * 60_000).unref();

export async function openPublicStudentQr(req, res) {
  const tokenHash = String(req.params.tokenHash || '').trim().toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(tokenHash)) throw new HttpError(404, 'QR card not found');
  let student;
  for (const context of getActiveDatabaseContexts()) {
    student = await context.models.Student.findOne({ qrTokenHash: tokenHash, isActive: true, qrRevokedAt: { $exists: false } })
      .select('+qrTokenEncrypted')
      .lean();
    if (student) break;
  }
  if (!student) throw new HttpError(404, 'QR card not found');
  const token = decryptQrToken(student.qrTokenEncrypted);
  const image = await createStudentQrTemplateSvg(token);
  res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
  res.setHeader('Content-Disposition', 'inline');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.send(image);
}

export async function downloadStudentQr(req, res) {
  const { Student } = getRequestModels(req);
  if (!mongoose.isValidObjectId(req.params.studentId)) throw new HttpError(400, 'Invalid student ID');
  const student = await Student.findById(req.params.studentId)
    .select('+qrTokenEncrypted +qrTokenHash name studentId isActive qrRevokedAt')
    .lean();
  if (!student) throw new HttpError(404, 'Student not found');
  if (!student.isActive || student.qrRevokedAt) throw new HttpError(400, 'QR is unavailable for inactive students');

  const token = await ensureQrToken(Student, student);
  const image = await createStudentQrCard(token);
  res.setHeader('Content-Type', 'image/png');
  res.setHeader('Content-Disposition', `attachment; filename="${safeFileName(student.studentId)}_${safeFileName(student.name)}.png"`);
  res.send(image);
}
