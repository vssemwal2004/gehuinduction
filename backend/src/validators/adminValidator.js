import { z } from 'zod';
import { ADMIN_PERMISSIONS } from '../config/adminPermissions.js';

export const adminInputSchema = z.object({
  name: z.string().trim().min(2, 'Name is required').max(120),
  email: z.string().trim().email().max(180),
  isSuperAdmin: z.boolean().default(false),
  permissions: z.array(z.enum(ADMIN_PERMISSIONS)).default([]),
});
