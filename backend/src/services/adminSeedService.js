import { env } from '../config/env.js';
import { getActiveDatabaseContexts, MBA_DB_KEY, PRIMARY_DB_KEY, SECONDARY_DB_KEY } from '../config/database.js';

const FALLBACK_PRIMARY_SUPER_ADMIN_EMAIL = 'akhilnegi.cc@geu.ac.in';

async function ensureAdmin(User, { email, password, name, logLabel }) {
  if (!email || !password) return;
  const normalizedEmail = email.toLowerCase();
  const existingAdmin = await User.findOne({ email: normalizedEmail }).select('+passwordHash');
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
    if (!existingAdmin.passwordHash || env.RESET_SEEDED_ADMIN_PASSWORDS) {
      existingAdmin.passwordHash = await User.hashPassword(password);
      changed = true;
    }
    if (changed) {
      await existingAdmin.save();
      console.log(`${logLabel} repaired`);
    }
    return;
  }

  await User.create({
    name,
    email: normalizedEmail,
    passwordHash: await User.hashPassword(password),
    role: 'admin',
    isActive: true,
  });
  console.log(`${logLabel} created`);
}

export async function ensureInitialAdmin() {
  for (const context of getActiveDatabaseContexts()) {
    const { User } = context.models;
    if (context.key === PRIMARY_DB_KEY) {
      await ensureAdmin(User, {
        email: env.ADMIN_EMAIL,
        password: env.ADMIN_PASSWORD,
        name: 'System Administrator',
        logLabel: 'Initial primary administrator',
      });
      await ensureAdmin(User, {
        email: env.PRIMARY_SUPER_ADMIN_EMAIL || FALLBACK_PRIMARY_SUPER_ADMIN_EMAIL,
        password: env.PRIMARY_SUPER_ADMIN_PASSWORD || env.ADMIN_PASSWORD,
        name: 'Primary Super Administrator',
        logLabel: 'Primary super administrator',
      });
    }
    if (context.key === SECONDARY_DB_KEY) {
      await ensureAdmin(User, {
        email: env.SECONDARY_SUPER_ADMIN_EMAIL,
        password: env.SECONDARY_SUPER_ADMIN_PASSWORD,
        name: 'Secondary Super Administrator',
        logLabel: 'Secondary super administrator',
      });
    }
    if (context.key === MBA_DB_KEY) {
      await ensureAdmin(User, {
        email: env.MBA_SUPER_ADMIN_EMAIL,
        password: env.MBA_SUPER_ADMIN_PASSWORD,
        name: 'MBA Super Administrator',
        logLabel: 'MBA super administrator',
      });
    }
  }
}
