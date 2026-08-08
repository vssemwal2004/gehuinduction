import { getActiveDatabaseContexts } from '../config/database.js';
import { decryptCredentialPayload } from './credentialService.js';
import { mailFrom, renderScanEmail } from './emailTemplateService.js';
import { transport } from './mailTransport.js';

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
}

function roleLabel(role) {
  if (role === 'scan_coordinator') return 'Scan Coordinator';
  if (role === 'admin') return 'Admin';
  return 'Group Coordinator';
}

async function contentFor(job, models) {
  if (job.type === 'coordinator_credentials') {
    const data = decryptCredentialPayload(job.payloadEncrypted);
    return {
      subject: 'GEU Induction Connect 2026 — Account access',
      html: `<p>Hello ${escapeHtml(data.name)},</p><p>Your account is ready.</p><p><strong>Role:</strong> ${escapeHtml(roleLabel(data.role))}<br><strong>Email:</strong> ${escapeHtml(data.email)}<br><strong>Temporary password:</strong> ${escapeHtml(data.password)}</p><p>Please keep these credentials private.</p>`,
    };
  }
  const student = await models.Student.findById(job.studentId)
    .populate('groupIds', 'name code whatsappLink')
    .populate('groupCoordinatorId', 'name mobile')
    .lean();
  if (!student) throw new Error('Student no longer exists');
  return renderScanEmail(models, student);
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
    await transport.sendMail({ from: mailFrom(), to: job.to, ...content });
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
