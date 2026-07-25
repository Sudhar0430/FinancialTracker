requireAuth();

let allTransactions = [];
let monthlyChartInstance = null;
let categoryChartInstance = null;
let currentType = 'expense';

document.addEventListener('DOMContentLoaded', async () => {
  const content = renderShell('dashboard.html');
  content.appendChild(document.getElementById('tpl').content.cloneNode(true));

  buildCategoryGrid();
  wireModal();

  const monthSelector = document.getElementById('monthSelector');
  monthSelector.value = new Date().toISOString().slice(0, 7);
  monthSelector.addEventListener('change', () => renderMonthlyChart(monthSelector.value));

  await loadTransactions();
});

async function loadTransactions() {
  try {
    allTransactions = await api.get('/transactions');
  } catch (err) {
    showToast(err.message, 'error');
    allTransactions = [];
  }
  renderAll();
}

function renderAll() {
  calculateSummary();
  renderMonthlyChart(document.getElementById('monthSelector').value);
  renderCategoryChart();
  renderRecentTransactions();
}

// ---------- Summary cards ----------
function calculateSummary() {
  const income = allTransactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const expenses = allTransactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const balance = income - expenses;
  const savingsGoalPct = income > 0 ? Math.max(0, Math.min(100, ((income - expenses) / income) * 100)) : 0;

  document.getElementById('statBalance').textContent = formatCurrency(balance);
  document.getElementById('statIncome').textContent = formatCurrency(income);
  document.getElementById('statExpenses').textContent = formatCurrency(expenses);
  document.getElementById('statSavingsPct').textContent = `${savingsGoalPct.toFixed(1)}%`;
  document.getElementById('statSavingsBar').style.width = `${savingsGoalPct}%`;

  const deltaEl = document.getElementById('statBalanceDelta');
  if (balance >= 0) {
    deltaEl.className = 'stat-delta up';
    deltaEl.textContent = '↑ Positive balance';
  } else {
    deltaEl.className = 'stat-delta down';
    deltaEl.textContent = '↓ Spending exceeds income';
  }
}

// ---------- Monthly chart: daily spend for selected month ----------
function renderMonthlyChart(monthStr) {
  if (!monthStr) return;
  const [year, month] = monthStr.split('-').map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();

  const dailyExpense = new Array(daysInMonth).fill(0);
  const dailyIncome = new Array(daysInMonth).fill(0);

  allTransactions.forEach(t => {
    const d = new Date(t.date);
    if (d.getFullYear() === year && d.getMonth() + 1 === month) {
      const day = d.getDate() - 1;
      if (t.type === 'expense') dailyExpense[day] += t.amount;
      else dailyIncome[day] += t.amount;
    }
  });

  const labels = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const ctx = document.getElementById('monthlyChart');
  if (monthlyChartInstance) monthlyChartInstance.destroy();
  monthlyChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        { label: 'Expenses', data: dailyExpense, borderColor: '#A8493E', backgroundColor: 'rgba(168,73,62,0.08)', tension: 0.35, fill: true, pointRadius: 0 },
        { label: 'Income', data: dailyIncome, borderColor: '#1B5E4B', backgroundColor: 'rgba(27,94,75,0.06)', tension: 0.35, fill: true, pointRadius: 0 }
      ]
    },
    options: {
      responsive: true,
      plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 11 } } } },
      scales: { x: { grid: { display: false } }, y: { grid: { color: '#E4E1D8' } } }
    }
  });
}

// ---------- Category doughnut chart ----------
function renderCategoryChart() {
  const totals = {};
  allTransactions.filter(t => t.type === 'expense').forEach(t => {
    totals[t.category] = (totals[t.category] || 0) + t.amount;
  });
  const entries = Object.entries(totals).sort((a, b) => b[1] - a[1]);
  const ctx = document.getElementById('categoryChart');
  if (categoryChartInstance) categoryChartInstance.destroy();

  if (entries.length === 0) {
    categoryChartInstance = new Chart(ctx, { type: 'doughnut', data: { labels: ['No expenses yet'], datasets: [{ data: [1], backgroundColor: ['#E4E1D8'] }] }, options: { plugins: { legend: { display: false }, tooltip: { enabled: false } } } });
    return;
  }

  categoryChartInstance = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: entries.map(([id]) => categoryMeta(id).label),
      datasets: [{ data: entries.map(([, v]) => v), backgroundColor: entries.map(([id]) => categoryMeta(id).color), borderWidth: 2, borderColor: '#FFFFFF' }]
    },
    options: { responsive: true, cutout: '62%', plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 11 } } } } }
  });
}

