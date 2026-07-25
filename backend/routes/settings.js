const express = require('express');
const auth = require('../middleware/auth');
const User = require('../models/User');

const router = express.Router();
router.use(auth);

router.put('/', async (req, res) => {
  try {
    const { name, email, password, currency, darkMode, monthlyIncome } = req.body;
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: 'User not found.' });

    if (name) user.name = name;
    if (email) user.email = email.toLowerCase();
    if (currency) user.currency = currency;
    if (darkMode !== undefined) user.darkMode = darkMode;
    if (monthlyIncome !== undefined) user.monthlyIncome = monthlyIncome;
    if (password) {
      if (password.length < 6) return res.status(400).json({ message: 'Password must be at least 6 characters.' });
      user.password = password; // hashed by pre-save hook
    }
    await user.save();
    res.json({ id: user._id, name: user.name, email: user.email, currency: user.currency, darkMode: user.darkMode, monthlyIncome: user.monthlyIncome });
  } catch (err) {
    res.status(400).json({ message: 'Failed to update settings.', error: err.message });
  }
});

module.exports = router;
