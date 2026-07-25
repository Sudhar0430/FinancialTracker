const express = require('express');
const auth = require('../middleware/auth');
const NetWorthSnapshot = require('../models/NetWorthSnapshot');

const router = express.Router();
router.use(auth);

router.get('/', async (req, res) => {
  const snapshots = await NetWorthSnapshot.find({ user: req.userId }).sort({ date: 1 });
  res.json(snapshots);
});

// POST create a new snapshot (called by "Generate Dashboard" — builds trend history over time)
router.post('/', async (req, res) => {
  try {
    const snap = await NetWorthSnapshot.create({ ...req.body, user: req.userId });
    res.status(201).json(snap);
  } catch (err) {
    res.status(400).json({ message: 'Failed to save snapshot.', error: err.message });
  }
});

module.exports = router;
