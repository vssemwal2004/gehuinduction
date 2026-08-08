import { z } from 'zod';
import { getActiveDatabaseContexts, getRequestModels } from '../config/database.js';
import { accessCookieOptions, signAccessToken } from '../services/tokenService.js';
import { HttpError } from '../utils/httpError.js';
import { isSuperAdmin } from '../middleware/auth.js';

const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1).max(200),
});

function publicUser(user) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    mobile: user.mobile || '',
    role: user.role,
    dbKey: user.dbKey,
    permissions: user.permissions || [],
    hasFullAdminAccess: user.isSuperAdmin === true,
    isSuperAdmin: isSuperAdmin(user),
  };
}

export async function login(req, res) {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) throw new HttpError(400, 'Enter a valid email and password');

  const email = parsed.data.email.toLowerCase();
  let matchedUser;
  let matchedDbKey;
  for (const context of getActiveDatabaseContexts()) {
    const user = await context.models.User.findOne({ email }).select('+passwordHash');
    if (user && ['admin', 'scan_coordinator'].includes(user.role) && user.isActive && await user.verifyPassword(parsed.data.password)) {
      matchedUser = user;
      matchedDbKey = context.key;
      break;
    }
  }

  if (!matchedUser) throw new HttpError(401, 'Invalid email or password');

  matchedUser.lastLoginAt = new Date();
  await matchedUser.save();
  const userWithDb = { ...matchedUser.toObject(), dbKey: matchedDbKey };
  res.cookie('accessToken', signAccessToken(matchedUser, matchedDbKey), accessCookieOptions);
  res.json({ user: publicUser(userWithDb) });
}

export function logout(_req, res) {
  res.clearCookie('accessToken', accessCookieOptions);
  res.status(204).end();
}

export function me(req, res) {
  res.json({ user: publicUser(req.user) });
}

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(200),
  newPassword: z.string().min(12).max(200)
    .regex(/[a-z]/, 'New password needs a lowercase letter')
    .regex(/[A-Z]/, 'New password needs an uppercase letter')
    .regex(/[0-9]/, 'New password needs a number')
    .regex(/[^A-Za-z0-9]/, 'New password needs a symbol'),
});

export async function changePassword(req, res) {
  const parsed = changePasswordSchema.safeParse(req.body);
  if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message || 'Enter a stronger password');
  if (parsed.data.currentPassword === parsed.data.newPassword) throw new HttpError(400, 'New password must be different');
  const { User } = getRequestModels(req);
  const user = await User.findById(req.user._id).select('+passwordHash');
  if (!user || !(await user.verifyPassword(parsed.data.currentPassword))) throw new HttpError(401, 'Current password is incorrect');
  user.passwordHash = await User.hashPassword(parsed.data.newPassword);
  await user.save();
  res.status(204).end();
}
