import { env } from '../config/env.js';

export const SCAN_EMAIL_TEMPLATE_KEY = 'scan_registration_email';

export const TEMPLATE_VARIABLES = [
  'studentName',
  'studentId',
  'studentEmail',
  'groupName',
  'groupCode',
  'coordinatorName',
  'coordinatorMobile',
  'whatsappLink',
];

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
}

function valueOrFallback(value, fallback) {
  const normalized = String(value ?? '').trim();
  return normalized || fallback;
}

export function templateDataForStudent(student) {
  const group = student.groupIds?.[0];
  return {
    studentName: valueOrFallback(student.name, 'Student'),
    studentId: valueOrFallback(student.studentId, ''),
    studentEmail: valueOrFallback(student.email, ''),
    groupName: valueOrFallback(group?.name || group?.code, 'Not assigned'),
    groupCode: valueOrFallback(group?.code, ''),
    coordinatorName: valueOrFallback(student.groupCoordinatorName || student.groupCoordinatorId?.name, 'Not assigned'),
    coordinatorMobile: valueOrFallback(student.groupCoordinatorMobile || student.groupCoordinatorId?.mobile, 'Not available'),
    whatsappLink: valueOrFallback(group?.whatsappLink, ''),
  };
}

export function sampleTemplateData() {
  return {
    studentName: 'Example Student',
    studentId: 'GEU2026001',
    studentEmail: 'student@example.com',
    groupName: 'Group A',
    groupCode: 'G1',
    coordinatorName: 'Coordinator Name',
    coordinatorMobile: '+91 9999999999',
    whatsappLink: 'https://chat.whatsapp.com/example',
  };
}

function replaceVariables(template, data, { escape = true } = {}) {
  return String(template || '').replace(/\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g, (_match, key) => {
    const value = data[key] ?? '';
    return escape ? escapeHtml(value) : String(value);
  });
}

export function defaultScanEmailContent(data) {
  return {
    subject: 'GEU Induction Programme 2026 — Registration details',
    html: `<p>Hello ${escapeHtml(data.studentName)},</p><p>Your induction registration has been confirmed.</p><p><strong>Group:</strong> ${escapeHtml(data.groupName)}<br><strong>Group coordinator:</strong> ${escapeHtml(data.coordinatorName)}<br><strong>Coordinator contact:</strong> ${escapeHtml(data.coordinatorMobile)}</p>${data.whatsappLink ? `<p><a href="${escapeHtml(data.whatsappLink)}">Join your WhatsApp group</a></p>` : ''}<p>Regards,<br>GEU Induction Programme 2026</p>`,
  };
}

export function defaultCustomTemplate() {
  return {
    subject: 'GEU Induction Programme 2026 — {{groupName}}',
    html: '<p>Hello {{studentName}},</p><p>Your induction registration is confirmed.</p><p><strong>Group:</strong> {{groupName}}<br><strong>Coordinator:</strong> {{coordinatorName}}<br><strong>Contact:</strong> {{coordinatorMobile}}</p><p><a href="{{whatsappLink}}">Join your WhatsApp group</a></p>',
  };
}

export async function getEmailTemplateSetting(models) {
  const setting = await models.EmailTemplateSetting.findOne({ key: SCAN_EMAIL_TEMPLATE_KEY }).lean();
  if (setting) return setting;
  return { key: SCAN_EMAIL_TEMPLATE_KEY, useDefault: true, subject: '', html: '' };
}

export async function renderScanEmail(models, student) {
  const data = templateDataForStudent(student);
  const setting = await getEmailTemplateSetting(models);
  if (setting.useDefault) return defaultScanEmailContent(data);
  const fallback = defaultCustomTemplate();
  return {
    subject: replaceVariables(setting.subject || fallback.subject, data, { escape: false }).slice(0, 200),
    html: replaceVariables(setting.html || fallback.html, data),
  };
}

export function renderTemplatePreview(setting, data = sampleTemplateData()) {
  if (setting.useDefault) return defaultScanEmailContent(data);
  const fallback = defaultCustomTemplate();
  return {
    subject: replaceVariables(setting.subject || fallback.subject, data, { escape: false }).slice(0, 200),
    html: replaceVariables(setting.html || fallback.html, data),
  };
}

export function mailFrom() {
  return env.MAIL_FROM;
}
