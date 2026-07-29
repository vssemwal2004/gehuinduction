import { env } from '../config/env.js';
import { HttpError } from '../utils/httpError.js';

const safeMethods = new Set(['GET', 'HEAD', 'OPTIONS']);

export function requireTrustedOrigin(req, _res, next) {
  if (safeMethods.has(req.method)) return next();
  const origin = req.get('origin');
  if (origin && origin !== env.FRONTEND_ORIGIN) throw new HttpError(403, 'Untrusted request origin');
  const fetchSite = req.get('sec-fetch-site');
  if (fetchSite === 'cross-site') throw new HttpError(403, 'Cross-site request blocked');
  next();
}
