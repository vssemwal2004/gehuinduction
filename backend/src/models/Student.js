import mongoose from 'mongoose';

const studentSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 120 },
  studentId: { type: String, required: true, unique: true, trim: true, index: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
  groupIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Group', index: true }],
  groupCoordinatorName: { type: String, trim: true, maxlength: 120 },
  groupCoordinatorMobile: { type: String, trim: true, maxlength: 30 },
  groupCoordinatorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  registrationStatus: { type: String, enum: ['not_registered', 'registered', 'inactive'], default: 'not_registered', index: true },
  qrTokenHash: { type: String, required: true, unique: true, select: false },
  qrTokenEncrypted: { type: String, required: true, select: false },
  qrGeneratedAt: { type: Date, default: Date.now },
  qrRevokedAt: Date,
  lastScannedAt: Date,
  scanCount: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true, index: true },
}, { timestamps: true });

studentSchema.index({ name: 'text', email: 'text', studentId: 'text' });
export default mongoose.model('Student', studentSchema);
