import QRCode from 'qrcode';
import mongoose from 'mongoose';
import { zipSync, strToU8 } from 'fflate';
import ImportJob from '../models/ImportJob.js';
import Student from '../models/Student.js';
import { createQrToken, decryptQrToken } from '../services/qrTokenService.js';
import { validateStudentImport } from '../services/studentImportService.js';
import { createSimpleXlsx } from '../utils/xlsx.js';
import { HttpError } from '../utils/httpError.js';

const TEMPLATE_ROWS = [
  ['Student Name', 'Student ID', 'Email', 'Group Code'],
  ['Example Student', 'GEU2026001', 'student@example.com', 'G1'],
];

function safeFileName(value) {
  return String(value).replace(/[^A-Za-z0-9_-]+/g, '_').slice(0, 80);
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

export async function exportStudentsExcel(_req, res) {
  const students = await Student.find().populate('groupIds', 'name code').populate('groupCoordinatorId', 'name mobile').sort({ studentId: 1 }).lean();
  const rows = [
    ['Student Name', 'Student ID', 'Email', 'Groups', 'Coordinator', 'Coordinator Mobile', 'Registration Status', 'QR File Name'],
    ...students.map((student) => [
      student.name,
      student.studentId,
      student.email,
      student.groupIds.map((group) => group.code).join(', '),
      student.groupCoordinatorId?.name || '',
      student.groupCoordinatorId?.mobile || '',
      student.registrationStatus,
      `${safeFileName(student.studentId)}_${safeFileName(student.name)}.png`,
    ]),
  ];
  const workbook = createSimpleXlsx(rows, 'Students');
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="geu-induction-students.xlsx"');
  res.send(workbook);
}

export async function downloadQrPackage(_req, res) {
  const students = await Student.find({ isActive: true, qrRevokedAt: { $exists: false } })
    .select('+qrTokenEncrypted name studentId email registrationStatus')
    .populate('groupIds', 'name code')
    .sort({ studentId: 1 })
    .lean();
  if (!students.length) throw new HttpError(404, 'No active student QR codes are available');

  const files = {};
  const mappingRows = [['Student ID', 'Student Name', 'Email', 'Group', 'QR File Name']];
  const batchSize = 20;
  for (let index = 0; index < students.length; index += batchSize) {
    const batch = students.slice(index, index + batchSize);
    const generated = await Promise.all(batch.map(async (student) => {
      const fileName = `${safeFileName(student.studentId)}_${safeFileName(student.name)}.png`;
      const token = decryptQrToken(student.qrTokenEncrypted);
      const image = await QRCode.toBuffer(`GEUQR1:${token}`, { type: 'png', errorCorrectionLevel: 'M', width: 480, margin: 2 });
      return { student, fileName, image };
    }));
    generated.forEach(({ student, fileName, image }) => {
      files[`qr-codes/${fileName}`] = new Uint8Array(image);
      mappingRows.push([student.studentId, student.name, student.email, student.groupIds.map((group) => group.code).join(', '), fileName]);
    });
  }
  files['students.xlsx'] = new Uint8Array(createSimpleXlsx(mappingRows, 'QR Mapping'));
  files['README.txt'] = strToU8('GEU Induction Programme 2026\nQR images contain secure opaque tokens only. Student data is resolved by the authenticated scan coordinator application.');
  const archive = Buffer.from(zipSync(files, { level: 6 }));
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="geu-induction-qr-package-${Date.now()}.zip"`);
  res.send(archive);
}
