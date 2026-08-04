import { parse } from 'csv-parse/sync';
import { getModels } from '../config/database.js';
import { parseSimpleXlsx } from '../utils/xlsx.js';
import { toMsg91Mobile } from './msg91OtpService.js';

const HEADERS = ['student name', 'email', 'phone number', 'qr link'];

function normalize(value) {
  return String(value ?? '').trim();
}

function parseRows(file) {
  const name = file.originalname.toLowerCase();
  if (name.endsWith('.csv')) return parse(file.buffer, { relaxColumnCount: true, skipEmptyLines: true }).map((row) => row.map(normalize));
  if (name.endsWith('.xlsx')) return parseSimpleXlsx(file.buffer);
  throw new Error('Upload an .xlsx or .csv file');
}

function validUrl(value) {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

export async function validateStudentQrDataImport(file, models = getModels()) {
  const { StudentQrData } = models;
  if (!file) throw new Error('Select a QR data import file');
  const rows = parseRows(file);
  if (rows.length < 2) throw new Error('The file does not contain student QR rows');
  if (rows.length > 5001) throw new Error('A maximum of 5,000 student QR rows can be imported at once');

  const headers = rows[0].map((value) => normalize(value).toLowerCase());
  if (HEADERS.some((header, index) => headers[index] !== header)) {
    throw new Error(`Use the provided template. Required columns: ${HEADERS.join(', ')}`);
  }

  const dataRows = rows.slice(1).map((row, index) => ({
    row: index + 2,
    name: normalize(row[0]),
    email: normalize(row[1]).toLowerCase(),
    phone: normalize(row[2]),
    qrLink: normalize(row[3]),
  }));

  const existing = await StudentQrData.find({
    $or: [
      { email: { $in: dataRows.map((row) => row.email).filter(Boolean) } },
      { phoneKey: { $in: dataRows.map((row) => toMsg91Mobile(row.phone)).filter(Boolean) } },
    ],
  }).select('email phoneKey').lean();
  const existingEmails = new Set(existing.map((item) => item.email));
  const existingPhones = new Set(existing.map((item) => item.phoneKey));
  const fileEmails = new Set();
  const filePhones = new Set();

  const results = dataRows.map((row) => {
    const errors = [];
    if (row.name.length < 2) errors.push('Student name is required');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)) errors.push('Email is invalid');
    if (!/^[+0-9 ()-]{7,30}$/.test(row.phone)) errors.push('Phone number is invalid');
    const phoneKey = toMsg91Mobile(row.phone);
    if (!validUrl(row.qrLink)) errors.push('QR link is invalid');
    if (existingEmails.has(row.email)) errors.push('Email already exists');
    if (existingPhones.has(phoneKey)) errors.push('Phone number already exists');
    if (fileEmails.has(row.email)) errors.push('Duplicate email in file');
    if (filePhones.has(phoneKey)) errors.push('Duplicate phone number in file');
    if (row.email) fileEmails.add(row.email);
    if (phoneKey) filePhones.add(phoneKey);
    return { ...row, phoneKey, valid: errors.length === 0, errors };
  });

  return {
    rows: results,
    total: results.length,
    validCount: results.filter((row) => row.valid).length,
    errorCount: results.filter((row) => !row.valid).length,
  };
}
