import { z } from 'zod';

const objectId = z.string().trim().regex(/^[0-9a-fA-F]{24}$/, 'Select a valid group');

export const studentInputSchema = z.object({
  name: z.string().trim().min(2).max(120),
  studentId: z.string().trim().min(2).max(60).regex(/^[A-Za-z0-9_/-]+$/, 'Student ID contains unsupported characters'),
  email: z.string().trim().email().max(180),
  groupIds: z.array(objectId).max(10).default([]),
  groupCoordinatorName: z.string().trim().max(120).default(''),
  groupCoordinatorMobile: z.string().trim().max(30).default(''),
});
