import mongoose from 'mongoose';

const activityLogSchema = new mongoose.Schema({
  actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  actorName: { type: String, maxlength: 120 },
  actorRole: { type: String, maxlength: 40, index: true },
  action: { type: String, required: true, maxlength: 20, index: true },
  resource: { type: String, required: true, maxlength: 180, index: true },
  statusCode: { type: Number, required: true },
  ip: { type: String, maxlength: 80 },
  userAgent: { type: String, maxlength: 300 },
}, { timestamps: true });

activityLogSchema.index({ createdAt: -1 });
export default mongoose.model('ActivityLog', activityLogSchema);
