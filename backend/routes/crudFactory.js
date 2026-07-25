// Generic CRUD route factory — used for straightforward "list of records per user" models
// (Transaction, Goal, BudgetEntry, Subscription, InsurancePolicy, Investment).
// Each route is scoped to req.userId so users can only ever see their own data.
const express = require('express');
const auth = require('../middleware/auth');

function buildCrudRouter(Model) {
  const router = express.Router();
  router.use(auth);

  // GET all records for the logged-in user
  router.get('/', async (req, res) => {
    try {
      const docs = await Model.find({ user: req.userId }).sort({ createdAt: -1 });
      res.json(docs);
    } catch (err) {
      res.status(500).json({ message: 'Failed to fetch records.', error: err.message });
    }
  });

  // POST create
  router.post('/', async (req, res) => {
    try {
      const doc = await Model.create({ ...req.body, user: req.userId });
      res.status(201).json(doc);
    } catch (err) {
      res.status(400).json({ message: 'Failed to create record.', error: err.message });
    }
  });

  // PUT update (only if it belongs to this user)
  router.put('/:id', async (req, res) => {
    try {
      const doc = await Model.findOneAndUpdate(
        { _id: req.params.id, user: req.userId },
        { ...req.body, user: req.userId },
        { new: true, runValidators: true }
      );
      if (!doc) return res.status(404).json({ message: 'Record not found.' });
      res.json(doc);
    } catch (err) {
      res.status(400).json({ message: 'Failed to update record.', error: err.message });
    }
  });

  // DELETE
  router.delete('/:id', async (req, res) => {
    try {
      const doc = await Model.findOneAndDelete({ _id: req.params.id, user: req.userId });
      if (!doc) return res.status(404).json({ message: 'Record not found.' });
      res.json({ message: 'Deleted.', id: req.params.id });
    } catch (err) {
      res.status(500).json({ message: 'Failed to delete record.', error: err.message });
    }
  });

  return router;
}

module.exports = buildCrudRouter;
