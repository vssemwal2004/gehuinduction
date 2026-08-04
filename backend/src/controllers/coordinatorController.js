import mongoose from 'mongoose';
import { parse } from 'csv-parse/sync';
import { getDatabaseContext, getRequestModels } from '../config/database.js';
import { encryptCredentialPayload, generateTemporaryPassword } from '../services/credentialService.js';
import { coordinatorInputSchema } from '../validators/coordinatorValidator.js';
import { HttpError } from '../utils/httpError.js';
import { createSimpleXlsx, parseSimpleXlsx } from '../utils/xlsx.js';

function validId(value) {
  if (!mongoose.isValidObjectId(value)) throw new HttpError(400, 'Invalid coordinator ID');
}

async function queueCredentials(MailJob, user, password, session, activatePasswordHash) {
  const document = {
    type: 'coordinator_credentials',
    to: user.email,
    payloadEncrypted: encryptCredentialPayload({ name: user.name, email: user.email, password, role: user.role }),
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    credentialUserId: user._id,
    activatePasswordHash,
  };
  if (session) await MailJob.create([document], { session });
  else await MailJob.create(document);
}

const importHeaders = ['scan coordinator name', 'email', 'mobile number'];
function importRows(file) {
  if (!file) throw new HttpError(400, 'Select a coordinator import file');
  const rows = file.originalname.toLowerCase().endsWith('.csv')
    ? parse(file.buffer, { relaxColumnCount: true, skipEmptyLines: true })
    : parseSimpleXlsx(file.buffer);
  if (rows.length < 2) throw new HttpError(400, 'The file does not contain coordinator rows');
  if (rows.length > 1001) throw new HttpError(400, 'A maximum of 1,000 coordinators can be imported at once');
  const headers = rows[0].map((value) => String(value || '').trim().toLowerCase());
  if (importHeaders.some((header, index) => headers[index] !== header)) throw new HttpError(400, 'Use the provided coordinator template');
  return rows.slice(1).map((row, index) => ({
    row: index + 2, name: String(row[0] || '').trim(), email: String(row[1] || '').trim().toLowerCase(),
    mobile: String(row[2] || '').trim(),
  }));
}

async function validateImport(file, models) {
  const { User } = models;
  const rows = importRows(file);
  const existing = new Set((await User.find({ email: { $in: rows.map((row) => row.email) } }).select('email').lean()).map((item) => item.email));
  const seen = new Set();
  const results = rows.map((row) => {
    const parsed = coordinatorInputSchema.safeParse(row);
    const errors = parsed.success ? [] : parsed.error.issues.map((issue) => issue.message);
    if (existing.has(row.email)) errors.push('Email is already registered');
    if (seen.has(row.email)) errors.push('Duplicate email in file');
    seen.add(row.email);
    return { ...row, valid: !errors.length, errors };
  });
  return { rows: results, total: results.length, validCount: results.filter((row) => row.valid).length, errorCount: results.filter((row) => !row.valid).length };
}

export function downloadCoordinatorTemplate(_req, res) {
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="geu-coordinator-import-template.xlsx"');
  res.send(createSimpleXlsx([importHeaders.map((item) => item.replace(/\b\w/g, (letter) => letter.toUpperCase())), ['Example Name', 'coordinator@example.com', '+91 9999999999']], 'Scan Coordinators'));
}

export async function previewCoordinatorImport(req, res) {
  res.json(await validateImport(req.file, getRequestModels(req)));
}

export async function commitCoordinatorImport(req, res) {
  const { MailJob, User } = getRequestModels(req);
  const result = await validateImport(req.file, getRequestModels(req));
  if (result.errorCount) throw new HttpError(400, `Import has ${result.errorCount} invalid row(s). Correct them first.`);
  const session = await getDatabaseContext(req.dbKey).connection.startSession();
  try {
    await session.withTransaction(async () => {
      for (const row of result.rows) {
        const password = generateTemporaryPassword();
        const [user] = await User.create([{ name: row.name, email: row.email, mobile: row.mobile, role: 'scan_coordinator', passwordHash: await User.hashPassword(password) }], { session });
        await queueCredentials(MailJob, user, password, session);
      }
    });
  } catch (error) {
    throw new HttpError(error?.code === 11000 ? 409 : 500, error?.code === 11000 ? 'Coordinator data changed. Preview again.' : 'Coordinator import failed');
  } finally {
    await session.endSession();
  }
  res.status(201).json({ imported: result.total, credentialMailsQueued: result.total });
}

export async function listCoordinators(req, res) {
  const { User } = getRequestModels(req);
  const query = { role: 'scan_coordinator' };
  if (req.query.status === 'active') query.isActive = true;
  if (req.query.status === 'inactive') query.isActive = false;
  if (req.query.search) {
    const search = String(req.query.search).slice(0, 120).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    query.$or = ['name', 'email', 'mobile'].map((field) => ({ [field]: new RegExp(search, 'i') }));
  }
  const coordinators = await User.find(query)
    .select('name email mobile role isActive lastLoginAt createdAt')
    .sort({ isActive: -1, name: 1 })
    .lean();
  res.json({ coordinators });
}

export async function createCoordinator(req, res) {
  const { MailJob, User } = getRequestModels(req);
  const parsed = coordinatorInputSchema.safeParse(req.body);
  if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message || 'Invalid coordinator details');
  const email = parsed.data.email.toLowerCase();
  if (await User.exists({ email })) throw new HttpError(409, 'Email is already registered');
  const password = generateTemporaryPassword();
  const user = await User.create({ ...parsed.data, email, role: 'scan_coordinator', passwordHash: await User.hashPassword(password) });
  await queueCredentials(MailJob, user, password);
  res.status(201).json({ coordinator: user, credentialMailQueued: true });
}

export async function updateCoordinator(req, res) {
  const { User } = getRequestModels(req);
  validId(req.params.coordinatorId);
  const parsed = coordinatorInputSchema.safeParse(req.body);
  if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message || 'Invalid coordinator details');
  const current = await User.findOne({ _id: req.params.coordinatorId, role: 'scan_coordinator' });
  if (!current) throw new HttpError(404, 'Coordinator not found');
  if (await User.exists({ email: parsed.data.email.toLowerCase(), _id: { $ne: current._id } })) throw new HttpError(409, 'Email is already registered');
  Object.assign(current, parsed.data, { email: parsed.data.email.toLowerCase() });
  await current.save();
  res.json({ coordinator: current });
}

export async function setCoordinatorActive(req, res) {
  const { User } = getRequestModels(req);
  validId(req.params.coordinatorId);
  const active = req.body?.isActive;
  if (typeof active !== 'boolean') throw new HttpError(400, 'isActive must be true or false');
  const user = await User.findOne({ _id: req.params.coordinatorId, role: 'scan_coordinator' });
  if (!user) throw new HttpError(404, 'Coordinator not found');
  user.isActive = active;
  await user.save();
  res.json({ coordinator: user });
}

export async function resendCoordinatorCredentials(req, res) {
  const { MailJob, User } = getRequestModels(req);
  validId(req.params.coordinatorId);
  const user = await User.findOne({ _id: req.params.coordinatorId, role: 'scan_coordinator', isActive: true });
  if (!user) throw new HttpError(404, 'Active coordinator not found');
  const password = generateTemporaryPassword();
  const pendingHash = await User.hashPassword(password);
  await queueCredentials(MailJob, user, password, undefined, pendingHash);
  res.status(202).json({ credentialMailQueued: true });
}
