const mongoose = require('mongoose');

const SubscriptionSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  name: { type: String, required: true },
  category: { type: String, required: true },
  cost: { type: Number, required: true },
  billingCycle: { type: String, enum: ['monthly', 'yearly', 'weekly'], default: 'monthly' },
  startDate: { type: Date },
  nextBillingDate: { type: Date, required: true },
  autoRenew: { type: Boolean, default: true },
  paymentMethod: { type: String },
  reminderDays: { type: Number, default: 3 },
  status: { type: String, enum: ['active', 'cancelled'], default: 'active' }
}, { timestamps: true });

module.exports = mongoose.model('Subscription', SubscriptionSchema);
