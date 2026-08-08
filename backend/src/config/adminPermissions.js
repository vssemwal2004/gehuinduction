export const ADMIN_PERMISSIONS = [
  'admins',
  'students',
  'studentQrData',
  'coordinators',
  'groups',
  'activityLogs',
  'settings',
];

export function normalizeAdminPermissions(permissions = []) {
  return [...new Set(permissions)].filter((permission) => ADMIN_PERMISSIONS.includes(permission));
}
