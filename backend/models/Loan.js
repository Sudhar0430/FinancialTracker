const mongoose = require('mongoose');

const PaymentSchema = new mongoose.Schema({
  amount: Number,
  date: { type: Date, default: Date.now },
  type: { type: String, enum: ['regular', 'extra', 'late'], default: 'regular' },
  notes: String
}, { _id: true });

const LoanSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  name: { type: String, required: true },
  type: { type: String, required: true }, // home, auto, personal, student, etc
  amount: { type: Number, required: true },      // principal
  interestRate: { type: Number, required: true }, // annual %
  termMonths: { type: Number, required: true },
  startDate: { type: Date, required: true },
  paymentFrequency: { type: String, enum: ['monthly', 'biweekly', 'weekly'], default: 'monthly' },
  remainingBalance: { type: Number },
  payments: [PaymentSchema]
}, { timestamps: true });

module.exports = mongoose.model('Loan', LoanSchema);
