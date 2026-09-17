import { parse } from 'csv-parse/sync';
import { getModels } from '../config/database.js';
import { parseSimpleXlsx } from '../utils/xlsx.js';

const HEADERS = ['student name', 'student id', 'student mobile', 'semester'];
const normalize = (value) => String(value ?? '').trim();

function parseRows(file) {
  if (!file) throw new Error('Select a student import file');
  const name = file.originalname.toLowerCase();
  if (name.endsWith('.csv')) return parse(file.buffer, { relaxColumnCount: true, skipEmptyLines: true }).map((row) => row.map(normalize));
  if (name.endsWith('.xlsx')) return parseSimpleXlsx(file.buffer);
  throw new Error('Upload an .xlsx or .csv file');
}

export async function validateStudentImport(file, models = getModels()) {
  const rows = parseRows(file);
  if (rows.length < 2) throw new Error('The file does not contain student rows');
  if (rows.length > 5001) throw new Error('A maximum of 5,000 student rows can be imported at once');
  const headers = rows[0].map((value) => normalize(value).toLowerCase());
  if (HEADERS.some((header, index) => headers[index] !== header)) throw new Error(`Use the provided template. Required columns: ${HEADERS.join(', ')}`);
  const dataRows = rows.slice(1).map((row, index) => ({ row: index + 2, name: normalize(row[0]), studentId: normalize(row[1]), mobile: normalize(row[2]), semester: normalize(row[3]) }));
  const existingIds = new Set((await models.Student.find({ studentId: { $in: dataRows.map((row) => row.studentId) } }).select('studentId').lean()).map((item) => item.studentId));
  const fileIds = new Set();
  const results = dataRows.map((row) => {
    const errors = [];
    if (row.name.length < 2) errors.push('Student name is required');
    if (!/^[A-Za-z0-9_/-]{2,60}$/.test(row.studentId)) errors.push('Student ID is invalid');
    if (!/^[+0-9 ()-]{7,30}$/.test(row.mobile)) errors.push('Student mobile is invalid');
    if (!row.semester || row.semester.length > 40) errors.push('Semester is required');
    if (existingIds.has(row.studentId)) errors.push('Student ID already exists');
    if (fileIds.has(row.studentId)) errors.push('Duplicate student ID in file');
    if (row.studentId) fileIds.add(row.studentId);
    return { ...row, valid: errors.length === 0, errors };
  });
  return { rows: results, total: results.length, validCount: results.filter((row) => row.valid).length, errorCount: results.filter((row) => !row.valid).length };
}
