import { getModels, hasDatabaseContext, PRIMARY_DB_KEY } from '../config/database.js';
import { isSuperAdminEmail } from '../config/superAdmins.js';
import { verifyAccessToken } from '../services/tokenService.js';
import { HttpError } from '../utils/httpError.js';

export function isSuperAdmin(user) {
  const dbKey = user?.dbKey || PRIMARY_DB_KEY;
  return Boolean(
    user?.role === 'admin'
      && (user?.isSuperAdmin === true || isSuperAdminEmail(user?.email, dbKey)),
  );
}

export async function requireAuth(req, _res, next) {
  const token = req.cookies?.accessToken;
  if (!token) throw new HttpError(401, 'Authentication required');

  const payload = verifyAccessToken(token);
  const dbKey = payload.dbKey || PRIMARY_DB_KEY;
  if (!hasDatabaseContext(dbKey)) throw new HttpError(401, 'Account database is unavailable');
  const { User } = getModels(dbKey);
  const user = await User.findById(payload.sub).select('name email mobile role isSuperAdmin permissions isActive groupIds').lean();
  if (!user || !user.isActive) throw new HttpError(401, 'Account is unavailable');
  req.dbKey = dbKey;
  req.models = getModels(dbKey);
  req.user = { ...user, dbKey };
  next();
}

export function requireRole(...roles) {
  return (req, _res, next) => {
    if (!req.user || !roles.includes(req.user.role)) throw new HttpError(403, 'Access denied');
    next();
  };
}

export function requireSuperAdmin(req, _res, next) {
  if (!isSuperAdmin(req.user)) throw new HttpError(403, 'Super administrator access required');
  next();
}

export function requireAdminPermission(permission) {
  return (req, _res, next) => {
    if (isSuperAdmin(req.user) || req.user?.permissions?.includes(permission)) return next();
    throw new HttpError(403, 'Admin feature access required');
  };
}
