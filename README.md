# Ledgerly — Personal Finance Tracker

A full-stack finance tracker: Node/Express + MongoDB Atlas backend, vanilla HTML/CSS/JS frontend,
15 connected pages (Dashboard, Transactions, Analytics, Goals, Budget Planner, Emergency Fund,
Reports, Loan Manager, Subscription Tracker, Insurance Manager, Net Worth Calculator, Tax
Estimator, AI Advisor, Stocks & Investments, Settings).

Everything below gets you from "zip file" to "live URL you can show your mentor."
Budget **~1.5–2 hours** for the deploy steps if this is your first time with Atlas/Render/Vercel.

---

## 0. What's fully working out of the box vs. what needs a key

| Page | Status |
|---|---|
| Dashboard, Transactions, Analytics, Goals, Budget Planner, Emergency Fund, Reports, Settings | ✅ Fully working, no extra keys needed |
| Loan Manager, Subscription Tracker, Insurance Manager, Net Worth Calculator, Tax Estimator | ✅ Fully working, no extra keys needed |
| AI Advisor | ✅ Works, but shows a placeholder message until you add `ANTHROPIC_API_KEY` (step 5) |
| Stocks & Investments | ✅ Portfolio tracker fully works; **live quote search** needs a free Alpha Vantage key (not wired by default — see note in the page and in `js/investments.js`) |

Every page talks to a real MongoDB database through the Express API — nothing is mocked or
using localStorage for actual data (localStorage is only used for the JWT token and a couple
of small UI preferences).

---

## 1. Local project structure

```
finance-tracker/
├── backend/              → Express API (deploy to Render)
│   ├── models/           → Mongoose schemas
│   ├── routes/           → REST endpoints
│   ├── middleware/auth.js
│   ├── server.js
│   └── .env.example
├── frontend/              → Static site (deploy to Vercel)
│   ├── *.html             → one file per page
│   ├── css/style.css
│   └── js/                → one file per page + shared helpers (api.js, nav.js, config.js)
├── render.yaml
└── README.md   (this file)
```

---

## 2. Set up MongoDB Atlas (free tier)

1. Go to https://www.mongodb.com/cloud/atlas/register and create a free account.
2. Create a new **Project** → then **Build a Database** → choose the **M0 Free** tier → pick any
   region close to you → click **Create**.
3. **Database Access** (left sidebar) → **Add New Database User** → choose a username/password
   (write these down) → give it **Read and write to any database**.
4. **Network Access** (left sidebar) → **Add IP Address** → click **Allow Access from Anywhere**
   (`0.0.0.0/0`). This is fine for a student project; Render's IPs aren't static so this is the
   simplest option.
5. Go back to **Database** → click **Connect** on your cluster → **Drivers** → copy the connection
   string. It looks like:
   ```
   mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
   ```
6. Edit it: replace `<username>` / `<password>` with your real credentials, and insert a database
   name right after `.net/` — e.g.:
   ```
   mongodb+srv://myuser:mypassword@cluster0.xxxxx.mongodb.net/financetracker?retryWrites=true&w=majority
   ```
   Save this full string — you'll paste it into Render in step 4.

---

## 3. Push this project to GitHub

Both Render and Vercel deploy from a GitHub repo.

```bash
cd finance-tracker
git init
git add .
git commit -m "Initial commit: Ledgerly finance tracker"
```

Create a new empty repo on GitHub (no README/gitignore), then:

```bash
git remote add origin https://github.com/<your-username>/<your-repo>.git
git branch -M main
git push -u origin main
```

---

## 4. Deploy the backend to Render

