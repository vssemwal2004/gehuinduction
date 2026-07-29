import mongoose from 'mongoose';

const importJobSchema = new mongoose.Schema({
  fileName: { type: String, required: true, maxlength: 255 },
  requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  status: { type: String, enum: ['completed', 'rejected', 'failed'], required: true, index: true },
  totalRows: { type: Number, default: 0 },
  importedRows: { type: Number, default: 0 },
  errorRows: { type: Number, default: 0 },
  validationErrors: [{
    row: Number,
    messages: [String],
  }],
}, { timestamps: true });

importJobSchema.index({ createdAt: -1 });
export default mongoose.model('ImportJob', importJobSchema);
