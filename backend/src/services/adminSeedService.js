import User from '../models/User.js';
import { env } from '../config/env.js';

export async function ensureInitialAdmin() {
  const email = env.ADMIN_EMAIL.toLowerCase();
  const existingAdmin = await User.findOne({ email }).select('+passwordHash');
  if (existingAdmin) {
    let changed = false;
    if (existingAdmin.role !== 'admin') {
      existingAdmin.role = 'admin';
      changed = true;
    }
    if (!existingAdmin.isActive) {
      existingAdmin.isActive = true;
      changed = true;
    }
    if (!existingAdmin.passwordHash) {
      existingAdmin.passwordHash = await User.hashPassword(env.ADMIN_PASSWORD);
      changed = true;
    }
    if (changed) {
      await existingAdmin.save();
      console.log('Initial administrator repaired');
    }
    return;
  }

  await User.create({
    name: 'System Administrator',
    email,
    passwordHash: await User.hashPassword(env.ADMIN_PASSWORD),
    role: 'admin',
    isActive: true,
  });
  console.log('Initial administrator created');
}
