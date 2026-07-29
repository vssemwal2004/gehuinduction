import User from '../models/User.js';
import { env } from '../config/env.js';

export async function ensureInitialAdmin() {
  const existingAdmin = await User.findOne({ email: env.ADMIN_EMAIL.toLowerCase() }).lean();
  if (existingAdmin) return;

  await User.create({
    name: 'System Administrator',
    email: env.ADMIN_EMAIL.toLowerCase(),
    passwordHash: await User.hashPassword(env.ADMIN_PASSWORD),
    role: 'admin',
    isActive: true,
  });
  console.log('Initial administrator created');
}
