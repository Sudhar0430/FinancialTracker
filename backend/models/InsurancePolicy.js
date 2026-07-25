const mongoose = require('mongoose');

const InsurancePolicySchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  name: { type: String, required: true },
  type: { type: String, required: true }, // health, life, auto, home, etc
  provider: { type: String },
  policyNumber: { type: String },
  startDate: { type: Date },
  endDate: { type: Date, required: true },
  premiumAmount: { type: Number, required: true },
  premiumFrequency: { type: String, enum: ['monthly', 'quarterly', 'half-yearly', 'yearly', 'one-time'], default: 'yearly' },
  coverageAmount: { type: Number, required: true },
  beneficiaries: [{ type: String }],
  notes: { type: String }
}, { timestamps: true });

module.exports = mongoose.model('InsurancePolicy', InsurancePolicySchema);
