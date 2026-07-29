import User from '../models/User.js';
import { verifyAccessToken } from '../services/tokenService.js';
import { HttpError } from '../utils/httpError.js';

export async function requireAuth(req, _res, next) {
  const token = req.cookies?.accessToken;
  if (!token) throw new HttpError(401, 'Authentication required');

  const payload = verifyAccessToken(token);
  const user = await User.findById(payload.sub).select('name email mobile role isActive groupIds').lean();
  if (!user || !user.isActive) throw new HttpError(401, 'Account is unavailable');
  req.user = user;
  next();
}

export function requireRole(...roles) {
  return (req, _res, next) => {
    if (!req.user || !roles.includes(req.user.role)) throw new HttpError(403, 'Access denied');
    next();
  };
}
