const mongoose = require('mongoose');

const GoalSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  title: { type: String, required: true },
  target: { type: Number, required: true },
  saved: { type: Number, default: 0 },
  date: { type: Date },        // target date
  priority: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
  tag: { type: String, default: '💰' },
  note: { type: String },
  completed: { type: Boolean, default: false },
  completedAt: { type: Date }
}, { timestamps: true });

module.exports = mongoose.model('Goal', GoalSchema);
