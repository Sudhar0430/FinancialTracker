const express = require('express');
const auth = require('../middleware/auth');
const TaxPlan = require('../models/TaxPlan');

const router = express.Router();
router.use(auth);

router.get('/', async (req, res) => {
  const plans = await TaxPlan.find({ user: req.userId }).sort({ createdAt: -1 });
  res.json(plans);
});

router.post('/', async (req, res) => {
  try {
    const plan = await TaxPlan.create({ ...req.body, user: req.userId });
    res.status(201).json(plan);
  } catch (err) {
    res.status(400).json({ message: 'Failed to save tax plan.', error: err.message });
  }
});

module.exports = router;
