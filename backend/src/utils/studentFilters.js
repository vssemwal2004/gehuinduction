import mongoose from 'mongoose';
import { HttpError } from './httpError.js';

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function studentFilterFromRequest(req) {
  const query = {};
  const search = String(req.query.search || '').trim().slice(0, 120);
  const status = String(req.query.status || '').trim();
  const groupId = String(req.query.groupId || '').trim();
  const importId = String(req.query.importId || '').trim();
  const addedDate = String(req.query.addedDate || '').trim();

  if (search) {
    const pattern = new RegExp(escapeRegex(search), 'i');
    query.$or = [{ name: pattern }, { studentId: pattern }, { email: pattern }];
  }
  if (['not_registered', 'registered', 'inactive'].includes(status)) query.registrationStatus = status;
  if (groupId) {
    if (!mongoose.isValidObjectId(groupId)) throw new HttpError(400, 'Invalid group ID');
    query.groupIds = groupId;
  }
  if (importId) {
    if (!mongoose.isValidObjectId(importId)) throw new HttpError(400, 'Invalid import batch ID');
    query.importJobId = importId;
  }
  if (addedDate) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(addedDate)) throw new HttpError(400, 'Invalid added date');
    const start = new Date(`${addedDate}T00:00:00+05:30`);
    if (Number.isNaN(start.getTime())) throw new HttpError(400, 'Invalid added date');
    query.createdAt = { $gte: start, $lt: new Date(start.getTime() + 24 * 60 * 60 * 1000) };
  }
  return query;
}
