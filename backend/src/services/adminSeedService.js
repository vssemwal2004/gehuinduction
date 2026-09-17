import { env } from '../config/env.js';
import { getActiveDatabaseContexts, PRIMARY_DB_KEY } from '../config/database.js';

export async function ensureInitialAdmin() {
  for (const context of getActiveDatabaseContexts()) {
    if (context.key !== PRIMARY_DB_KEY) continue;
    const { User } = context.models;
    const email = env.ADMIN_EMAIL.toLowerCase();
    const user = await User.findOne({ email }).select('+passwordHash');
    if (user) {
      user.role = 'admin'; user.isSuperAdmin = true; user.permissions = []; user.isActive = true;
      if (!user.passwordHash || env.RESET_SEEDED_ADMIN_PASSWORDS) user.passwordHash = await User.hashPassword(env.ADMIN_PASSWORD);
      await user.save();
      return;
    }
    await User.create({ name: 'System Administrator', email, passwordHash: await User.hashPassword(env.ADMIN_PASSWORD), role: 'admin', isSuperAdmin: true, permissions: [], isActive: true });
    console.log('System administrator created');
  }
}
