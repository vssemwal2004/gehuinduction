import { env } from '../config/env.js';
import { BBA_DB_KEY, getActiveDatabaseContexts, MBA_DB_KEY, PRIMARY_DB_KEY, SECONDARY_DB_KEY } from '../config/database.js';
import { getSuperAdminEmails } from '../config/superAdmins.js';

async function ensureAdmin(User, { email, password, name, logLabel, superAdmin = false }) {
  if (!email || !password) return;
  const normalizedEmail = email.toLowerCase();
  const existingAdmin = await User.findOne({ email: normalizedEmail }).select('+passwordHash');
  if (existingAdmin) {
    let changed = false;
    if (existingAdmin.role !== 'admin') {
      existingAdmin.role = 'admin';
      changed = true;
    }
    if (existingAdmin.isSuperAdmin !== superAdmin) {
      existingAdmin.isSuperAdmin = superAdmin;
      changed = true;
    }
    if (superAdmin && existingAdmin.permissions?.length) {
      existingAdmin.permissions = [];
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
    isSuperAdmin: superAdmin,
    permissions: [],
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
      for (const email of getSuperAdminEmails(PRIMARY_DB_KEY)) {
        await ensureAdmin(User, {
          email,
          password: env.PRIMARY_SUPER_ADMIN_PASSWORD || env.ADMIN_PASSWORD,
          name: 'Primary Super Administrator',
          logLabel: `Primary super administrator ${email}`,
          superAdmin: true,
        });
      }
    }
    if (context.key === SECONDARY_DB_KEY) {
      await ensureAdmin(User, {
        email: env.SECONDARY_SUPER_ADMIN_EMAIL,
        password: env.SECONDARY_SUPER_ADMIN_PASSWORD,
        name: 'Secondary Super Administrator',
        logLabel: 'Secondary super administrator',
        superAdmin: true,
      });
    }
    if (context.key === MBA_DB_KEY) {
      await ensureAdmin(User, {
        email: env.MBA_SUPER_ADMIN_EMAIL,
        password: env.MBA_SUPER_ADMIN_PASSWORD,
        name: 'MBA Super Administrator',
        logLabel: 'MBA super administrator',
        superAdmin: true,
      });
    }
    if (context.key === BBA_DB_KEY) {
      await ensureAdmin(User, {
        email: env.BBA_SUPER_ADMIN_EMAIL,
        password: env.BBA_SUPER_ADMIN_PASSWORD,
        name: 'BBA Super Administrator',
        logLabel: 'BBA super administrator',
        superAdmin: true,
      });
    }
  }
}
