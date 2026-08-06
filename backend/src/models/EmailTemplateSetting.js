import mongoose from 'mongoose';

export const emailTemplateSettingSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true, default: 'scan_registration_email' },
  useDefault: { type: Boolean, default: true, index: true },
  subject: { type: String, trim: true, maxlength: 200, default: '' },
  html: { type: String, maxlength: 50000, default: '' },
  requireCourse: { type: Boolean, default: false, index: true },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

export default mongoose.model('EmailTemplateSetting', emailTemplateSettingSchema);
