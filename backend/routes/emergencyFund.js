const express = require('express');
const auth = require('../middleware/auth');
const EmergencyFund = require('../models/EmergencyFund');

const router = express.Router();
router.use(auth);

async function getOrCreate(userId) {
  let fund = await EmergencyFund.findOne({ user: userId });
  if (!fund) fund = await EmergencyFund.create({ user: userId });
  return fund;
}

// GET current fund + history
router.get('/', async (req, res) => {
  const fund = await getOrCreate(req.userId);
  res.json(fund);
});

// PUT update goal settings
router.put('/goals', async (req, res) => {
  const { goalAmount, monthlyExpenses, currentSavings } = req.body;
  const fund = await getOrCreate(req.userId);
  if (goalAmount !== undefined) fund.goalAmount = goalAmount;
  if (monthlyExpenses !== undefined) fund.monthlyExpenses = monthlyExpenses;
  if (currentSavings !== undefined) fund.currentBalance = currentSavings;
  await fund.save();
  res.json(fund);
});

// POST add or withdraw funds
router.post('/transaction', async (req, res) => {
  const { type, amount, date, notes } = req.body;
  if (!['deposit', 'withdrawal'].includes(type)) return res.status(400).json({ message: 'Invalid transaction type.' });
  if (!amount || amount <= 0) return res.status(400).json({ message: 'Amount must be greater than zero.' });

  const fund = await getOrCreate(req.userId);
  if (type === 'withdrawal' && amount > fund.currentBalance) {
    return res.status(400).json({ message: 'Withdrawal exceeds current balance.' });
  }
  fund.currentBalance += type === 'deposit' ? amount : -amount;
  fund.transactions.unshift({ type, amount, date: date || new Date(), notes });
  await fund.save();
  res.json(fund);
});

module.exports = router;
