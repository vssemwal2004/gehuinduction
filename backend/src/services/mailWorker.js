import nodemailer from 'nodemailer';
import { env } from '../config/env.js';
import { getActiveDatabaseContexts } from '../config/database.js';
import { decryptCredentialPayload } from './credentialService.js';

const transport = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  secure: env.SMTP_SECURE,
  auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
  pool: true,
  maxConnections: 2,
  maxMessages: 50,
  rateDelta: 1000,
  rateLimit: 3,
  connectionTimeout: 15_000,
  greetingTimeout: 15_000,
  socketTimeout: 30_000,
});

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
}

async function contentFor(job, models) {
  if (job.type === 'coordinator_credentials') {
    const data = decryptCredentialPayload(job.payloadEncrypted);
    return {
      subject: 'GEU Induction Connect 2026 — Coordinator access',
      html: `<p>Hello ${escapeHtml(data.name)},</p><p>Your coordinator account is ready.</p><p><strong>Role:</strong> ${escapeHtml(data.role === 'scan_coordinator' ? 'Scan Coordinator' : 'Group Coordinator')}<br><strong>Email:</strong> ${escapeHtml(data.email)}<br><strong>Temporary password:</strong> ${escapeHtml(data.password)}</p><p>Please keep these credentials private.</p>`,
    };
  }
  const student = await models.Student.findById(job.studentId)
    .populate('groupIds', 'name code whatsappLink')
    .populate('groupCoordinatorId', 'name mobile')
    .lean();
  if (!student) throw new Error('Student no longer exists');
  const group = student.groupIds?.[0];
  return {
    subject: 'GEU Induction Programme 2026 — Registration details',
    html: `<p>Hello ${escapeHtml(student.name)},</p><p>Your induction registration has been confirmed.</p><p><strong>Group:</strong> ${escapeHtml(group?.name || group?.code || 'Not assigned')}<br><strong>Group coordinator:</strong> ${escapeHtml(student.groupCoordinatorName || student.groupCoordinatorId?.name || 'Not assigned')}<br><strong>Coordinator contact:</strong> ${escapeHtml(student.groupCoordinatorMobile || student.groupCoordinatorId?.mobile || 'Not available')}</p>${group?.whatsappLink ? `<p><a href="${escapeHtml(group.whatsappLink)}">Join your WhatsApp group</a></p>` : ''}<p>Regards,<br>GEU Induction Programme 2026</p>`,
  };
}

async function processOne(models) {
  const now = new Date();
  const job = await models.MailJob.findOneAndUpdate(
    { status: 'queued', nextAttemptAt: { $lte: now } },
    { $set: { status: 'processing' }, $inc: { attempts: 1 } },
    { sort: { createdAt: 1 }, new: true },
  ).select('+payloadEncrypted +activatePasswordHash');
  if (!job) return false;
  try {
    const content = await contentFor(job, models);
    await transport.sendMail({ from: env.MAIL_FROM, to: job.to, ...content });
    if (job.type === 'coordinator_credentials' && job.activatePasswordHash && job.credentialUserId) {
      await models.User.updateOne({ _id: job.credentialUserId, isActive: true }, { $set: { passwordHash: job.activatePasswordHash } });
    }
    job.status = 'sent';
    job.sentAt = new Date();
    job.lastError = undefined;
    job.payloadEncrypted = undefined;
    job.activatePasswordHash = undefined;
    await job.save();
    if (job.scanEventId) await models.ScanEvent.updateOne({ _id: job.scanEventId }, { $set: { emailTriggered: true } });
  } catch (error) {
    const terminal = job.attempts >= 5 || (job.expiresAt && job.expiresAt <= new Date());
    job.status = terminal ? 'failed' : 'queued';
    job.lastError = String(error.message || 'Mail delivery failed').slice(0, 1000);
    job.nextAttemptAt = new Date(Date.now() + Math.min(15 * 60_000, (2 ** job.attempts) * 15_000));
    await job.save();
  }
  return true;
}

let timer;
let running = false;
export function startMailWorker() {
  for (const context of getActiveDatabaseContexts()) {
    context.models.MailJob.updateMany({ status: 'processing', updatedAt: { $lt: new Date(Date.now() - 5 * 60_000) } }, { $set: { status: 'queued', nextAttemptAt: new Date() } }).catch(console.error);
  }
  timer = setInterval(async () => {
    if (running) return;
    running = true;
    try {
      for (const context of getActiveDatabaseContexts()) {
        for (let count = 0; count < 10 && await processOne(context.models); count += 1) { /* bounded batch */ }
      }
    } catch (error) {
      console.error('Mail worker error:', error.message);
    } finally {
      running = false;
    }
  }, 2_000);
  timer.unref();
}
