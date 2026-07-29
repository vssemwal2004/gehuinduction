import mongoose from 'mongoose';

const mailJobSchema = new mongoose.Schema({
  type: { type: String, enum: ['scan_details', 'coordinator_credentials'], required: true },
  to: { type: String, required: true, lowercase: true, trim: true },
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', index: true },
  requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  scanEventId: { type: mongoose.Schema.Types.ObjectId, ref: 'ScanEvent' },
  credentialUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  activatePasswordHash: { type: String, select: false },
  status: { type: String, enum: ['queued', 'processing', 'sent', 'failed'], default: 'queued', index: true },
  attempts: { type: Number, default: 0 },
  nextAttemptAt: { type: Date, default: Date.now, index: true },
  lastError: { type: String, maxlength: 1000 },
  sentAt: Date,
  payloadEncrypted: { type: String, select: false },
  expiresAt: { type: Date, index: { expires: 0 } },
}, { timestamps: true });

mailJobSchema.index({ status: 1, createdAt: 1 });
export default mongoose.model('MailJob', mailJobSchema);
