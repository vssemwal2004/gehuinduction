import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

export const USER_ROLES = ['admin', 'group_coordinator', 'scan_coordinator'];

export const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 120 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
  mobile: { type: String, trim: true, maxlength: 30 },
  passwordHash: { type: String, required: true, select: false },
  role: { type: String, enum: USER_ROLES, required: true, index: true },
  groupIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Group' }],
  isActive: { type: Boolean, default: true, index: true },
  lastLoginAt: Date,
}, { timestamps: true });

userSchema.methods.verifyPassword = function verifyPassword(password) {
  return bcrypt.compare(password, this.passwordHash);
};

userSchema.statics.hashPassword = function hashPassword(password) {
  return bcrypt.hash(password, 12);
};

export default mongoose.model('User', userSchema);
