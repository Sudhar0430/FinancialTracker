const express = require('express');
const auth = require('../middleware/auth');
const Transaction = require('../models/Transaction');
const Goal = require('../models/Goal');
const BudgetEntry = require('../models/BudgetEntry');

const router = express.Router();
router.use(auth);

// POST /api/ai-advisor  — builds a financial snapshot and asks an AI model for advice.
// Requires ANTHROPIC_API_KEY in the backend environment. If it's missing, we return
// a clear, honest message instead of failing silently — see README for setup.
router.post('/', async (req, res) => {
  try {
    const [transactions, goals, budgetEntries] = await Promise.all([
      Transaction.find({ user: req.userId }),
      Goal.find({ user: req.userId }),
      BudgetEntry.find({ user: req.userId })
    ]);

    const income = transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const expenses = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    const byCategory = {};
    transactions.filter(t => t.type === 'expense').forEach(t => {
      byCategory[t.category] = (byCategory[t.category] || 0) + t.amount;
    });
    const topCategory = Object.entries(byCategory).sort((a, b) => b[1] - a[1])[0];
    const savingsRate = income > 0 ? ((income - expenses) / income) * 100 : 0;

    const snapshot = {
      income, expenses, savingsRatePct: Math.round(savingsRate * 10) / 10,
      topSpendingCategory: topCategory ? { category: topCategory[0], amount: topCategory[1] } : null,
      activeGoals: goals.filter(g => !g.completed).map(g => ({ title: g.title, progressPct: Math.round((g.saved / g.target) * 100) })),
      goalCount: goals.length
    };

    if (!process.env.ANTHROPIC_API_KEY) {
      return res.status(200).json({
        summary: 'AI insights are not connected yet.',
        insights: ['Add ANTHROPIC_API_KEY to your backend environment variables on Render to enable live AI advice.'],
        advice: 'Once connected, this panel will analyze your real transactions and goals automatically.',
        snapshot
      });
    }

    const prompt = `You are a friendly personal finance advisor. Given this financial snapshot (currency: INR), respond ONLY with strict JSON: {"summary": "1-2 sentence overview", "insights": ["3-4 short bullet insights"], "advice": "2-3 sentences of concrete, actionable advice"}.\n\nSnapshot: ${JSON.stringify(snapshot)}`;

    const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 500,
        messages: [{ role: 'user', content: prompt }]
      })
    });
    const data = await aiRes.json();
    const text = (data.content || []).map(b => b.text || '').join('');
    const clean = text.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);
    res.json({ ...parsed, snapshot });
  } catch (err) {
    res.status(500).json({
      summary: 'Could not generate insights right now.',
      insights: [],
      advice: 'Please try again in a moment.',
      error: err.message
    });
  }
});

module.exports = router;
