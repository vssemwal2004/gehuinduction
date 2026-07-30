import { z } from 'zod';

const objectId = z.string().trim().regex(/^[0-9a-fA-F]{24}$/, 'Select a valid group');

export const studentInputSchema = z.object({
  name: z.string().trim().min(2).max(120),
  studentId: z.string().trim().min(2).max(60).regex(/^[A-Za-z0-9_/-]+$/, 'Student ID contains unsupported characters'),
  email: z.string().trim().email().max(180),
  groupIds: z.array(objectId).min(1, 'Select at least one group').max(10),
  groupCoordinatorName: z.string().trim().min(2).max(120),
  groupCoordinatorMobile: z.string().trim().min(7).max(30).regex(/^[+0-9 ()-]+$/, 'Enter a valid coordinator mobile number'),
});
