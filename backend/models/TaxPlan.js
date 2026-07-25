const mongoose = require('mongoose');

const TaxPlanSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  year: { type: String, required: true },
  regime: { type: String, enum: ['old', 'new'], required: true },
  income: {
    salary: Number, freelance: Number, interest: Number, capitalGains: Number, other: Number
  },
  deductions: {
    section80C: Number, section80D: Number, section80TTA: Number, hra: Number, other: Number
  },
  taxLiability: Number
}, { timestamps: true });

module.exports = mongoose.model('TaxPlan', TaxPlanSchema);
