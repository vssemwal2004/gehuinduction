import fs from 'node:fs';
import path from 'node:path';
import { connectDatabase, getDatabaseContext } from '../backend/src/config/database.js';
import { parseSimpleXlsx } from '../backend/src/utils/xlsx.js';
import { toMsg91Mobile } from '../backend/src/services/msg91OtpService.js';

const QR_LINK_BASE = 'https://files.geu.ac.in/induction/btech/';
const sourceFiles = [
  { label: 'CORE', path: 'c:/Users/422se/Downloads/CORE (1).xlsx', phoneHeader: 'Mobile Number' },
  { label: 'Specialization', path: 'c:/Users/422se/Downloads/Specialization (1).xlsx', phoneHeader: 'Student Phone Number' },
];

function normalize(value) {
  return String(value ?? '').trim();
}

function normalizeEmail(value) {
  return normalize(value).toLowerCase();
}

function readRows(source) {
  const rows = parseSimpleXlsx(fs.readFileSync(source.path));
  const headers = rows[0].map(normalize);
  const index = Object.fromEntries(headers.map((header, i) => [header.toLowerCase(), i]));
  return rows.slice(1).map((row, offset) => ({
    source: source.label,
    sourceRow: offset + 2,
    name: normalize(row[index['student name']]),
    email: normalizeEmail(row[index.email]),
    phone: normalize(row[index[source.phoneHeader.toLowerCase()]]),
  })).filter((row) => row.name || row.email || row.phone);
}

function publicQrUrl(tokenHash) {
  return `${QR_LINK_BASE}${encodeURIComponent(String(tokenHash).trim().toLowerCase())}`;
}

async function main() {
  const dryRun = !process.argv.includes('--commit');
  await connectDatabase();
  const { models, connection } = getDatabaseContext();
  const { Student, StudentQrData } = models;

  const allRows = sourceFiles.flatMap(readRows);
  const phoneCounts = new Map();
  for (const row of allRows) {
    row.phoneKey = toMsg91Mobile(row.phone);
    phoneCounts.set(row.phoneKey, (phoneCounts.get(row.phoneKey) || 0) + 1);
  }

  const skippedDuplicatePhones = allRows.filter((row) => phoneCounts.get(row.phoneKey) > 1);
  const candidateRows = allRows.filter((row) => phoneCounts.get(row.phoneKey) === 1);
  const students = await Student.find({ email: { $in: candidateRows.map((row) => row.email) } })
    .select('name email qrTokenHash isActive')
    .lean();
  const studentByEmail = new Map(students.map((student) => [student.email, student]));
  const existingQrData = await StudentQrData.find({
    $or: [
      { email: { $in: candidateRows.map((row) => row.email) } },
      { phoneKey: { $in: candidateRows.map((row) => row.phoneKey) } },
    ],
  }).select('email phoneKey').lean();
  const existingEmails = new Set(existingQrData.map((item) => item.email));
  const existingPhones = new Set(existingQrData.map((item) => item.phoneKey));

  const missingStudent = [];
  const existing = [];
  const insertable = [];

  for (const row of candidateRows) {
    const student = studentByEmail.get(row.email);
    if (!student?.qrTokenHash) {
      missingStudent.push(row);
      continue;
    }
    if (existingEmails.has(row.email) || existingPhones.has(row.phoneKey)) {
      existing.push(row);
      continue;
    }
    insertable.push({
      name: row.name,
      email: row.email,
      phone: row.phone,
      phoneKey: row.phoneKey,
      qrLink: publicQrUrl(student.qrTokenHash),
      isActive: true,
    });
  }

  console.log(JSON.stringify({
    mode: dryRun ? 'dry-run' : 'commit',
    totalSheetRows: allRows.length,
    skippedDuplicatePhones: skippedDuplicatePhones.length,
    candidatesAfterDuplicateSkip: candidateRows.length,
    missingExistingStudentOrQrHash: missingStudent.length,
    skippedAlreadyInQrData: existing.length,
    insertable: insertable.length,
    duplicatePhoneRows: skippedDuplicatePhones.map((row) => ({
      source: row.source,
      row: row.sourceRow,
      name: row.name,
      email: row.email,
      phone: row.phone,
    })),
    missingSample: missingStudent.slice(0, 20).map((row) => ({
      source: row.source,
      row: row.sourceRow,
      name: row.name,
      email: row.email,
      phone: row.phone,
    })),
  }, null, 2));

  if (!dryRun && insertable.length) {
    const inserted = await StudentQrData.insertMany(insertable, { ordered: false });
    console.log(`Inserted ${inserted.length} StudentQrData rows`);
  }

  await connection.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
