import { z } from 'zod';

export const coordinatorInputSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(180),
  mobile: z.string().trim().max(30).regex(/^[+0-9 ()-]*$/, 'Enter a valid mobile number').default(''),
});
