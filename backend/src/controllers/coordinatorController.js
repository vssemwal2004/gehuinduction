import mongoose from 'mongoose';
import { parse } from 'csv-parse/sync';
import Group from '../models/Group.js';
import MailJob from '../models/MailJob.js';
import User from '../models/User.js';
import { encryptCredentialPayload, generateTemporaryPassword } from '../services/credentialService.js';
import { coordinatorInputSchema } from '../validators/coordinatorValidator.js';
import { HttpError } from '../utils/httpError.js';
import { createSimpleXlsx, parseSimpleXlsx } from '../utils/xlsx.js';

function validId(value) {
  if (!mongoose.isValidObjectId(value)) throw new HttpError(400, 'Invalid coordinator ID');
}

async function queueCredentials(user, password, session, activatePasswordHash) {
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

const importHeaders = ['coordinator name', 'email', 'mobile number', 'coordinator type'];
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
    mobile: String(row[2] || '').trim(), role: String(row[3] || '').trim().toLowerCase(),
  }));
}

async function validateImport(file) {
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
  res.send(createSimpleXlsx([importHeaders.map((item) => item.replace(/\b\w/g, (letter) => letter.toUpperCase())), ['Example Name', 'coordinator@example.com', '+91 9999999999', 'scan_coordinator']], 'Coordinators'));
}

export async function previewCoordinatorImport(req, res) {
  res.json(await validateImport(req.file));
}

export async function commitCoordinatorImport(req, res) {
  const result = await validateImport(req.file);
  if (result.errorCount) throw new HttpError(400, `Import has ${result.errorCount} invalid row(s). Correct them first.`);
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      for (const row of result.rows) {
        const password = generateTemporaryPassword();
        const [user] = await User.create([{ name: row.name, email: row.email, mobile: row.mobile, role: row.role, passwordHash: await User.hashPassword(password) }], { session });
        await queueCredentials(user, password, session);
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
  const query = { role: { $in: ['group_coordinator', 'scan_coordinator'] } };
  if (req.query.role) query.role = req.query.role;
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
  const groupCounts = await Group.aggregate([{ $match: { coordinatorId: { $ne: null } } }, { $group: { _id: '$coordinatorId', count: { $sum: 1 } } }]);
  const countMap = new Map(groupCounts.map((item) => [String(item._id), item.count]));
  res.json({ coordinators: coordinators.map((item) => ({ ...item, assignedGroups: countMap.get(String(item._id)) || 0 })) });
}

export async function createCoordinator(req, res) {
  const parsed = coordinatorInputSchema.safeParse(req.body);
  if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message || 'Invalid coordinator details');
  const email = parsed.data.email.toLowerCase();
  if (await User.exists({ email })) throw new HttpError(409, 'Email is already registered');
  const password = generateTemporaryPassword();
  const user = await User.create({ ...parsed.data, email, passwordHash: await User.hashPassword(password) });
  await queueCredentials(user, password);
  res.status(201).json({ coordinator: user, credentialMailQueued: true });
}

export async function updateCoordinator(req, res) {
  validId(req.params.coordinatorId);
  const parsed = coordinatorInputSchema.safeParse(req.body);
  if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message || 'Invalid coordinator details');
  const current = await User.findOne({ _id: req.params.coordinatorId, role: { $in: ['group_coordinator', 'scan_coordinator'] } });
  if (!current) throw new HttpError(404, 'Coordinator not found');
  if (await User.exists({ email: parsed.data.email.toLowerCase(), _id: { $ne: current._id } })) throw new HttpError(409, 'Email is already registered');
  if (current.role === 'group_coordinator' && parsed.data.role !== current.role && await Group.exists({ coordinatorId: current._id })) {
    throw new HttpError(409, 'Remove this coordinator from assigned groups before changing the role');
  }
  Object.assign(current, parsed.data, { email: parsed.data.email.toLowerCase() });
  await current.save();
  res.json({ coordinator: current });
}

export async function setCoordinatorActive(req, res) {
  validId(req.params.coordinatorId);
  const active = req.body?.isActive;
  if (typeof active !== 'boolean') throw new HttpError(400, 'isActive must be true or false');
  const user = await User.findOne({ _id: req.params.coordinatorId, role: { $in: ['group_coordinator', 'scan_coordinator'] } });
  if (!user) throw new HttpError(404, 'Coordinator not found');
  if (!active && user.role === 'group_coordinator' && await Group.exists({ coordinatorId: user._id, isActive: true })) {
    throw new HttpError(409, 'Reassign active groups before deactivating this coordinator');
  }
  user.isActive = active;
  await user.save();
  res.json({ coordinator: user });
}

export async function resendCoordinatorCredentials(req, res) {
  validId(req.params.coordinatorId);
  const user = await User.findOne({ _id: req.params.coordinatorId, role: { $in: ['group_coordinator', 'scan_coordinator'] }, isActive: true });
  if (!user) throw new HttpError(404, 'Active coordinator not found');
  const password = generateTemporaryPassword();
  const pendingHash = await User.hashPassword(password);
  await queueCredentials(user, password, undefined, pendingHash);
  res.status(202).json({ credentialMailQueued: true });
}
