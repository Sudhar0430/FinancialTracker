const mongoose = require('mongoose');

const NetWorthSnapshotSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  ageGroup: { type: String },
  cash: { type: Number, default: 0 },
  investments: { type: Number, default: 0 },
  realEstate: { type: Number, default: 0 },
  otherAssets: { type: Number, default: 0 },
  creditCardDebt: { type: Number, default: 0 },
  studentLoans: { type: Number, default: 0 },
  mortgage: { type: Number, default: 0 },
  otherDebts: { type: Number, default: 0 },
  netWorthGoal: { type: Number, default: 0 },
  timeframeMonths: { type: Number, default: 12 },
  date: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.model('NetWorthSnapshot', NetWorthSnapshotSchema);
