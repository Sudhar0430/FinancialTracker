require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');
const buildCrudRouter = require('./routes/crudFactory');

const Transaction = require('./models/Transaction');
const Goal = require('./models/Goal');
const BudgetEntry = require('./models/BudgetEntry');
const Subscription = require('./models/Subscription');
const InsurancePolicy = require('./models/InsurancePolicy');
const Investment = require('./models/Investment');

const app = express();
connectDB();

// CORS — allow your deployed Vercel frontend + local dev
const allowedOrigins = [process.env.CLIENT_URL].filter(Boolean);
   app.use(cors({
     origin: function (origin, callback) {
       const isLocalDev = !origin || /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
       if (isLocalDev || allowedOrigins.includes(origin) || origin.endsWith('.vercel.app')) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));
app.use(express.json());

app.get('/api/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

app.use('/api/auth', require('./routes/auth'));
app.use('/api/settings', require('./routes/settings'));
app.use('/api/transactions', buildCrudRouter(Transaction));
app.use('/api/goals', buildCrudRouter(Goal));
app.use('/api/budget-entries', buildCrudRouter(BudgetEntry));
app.use('/api/subscriptions', buildCrudRouter(Subscription));
app.use('/api/insurance-policies', buildCrudRouter(InsurancePolicy));
app.use('/api/investments', buildCrudRouter(Investment));
app.use('/api/emergency-fund', require('./routes/emergencyFund'));
app.use('/api/loans', require('./routes/loans'));
app.use('/api/net-worth', require('./routes/netWorth'));
app.use('/api/tax-plans', require('./routes/tax'));
app.use('/api/ai-advisor', require('./routes/aiAdvisor'));

app.use((req, res) => res.status(404).json({ message: 'Route not found.' }));
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ message: 'Server error.', error: err.message });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
