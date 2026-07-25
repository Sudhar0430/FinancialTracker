const mongoose = require('mongoose');

const InvestmentSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  type: { type: String, required: true }, // stock, mutual_fund, etc
  name: { type: String, required: true },
  symbol: { type: String },
  purchaseDate: { type: Date },
  quantity: { type: Number, required: true },
  buyPrice: { type: Number, required: true },
  currentPrice: { type: Number, required: true },
  broker: { type: String },
  category: { type: String },
  dividendYield: { type: Number, default: 0 },
  notes: { type: String }
}, { timestamps: true });

module.exports = mongoose.model('Investment', InvestmentSchema);
