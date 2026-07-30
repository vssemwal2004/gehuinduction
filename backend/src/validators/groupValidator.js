import { z } from 'zod';

const whatsappLinkSchema = z.string().trim().url().max(500).refine((value) => {
  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase();
    return url.protocol === 'https:'
      && (hostname === 'chat.whatsapp.com' || hostname === 'whatsapp.com' || hostname.endsWith('.whatsapp.com'));
  } catch {
    return false;
  }
}, 'Enter a valid HTTPS WhatsApp group link');

export const groupInputSchema = z.object({
  name: z.string().trim().min(2).max(120),
  code: z.string().trim().min(1).max(30).regex(/^[A-Za-z0-9_-]+$/, 'Use letters, numbers, hyphens or underscores only'),
  whatsappLink: whatsappLinkSchema,
  isActive: z.boolean().optional(),
});
