import { z } from 'zod';
import { getRequestModels } from '../config/database.js';
import { HttpError } from '../utils/httpError.js';
import {
  defaultCustomTemplate,
  getEmailTemplateSetting,
  mailFrom,
  renderTemplatePreview,
  sampleTemplateData,
  SCAN_EMAIL_TEMPLATE_KEY,
  TEMPLATE_VARIABLES,
} from '../services/emailTemplateService.js';
import { transport } from '../services/mailTransport.js';

const templateSchema = z.object({
  useDefault: z.boolean(),
  requireCourse: z.boolean().optional().default(false),
  subject: z.string().trim().max(200).optional().default(''),
  html: z.string().max(50000).optional().default(''),
});

const testMailSchema = templateSchema.extend({
  to: z.string().trim().email(),
});

function publicSetting(setting) {
  const fallback = defaultCustomTemplate();
  return {
    useDefault: setting.useDefault !== false,
    subject: setting.subject || fallback.subject,
    html: setting.html || fallback.html,
    requireCourse: setting.requireCourse === true,
    variables: TEMPLATE_VARIABLES,
  };
}

function validateCustomTemplate(data) {
  if (data.useDefault) return;
  if (!data.subject.trim()) throw new HttpError(400, 'Custom email subject is required');
  if (!data.html.trim()) throw new HttpError(400, 'Custom HTML template is required');
}

export async function getEmailTemplate(req, res) {
  const setting = await getEmailTemplateSetting(getRequestModels(req));
  res.json({ setting: publicSetting(setting) });
}

export async function saveEmailTemplate(req, res) {
  const parsed = templateSchema.safeParse(req.body);
  if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message || 'Invalid email template');
  validateCustomTemplate(parsed.data);
  const { EmailTemplateSetting } = getRequestModels(req);
  const setting = await EmailTemplateSetting.findOneAndUpdate(
    { key: SCAN_EMAIL_TEMPLATE_KEY },
    {
      $set: {
        key: SCAN_EMAIL_TEMPLATE_KEY,
        useDefault: parsed.data.useDefault,
        requireCourse: parsed.data.requireCourse,
        subject: parsed.data.subject,
        html: parsed.data.html,
        updatedBy: req.user._id,
      },
    },
    { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
  ).lean();
  res.json({ setting: publicSetting(setting) });
}

export function previewEmailTemplate(req, res) {
  const parsed = templateSchema.safeParse(req.body);
  if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message || 'Invalid email template');
  const preview = renderTemplatePreview(parsed.data, sampleTemplateData());
  res.json({ preview, data: sampleTemplateData() });
}

export async function sendTestEmailTemplate(req, res) {
  const parsed = testMailSchema.safeParse(req.body);
  if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message || 'Invalid test email request');
  validateCustomTemplate(parsed.data);
  const preview = renderTemplatePreview(parsed.data, sampleTemplateData());
  await transport.sendMail({
    from: mailFrom(),
    to: parsed.data.to,
    subject: `[Test] ${preview.subject}`,
    html: preview.html,
  });
  res.status(202).json({ message: 'Test email sent' });
}
