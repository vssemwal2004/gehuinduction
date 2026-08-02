import mongoose from 'mongoose';

const studentQrDataSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 120 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
  phone: { type: String, required: true, unique: true, trim: true, maxlength: 30, index: true },
  phoneKey: { type: String, required: true, unique: true, trim: true, index: true },
  qrLink: { type: String, required: true, trim: true, maxlength: 1000 },
  isActive: { type: Boolean, default: true, index: true },
}, { timestamps: true });

studentQrDataSchema.index({ name: 'text', email: 'text', phone: 'text' });
export default mongoose.model('StudentQrData', studentQrDataSchema);
