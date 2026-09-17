import { z } from 'zod';

export const studentInputSchema = z.object({
  name: z.string().trim().min(2).max(120),
  studentId: z.string().trim().min(2).max(60).regex(/^[A-Za-z0-9_/-]+$/, 'Student ID contains unsupported characters'),
  mobile: z.string().trim().min(7).max(30).regex(/^[+0-9 ()-]+$/, 'Enter a valid mobile number'),
  semester: z.string().trim().min(1).max(40),
  email: z.string().trim().max(180).default(''),
  course: z.string().trim().max(120).default(''),
  groupIds: z.array(z.string()).max(10).default([]),
  groupCoordinatorName: z.string().trim().max(120).default(''),
  groupCoordinatorMobile: z.string().trim().max(30).default(''),
});
