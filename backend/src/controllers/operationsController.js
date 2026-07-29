import mongoose from 'mongoose';
import ActivityLog from '../models/ActivityLog.js';
import MailJob from '../models/MailJob.js';
import { HttpError } from '../utils/httpError.js';

export async function listActivityLogs(req, res) {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(10, Number(req.query.limit) || 30));
  const query = {};
  if (req.query.role) query.actorRole = req.query.role;
  if (req.query.action) query.action = req.query.action;
  if (req.query.search) {
    const value = String(req.query.search).slice(0, 120).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    query.$or = [{ actorName: new RegExp(value, 'i') }, { resource: new RegExp(value, 'i') }];
  }
  const [logs, total] = await Promise.all([
    ActivityLog.find(query).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    ActivityLog.countDocuments(query),
  ]);
  res.json({ logs, pagination: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) } });
}

export async function listMailJobs(req, res) {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(10, Number(req.query.limit) || 30));
  const query = {};
  if (req.query.status) query.status = req.query.status;
  if (req.query.type) query.type = req.query.type;
  const [jobs, total, counts] = await Promise.all([
    MailJob.find(query).select('-payloadEncrypted').sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    MailJob.countDocuments(query),
    MailJob.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
  ]);
  res.json({ jobs, counts: Object.fromEntries(counts.map((item) => [item._id, item.count])), pagination: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) } });
}

export async function retryMailJob(req, res) {
  if (!mongoose.isValidObjectId(req.params.jobId)) throw new HttpError(400, 'Invalid mail job ID');
  const job = await MailJob.findOneAndUpdate(
    { _id: req.params.jobId, status: 'failed' },
    { $set: { status: 'queued', attempts: 0, nextAttemptAt: new Date(), lastError: null } },
    { new: true },
  ).select('-payloadEncrypted');
  if (!job) throw new HttpError(404, 'Failed mail job not found');
  res.status(202).json({ job });
}