1. Go to https://render.com and sign up / log in (GitHub login is easiest).
2. **New +** → **Web Service** → connect your GitHub repo.
3. Render should detect `render.yaml` and pre-fill settings. If it asks manually, set:
   - **Root Directory:** `backend`
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Instance Type:** Free
4. Under **Environment**, add these variables (Render's free tier auto-generates `JWT_SECRET`
   if you used `render.yaml`; otherwise set it yourself to any long random string):
   - `MONGODB_URI` → the connection string from step 2.6
   - `JWT_SECRET` → any long random string (skip if auto-generated)
   - `CLIENT_URL` → leave blank for now, you'll fill this in after step 5
   - `ANTHROPIC_API_KEY` → optional, only needed for the AI Advisor page (get one at
     https://console.anthropic.com)
5. Click **Create Web Service**. Wait for the build to finish (2–4 minutes). You'll get a URL like:
   ```
   https://finance-tracker-api-xxxx.onrender.com
   ```
6. Test it: visit `https://YOUR-RENDER-URL.onrender.com/api/health` — you should see
   `{"status":"ok", ...}`. If you see a MongoDB connection error instead, double-check your
   `MONGODB_URI` and that Network Access allows `0.0.0.0/0`.

   > Free Render services "sleep" after 15 minutes of inactivity and take ~30–50 seconds to wake
   > up on the next request. That first load after idling will feel slow — this is normal on the
   > free tier, not a bug in your code.

---

## 5. Point the frontend at your backend

Open `frontend/js/config.js` and replace the placeholder with your real Render URL:

```js
const API_BASE = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
  ? 'http://localhost:5000/api'
  : 'https://finance-tracker-api-xxxx.onrender.com/api'; // <-- your real URL here
```

Commit and push this change:
```bash
git add frontend/js/config.js
git commit -m "Point frontend at deployed backend"
git push
```

---

## 6. Deploy the frontend to Vercel

1. Go to https://vercel.com and sign up / log in with GitHub.
2. **Add New** → **Project** → import your repo.
3. Set **Root Directory** to `frontend`.
4. Framework Preset: choose **Other** (this is a static site, no build step needed).
5. Click **Deploy**. You'll get a URL like:
   ```
   https://your-project-name.vercel.app
   ```

---

## 7. Close the loop: allow your Vercel URL in the backend's CORS

1. Go back to Render → your service → **Environment**.
2. Set `CLIENT_URL` to your real Vercel URL (e.g. `https://your-project-name.vercel.app`).
3. Save — Render will redeploy automatically. (The backend also auto-allows any `*.vercel.app`
   domain already, so this step mainly matters if you later add a custom domain.)

---

## 8. Try it end to end

1. Open your Vercel URL.
2. Register a new account.
3. Add a transaction on the Dashboard — confirm it shows up on the Transactions and Analytics
   pages too (they all read from the same MongoDB collection).
4. Try Goals, Budget Planner, Emergency Fund, Loan Manager, etc.

If something doesn't load, open your browser's DevTools → Console/Network tab first — 90% of
issues at this stage are either (a) `config.js` still pointing at `localhost`, or (b) a typo in
`MONGODB_URI`.

---

## 9. Running locally (optional, for further development)

**Backend:**
```bash
cd backend
cp .env.example .env
# edit .env with your real MONGODB_URI and a JWT_SECRET
npm install
npm run dev   # requires nodemon, already in devDependencies
```

**Frontend:** just open `frontend/login.html` directly in a browser, or serve the folder with
any static server, e.g.:
```bash
cd frontend
npx serve .
```
`js/config.js` already falls back to `http://localhost:5000/api` when running on localhost.

---

## 10. Enabling the AI Advisor (optional)

The AI Advisor page works without any setup — it just tells you it's not connected yet. To make
it generate real advice from your data:

1. Get an API key from https://console.anthropic.com.
2. In Render → Environment, add `ANTHROPIC_API_KEY` with that value.
3. Redeploy (Render does this automatically after an env var change). Refresh the AI Advisor page.

---

## 11. Enabling live stock quotes (optional)

The Stocks & Investments page's portfolio tracker is fully wired already. The live "search a
symbol" panel at the top needs a market-data provider:

1. Get a free key at https://www.alphavantage.co/support/#api-key.
2. Add a backend route (`backend/routes/market.js`) that calls Alpha Vantage's
   `TIME_SERIES_INTRADAY` endpoint using that key, mirroring the pattern already used in
   `routes/aiAdvisor.js`.
3. Update `frontend/js/investments.js`'s `handleSearch()` to call that new route instead of
   showing the "not connected" toast.

This is left as a clearly-marked extension point rather than guessed at, since free-tier market
APIs have very different rate limits and response shapes — worth confirming the current one
before wiring it in.

---

## 12. A few notes for your mentor walkthrough

- **Auth:** JWT-based, passwords hashed with bcrypt, every API route scoped to the logged-in
  user via `req.userId` — one user's data is never visible to another.
- **Data model:** Budget Planner intentionally uses its own collection (`BudgetEntry`), separate
  from the main `Transaction` store used everywhere else — this was a deliberate design decision
  called out in `backend/routes/../models/BudgetEntry.js` comments, not an oversight.
- **Amortization math:** computed server-side in `backend/routes/loans.js` on every request
  (not cached), so editing a loan or recording an extra payment is always reflected accurately.
- **Design system:** one shared `frontend/css/style.css` with CSS custom properties, so the
  whole app (light + dark mode) can be retheme'd by editing `:root` variables in one place.

Good luck with the presentation — you've got a real, deployed, working product to show, not a
mockup.
