import mongoose from 'mongoose';

export const groupSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 120 },
  code: { type: String, required: true, unique: true, uppercase: true, trim: true },
  whatsappLink: { type: String, trim: true, maxlength: 500 },
  coordinatorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
  isActive: { type: Boolean, default: true, index: true },
}, { timestamps: true });

export default mongoose.model('Group', groupSchema);
