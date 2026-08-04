import { parse } from 'csv-parse/sync';
import { getModels } from '../config/database.js';
import { parseSimpleXlsx } from '../utils/xlsx.js';

const HEADERS = ['student name', 'student id', 'email', 'group code', 'group coordinator name', 'group coordinator mobile'];

function normalize(value) {
  return String(value ?? '').trim();
}

function parseRows(file) {
  const name = file.originalname.toLowerCase();
  if (name.endsWith('.csv')) {
    return parse(file.buffer, { relaxColumnCount: true, skipEmptyLines: true }).map((row) => row.map(normalize));
  }
  if (name.endsWith('.xlsx')) return parseSimpleXlsx(file.buffer);
  throw new Error('Upload an .xlsx or .csv file');
}

export async function validateStudentImport(file, models = getModels()) {
  const { Group, Student } = models;
  if (!file) throw new Error('Select a student import file');
  const rows = parseRows(file);
  if (rows.length < 2) throw new Error('The file does not contain student rows');
  if (rows.length > 5001) throw new Error('A maximum of 5,000 student rows can be imported at once');

  const headers = rows[0].map((value) => normalize(value).toLowerCase());
  if (HEADERS.some((header, index) => headers[index] !== header)) {
    throw new Error(`Use the provided template. Required columns: ${HEADERS.join(', ')}`);
  }

  const dataRows = rows.slice(1).map((row, index) => ({
    row: index + 2,
    name: normalize(row[0]),
    studentId: normalize(row[1]),
    email: normalize(row[2]).toLowerCase(),
    groupCode: normalize(row[3]).toUpperCase(),
    groupCoordinatorName: normalize(row[4]),
    groupCoordinatorMobile: normalize(row[5]),
  }));

  const groupCodes = [...new Set(dataRows.map((row) => row.groupCode).filter(Boolean))];
  const [groups, existing] = await Promise.all([
    Group.find({ code: { $in: groupCodes }, isActive: true }).select('_id code').lean(),
    Student.find({
      $or: [
        { studentId: { $in: dataRows.map((row) => row.studentId).filter(Boolean) } },
        { email: { $in: dataRows.map((row) => row.email).filter(Boolean) } },
      ],
    }).select('studentId email').lean(),
  ]);
  const groupMap = new Map(groups.map((group) => [group.code, group]));
  const existingIds = new Set(existing.map((student) => student.studentId));
  const existingEmails = new Set(existing.map((student) => student.email));
  const fileIds = new Set();
  const fileEmails = new Set();

  const results = dataRows.map((row) => {
    const errors = [];
    if (row.name.length < 2) errors.push('Student name is required');
    if (!/^[A-Za-z0-9_/-]{2,60}$/.test(row.studentId)) errors.push('Student ID is invalid');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)) errors.push('Email is invalid');
    if (!row.groupCode) errors.push('Group code is required');
    else if (!groupMap.has(row.groupCode)) errors.push(`Group ${row.groupCode} does not exist or is inactive`);
    if (row.groupCoordinatorName.length < 2) errors.push('Group coordinator name is required');
    if (!/^[+0-9 ()-]{7,30}$/.test(row.groupCoordinatorMobile)) errors.push('Group coordinator mobile is invalid');
    if (existingIds.has(row.studentId)) errors.push('Student ID already exists');
    if (existingEmails.has(row.email)) errors.push('Email already exists');
    if (fileIds.has(row.studentId)) errors.push('Duplicate student ID in file');
    if (fileEmails.has(row.email)) errors.push('Duplicate email in file');
    if (row.studentId) fileIds.add(row.studentId);
    if (row.email) fileEmails.add(row.email);
    const group = groupMap.get(row.groupCode);
    return {
      ...row,
      groupId: group?._id || null,
      valid: errors.length === 0,
      errors,
    };
  });

  return {
    rows: results,
    total: results.length,
    validCount: results.filter((row) => row.valid).length,
    errorCount: results.filter((row) => !row.valid).length,
  };
}