// ---------- Recent transactions table ----------
function renderRecentTransactions() {
  const tbody = document.getElementById('recentTxBody');
  const recent = [...allTransactions].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 8);

  if (recent.length === 0) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="5">No transactions yet — add your first one above.</td></tr>`;
    return;
  }

  tbody.innerHTML = recent.map(t => {
    const meta = categoryMeta(t.category);
    const sign = t.type === 'income' ? '+' : '−';
    const cls = t.type === 'income' ? 'amount-pos' : 'amount-neg';
    return `
      <tr>
        <td>${escapeHtml(t.description)}</td>
        <td><span class="category-dot" style="background:${meta.color}"></span>${meta.icon} ${meta.label}</td>
        <td>${formatDate(t.date)}</td>
        <td style="text-align:right;" class="${cls} amount">${sign}${formatCurrency(t.amount).replace('-', '')}</td>
        <td>
          <button class="icon-btn edit" onclick="editTransaction('${t._id}')" title="Edit">${editIcon()}</button>
          <button class="icon-btn" onclick="deleteTransaction('${t._id}')" title="Delete">${trashIcon()}</button>
        </td>
      </tr>`;
  }).join('');
}

// ---------- Modal ----------
function buildCategoryGrid() {
  const grid = document.getElementById('categoryGrid');
  grid.innerHTML = allCategories().map(c =>
    `<button type="button" class="category-option" data-id="${c.id}" data-type="${CATEGORIES.income.includes(c) ? 'income' : 'expense'}">${c.icon} ${c.label}</button>`
  ).join('');
  grid.querySelectorAll('.category-option').forEach(el => {
    el.addEventListener('click', () => {
      grid.querySelectorAll('.category-option').forEach(o => o.classList.remove('selected'));
      el.classList.add('selected');
      document.getElementById('category').value = el.dataset.id;
    });
  });
  filterCategoryOptions();
}

function filterCategoryOptions() {
  document.querySelectorAll('.category-option').forEach(el => {
    el.hidden = el.dataset.type !== currentType;
  });
}

function wireModal() {
  document.getElementById('openAddBtn').addEventListener('click', () => openTransactionModal());
  document.getElementById('closeModalBtn').addEventListener('click', closeTransactionModal);
  document.getElementById('cancelBtn').addEventListener('click', closeTransactionModal);
  document.getElementById('transactionModal').addEventListener('click', (e) => {
    if (e.target.id === 'transactionModal') closeTransactionModal();
  });

  document.querySelectorAll('.type-tab, .tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentType = btn.dataset.type;
      filterCategoryOptions();
      document.getElementById('category').value = '';
      document.querySelectorAll('.category-option').forEach(o => o.classList.remove('selected'));
    });
  });

  document.getElementById('transactionForm').addEventListener('submit', handleTransactionSubmit);
}

function openTransactionModal(tx = null) {
  const modal = document.getElementById('transactionModal');
  const form = document.getElementById('transactionForm');
  form.reset();
  document.querySelectorAll('.category-option').forEach(o => o.classList.remove('selected'));
  document.getElementById('formError').style.display = 'none';

  if (tx) {
    document.getElementById('modalTitle').textContent = 'Edit Transaction';
    document.getElementById('txId').value = tx._id;
    document.getElementById('description').value = tx.description;
    document.getElementById('amount').value = tx.amount;
    document.getElementById('date').value = new Date(tx.date).toISOString().slice(0, 10);
    currentType = tx.type;
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.type === tx.type));
    filterCategoryOptions();
    document.getElementById('category').value = tx.category;
    const opt = document.querySelector(`.category-option[data-id="${tx.category}"]`);
    if (opt) opt.classList.add('selected');
  } else {
    document.getElementById('modalTitle').textContent = 'Add Transaction';
    document.getElementById('txId').value = '';
    document.getElementById('date').value = new Date().toISOString().slice(0, 10);
    currentType = 'expense';
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.type === 'expense'));
    filterCategoryOptions();
  }
  modal.hidden = false;
}

function closeTransactionModal() {
  document.getElementById('transactionModal').hidden = true;
}

async function handleTransactionSubmit(event) {
  event.preventDefault();
  const errorEl = document.getElementById('formError');
  errorEl.style.display = 'none';

  const description = document.getElementById('description').value.trim();
  const amount = parseFloat(document.getElementById('amount').value);
  const category = document.getElementById('category').value;
  const date = document.getElementById('date').value;
  const id = document.getElementById('txId').value;

  if (!description || !amount || amount <= 0 || !category || !date) {
    errorEl.textContent = 'Please fill in description, a valid amount, a category, and a date.';
    errorEl.style.display = 'block';
    return;
  }

  const payload = { type: currentType, description, amount, category, date };
  const btn = document.getElementById('saveTxBtn');
  btn.disabled = true; btn.textContent = 'Saving…';

  try {
    if (id) {
      await api.put(`/transactions/${id}`, payload);
      showToast('Transaction updated.');
    } else {
      await api.post('/transactions', payload);
      showToast('Transaction added.');
    }
    closeTransactionModal();
    await loadTransactions();
  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.style.display = 'block';
  } finally {
    btn.disabled = false; btn.textContent = 'Save Transaction';
  }
}

async function editTransaction(id) {
  const tx = allTransactions.find(t => t._id === id);
  if (tx) openTransactionModal(tx);
}

async function deleteTransaction(id) {
  if (!confirm('Delete this transaction? This cannot be undone.')) return;
  try {
    await api.del(`/transactions/${id}`);
    showToast('Transaction deleted.');
    await loadTransactions();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
function editIcon() { return '<svg viewBox="0 0 24 24"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>'; }
function trashIcon() { return '<svg viewBox="0 0 24 24"><polyline points="3,6 5,6 21,6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>'; }
