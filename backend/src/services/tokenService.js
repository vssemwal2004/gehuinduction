import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

const TOKEN_TTL = '8h';

export function signAccessToken(user) {
  return jwt.sign({ sub: user._id.toString(), role: user.role }, env.JWT_SECRET, {
    algorithm: 'HS256',
    expiresIn: TOKEN_TTL,
    issuer: 'geu-induction-connect',
    audience: 'geu-induction-connect-web',
  });
}

export function verifyAccessToken(token) {
  return jwt.verify(token, env.JWT_SECRET, {
    algorithms: ['HS256'],
    issuer: 'geu-induction-connect',
    audience: 'geu-induction-connect-web',
  });
}

export const accessCookieOptions = {
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: 'strict',
  maxAge: 8 * 60 * 60 * 1000,
  path: '/',
};
