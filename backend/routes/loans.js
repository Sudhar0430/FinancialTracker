const express = require('express');
const auth = require('../middleware/auth');
const Loan = require('../models/Loan');

const router = express.Router();
router.use(auth);

// M = P * r(1+r)^n / ((1+r)^n - 1)
function calculateMonthlyPayment(principal, annualRatePct, termMonths) {
  const r = annualRatePct / 100 / 12;
  if (r === 0) return principal / termMonths;
  const factor = Math.pow(1 + r, termMonths);
  return (principal * r * factor) / (factor - 1);
}

function generateAmortizationSchedule(loan) {
  const { amount, interestRate, termMonths, startDate, paymentFrequency } = loan;
  const periodsPerYear = paymentFrequency === 'weekly' ? 52 : paymentFrequency === 'biweekly' ? 26 : 12;
  const totalPeriods = paymentFrequency === 'monthly' ? termMonths
    : Math.round(termMonths * (periodsPerYear / 12));
  const r = interestRate / 100 / periodsPerYear;
  const payment = r === 0 ? amount / totalPeriods : (amount * r * Math.pow(1 + r, totalPeriods)) / (Math.pow(1 + r, totalPeriods) - 1);

  const schedule = [];
  let balance = amount;
  const start = new Date(startDate);
  const dayStep = paymentFrequency === 'weekly' ? 7 : paymentFrequency === 'biweekly' ? 14 : null;

  for (let i = 1; i <= totalPeriods; i++) {
    const interestPortion = balance * r;
    let principalPortion = payment - interestPortion;
    if (principalPortion > balance) principalPortion = balance;
    balance = Math.max(0, balance - principalPortion);

    const date = new Date(start);
    if (dayStep) date.setDate(date.getDate() + dayStep * i);
    else date.setMonth(date.getMonth() + i);

    schedule.push({
      paymentNum: i,
      date,
      payment: Math.round((principalPortion + interestPortion) * 100) / 100,
      principal: Math.round(principalPortion * 100) / 100,
      interest: Math.round(interestPortion * 100) / 100,
      balance: Math.round(balance * 100) / 100
    });
    if (balance <= 0) break;
  }
  return { schedule, monthlyPayment: Math.round(payment * 100) / 100 };
}

router.get('/', async (req, res) => {
  const loans = await Loan.find({ user: req.userId }).sort({ createdAt: -1 });
  res.json(loans);
});

router.post('/', async (req, res) => {
  try {
    const loan = new Loan({ ...req.body, user: req.userId, remainingBalance: req.body.amount });
    await loan.save();
    res.status(201).json(loan);
  } catch (err) {
    res.status(400).json({ message: 'Failed to create loan.', error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  const loan = await Loan.findOneAndDelete({ _id: req.params.id, user: req.userId });
  if (!loan) return res.status(404).json({ message: 'Loan not found.' });
  res.json({ message: 'Deleted.' });
});

// GET amortization schedule for a loan (computed on the fly, not stored — always accurate)
router.get('/:id/amortization', async (req, res) => {
  const loan = await Loan.findOne({ _id: req.params.id, user: req.userId });
  if (!loan) return res.status(404).json({ message: 'Loan not found.' });
  const result = generateAmortizationSchedule(loan);
  res.json(result);
});

// POST record a payment against a loan
router.post('/:id/payments', async (req, res) => {
  const { amount, date, type, notes } = req.body;
  const loan = await Loan.findOne({ _id: req.params.id, user: req.userId });
  if (!loan) return res.status(404).json({ message: 'Loan not found.' });
  if (!amount || amount <= 0) return res.status(400).json({ message: 'Amount must be greater than zero.' });

  loan.payments.unshift({ amount, date: date || new Date(), type: type || 'regular', notes });
  // extra/late payments reduce principal directly
  loan.remainingBalance = Math.max(0, (loan.remainingBalance ?? loan.amount) - amount);
  await loan.save();
  res.json(loan);
});

// POST compare two hypothetical loans (no persistence)
router.post('/compare', (req, res) => {
  const { loan1, loan2 } = req.body;
  const results = [loan1, loan2].map((l) => {
    const monthlyPayment = calculateMonthlyPayment(l.amount, l.rate, l.term);
    const totalPaid = monthlyPayment * l.term;
    const totalInterest = totalPaid - l.amount;
    return { monthlyPayment: Math.round(monthlyPayment * 100) / 100, totalInterest: Math.round(totalInterest * 100) / 100, totalPaid: Math.round(totalPaid * 100) / 100 };
  });
  res.json({ loan1: results[0], loan2: results[1] });
});

module.exports = router;
