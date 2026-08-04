import mongoose from 'mongoose';

export const scanEventSchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true, index: true },
  scannedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  isFirstScan: { type: Boolean, default: false },
  emailTriggered: { type: Boolean, default: false },
}, { timestamps: true });

scanEventSchema.index({ createdAt: -1 });
export default mongoose.model('ScanEvent', scanEventSchema);
