const mongoose = require('mongoose');

const EFTransactionSchema = new mongoose.Schema({
  date: { type: Date, default: Date.now },
  type: { type: String, enum: ['deposit', 'withdrawal'], required: true },
  amount: { type: Number, required: true },
  notes: { type: String }
}, { _id: true });

const EmergencyFundSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
  goalAmount: { type: Number, default: 0 },
  monthlyExpenses: { type: Number, default: 0 },
  currentBalance: { type: Number, default: 0 },
  transactions: [EFTransactionSchema]
}, { timestamps: true });

module.exports = mongoose.model('EmergencyFund', EmergencyFundSchema);
