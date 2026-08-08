import { env } from './env.js';
import { BBA_DB_KEY, MBA_DB_KEY, PRIMARY_DB_KEY, SECONDARY_DB_KEY } from './database.js';

const FALLBACK_PRIMARY_SUPER_ADMIN_EMAILS = [
  'akhilnegi.cc@geu.ac.in',
  '422semwalvivek@gmail.com',
  'hod.btechfirstyear@gehu.ac.in',
  'simarkatiyar@gehu.ac.in',
];

const normalizeEmail = (email) => email?.trim().toLowerCase();
const uniqueEmails = (emails) => [...new Set(emails.map(normalizeEmail).filter(Boolean))];

export function getSuperAdminEmails(dbKey = PRIMARY_DB_KEY) {
  if (dbKey === PRIMARY_DB_KEY) {
    return uniqueEmails([
      env.PRIMARY_SUPER_ADMIN_EMAIL,
      ...FALLBACK_PRIMARY_SUPER_ADMIN_EMAILS,
    ]);
  }

  return uniqueEmails([
    {
      [SECONDARY_DB_KEY]: env.SECONDARY_SUPER_ADMIN_EMAIL,
      [MBA_DB_KEY]: env.MBA_SUPER_ADMIN_EMAIL,
      [BBA_DB_KEY]: env.BBA_SUPER_ADMIN_EMAIL,
    }[dbKey],
  ]);
}

export function isSuperAdminEmail(email, dbKey = PRIMARY_DB_KEY) {
  const normalizedEmail = normalizeEmail(email);
  return Boolean(normalizedEmail && getSuperAdminEmails(dbKey).includes(normalizedEmail));
}
