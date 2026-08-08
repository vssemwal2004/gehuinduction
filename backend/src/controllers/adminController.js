import mongoose from 'mongoose';
import { normalizeAdminPermissions } from '../config/adminPermissions.js';
import { getRequestModels } from '../config/database.js';
import { isSuperAdminEmail } from '../config/superAdmins.js';
import { encryptCredentialPayload, generateTemporaryPassword } from '../services/credentialService.js';
import { adminInputSchema } from '../validators/adminValidator.js';
import { HttpError } from '../utils/httpError.js';

function validId(value) {
  if (!mongoose.isValidObjectId(value)) throw new HttpError(400, 'Invalid admin ID');
}

async function queueCredentials(MailJob, user, password) {
  await MailJob.create({
    type: 'coordinator_credentials',
    to: user.email,
    payloadEncrypted: encryptCredentialPayload({ name: user.name, email: user.email, password, role: user.role }),
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    credentialUserId: user._id,
  });
}

function publicAdmin(user, dbKey) {
  const immutableSuperAdmin = isSuperAdminEmail(user.email, dbKey);
  return {
    _id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    isSuperAdmin: user.isSuperAdmin === true || immutableSuperAdmin,
    permissions: user.permissions || [],
    immutableSuperAdmin,
    isActive: user.isActive,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
  };
}

export async function listAdmins(req, res) {
  const { User } = getRequestModels(req);
  const query = { role: 'admin' };
  if (req.query.status === 'active') query.isActive = true;
  if (req.query.status === 'inactive') query.isActive = false;
  if (req.query.search) {
    const search = String(req.query.search).slice(0, 120).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    query.$or = ['name', 'email'].map((field) => ({ [field]: new RegExp(search, 'i') }));
  }
  const admins = await User.find(query).select('name email role isSuperAdmin permissions isActive lastLoginAt createdAt').sort({ isSuperAdmin: -1, isActive: -1, name: 1 }).lean();
  res.json({ admins: admins.map((admin) => publicAdmin(admin, req.dbKey)) });
}

export async function createAdmin(req, res) {
  const { MailJob, User } = getRequestModels(req);
  const parsed = adminInputSchema.safeParse(req.body);
  if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message || 'Invalid admin details');
  const email = parsed.data.email.toLowerCase();
  if (await User.exists({ email })) throw new HttpError(409, 'Email is already registered');
  const password = generateTemporaryPassword();
  const user = await User.create({
    name: parsed.data.name,
    email,
    role: 'admin',
    isSuperAdmin: parsed.data.isSuperAdmin,
    permissions: normalizeAdminPermissions(parsed.data.permissions),
    passwordHash: await User.hashPassword(password),
  });
  await queueCredentials(MailJob, user, password);
  res.status(201).json({ admin: publicAdmin(user, req.dbKey), credentialMailQueued: true });
}

export async function updateAdmin(req, res) {
  const { User } = getRequestModels(req);
  validId(req.params.adminId);
  const parsed = adminInputSchema.safeParse(req.body);
  if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message || 'Invalid admin details');
  const current = await User.findOne({ _id: req.params.adminId, role: 'admin' });
  if (!current) throw new HttpError(404, 'Admin not found');
  const email = parsed.data.email.toLowerCase();
  if (await User.exists({ email, _id: { $ne: current._id } })) throw new HttpError(409, 'Email is already registered');
  if (current._id.toString() === req.user._id.toString() && !parsed.data.isSuperAdmin && !isSuperAdminEmail(email, req.dbKey)) {
    throw new HttpError(400, 'You cannot remove your own full access');
  }
  current.name = parsed.data.name;
  current.email = email;
  current.isSuperAdmin = isSuperAdminEmail(email, req.dbKey) ? true : parsed.data.isSuperAdmin;
  current.permissions = normalizeAdminPermissions(parsed.data.permissions);
  await current.save();
  res.json({ admin: publicAdmin(current, req.dbKey) });
}

export async function setAdminActive(req, res) {
  const { User } = getRequestModels(req);
  validId(req.params.adminId);
  const active = req.body?.isActive;
  if (typeof active !== 'boolean') throw new HttpError(400, 'isActive must be true or false');
  const user = await User.findOne({ _id: req.params.adminId, role: 'admin' });
  if (!user) throw new HttpError(404, 'Admin not found');
  if (user._id.toString() === req.user._id.toString() && !active) throw new HttpError(400, 'You cannot deactivate your own account');
  user.isActive = active;
  await user.save();
  res.json({ admin: publicAdmin(user, req.dbKey) });
}

export async function resendAdminCredentials(req, res) {
  const { MailJob, User } = getRequestModels(req);
  validId(req.params.adminId);
  const user = await User.findOne({ _id: req.params.adminId, role: 'admin', isActive: true });
  if (!user) throw new HttpError(404, 'Active admin not found');
  const password = generateTemporaryPassword();
  user.passwordHash = await User.hashPassword(password);
  await user.save();
  await queueCredentials(MailJob, user, password);
  res.status(202).json({ credentialMailQueued: true });
}
