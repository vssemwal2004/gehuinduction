import { z } from 'zod';

export const coordinatorInputSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(180),
  mobile: z.string().trim().min(7).max(30).regex(/^[+0-9 ()-]+$/, 'Enter a valid mobile number'),
  role: z.enum(['group_coordinator', 'scan_coordinator']),
});
