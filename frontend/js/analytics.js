requireAuth();

let allTxA = [];
let charts = {};

document.addEventListener('DOMContentLoaded', async () => {
  const content = renderShell('analytics.html');
  content.appendChild(document.getElementById('tpl').content.cloneNode(true));

  try {
    allTxA = await api.get('/transactions');
  } catch (err) {
    showToast(err.message, 'error');
    allTxA = [];
  }

  buildYearSelector();
  document.getElementById('yearSelector').addEventListener('change', (e) => filterByYear(Number(e.target.value)));
  filterByYear(Number(document.getElementById('yearSelector').value));
});

function buildYearSelector() {
  const years = [...new Set(allTxA.map(t => new Date(t.date).getFullYear()))];
  const thisYear = new Date().getFullYear();
  if (!years.includes(thisYear)) years.push(thisYear);
  years.sort((a, b) => b - a);
  const sel = document.getElementById('yearSelector');
  sel.innerHTML = years.map(y => `<option value="${y}">${y}</option>`).join('');
  sel.value = thisYear;
}

function filterByYear(year) {
  const yearTx = allTxA.filter(t => new Date(t.date).getFullYear() === year);
  const summary = calculateAnnualSummary(yearTx);

  document.getElementById('analytics-total-income').textContent = formatCurrency(summary.income);
  document.getElementById('total-expense').textContent = formatCurrency(summary.expense);
  document.getElementById('net-savings').textContent = formatCurrency(summary.net);
  document.getElementById('savingsRate').textContent = summary.income > 0 ? `${((summary.net / summary.income) * 100).toFixed(1)}%` : '0%';

  const best = findBestSavingMonth(yearTx);
  const worst = findWorstSpendingMonth(yearTx);
  document.getElementById('best-saving-month').textContent = best ? `${best.label} (${formatCurrency(best.net)})` : '—';
  document.getElementById('worst-month-name').textContent = worst ? worst.label : '—';
  document.getElementById('worst-month-amount').textContent = worst ? formatCurrency(worst.expense) : formatCurrency(0);

  renderIncomeExpenseChart(yearTx, year);
  renderTopCategoriesChart(yearTx);
  renderMonthlyTrendChart(yearTx, year);
}

function calculateAnnualSummary(transactions) {
  const income = transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const expense = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  return { income, expense, net: income - expense };
}

const MONTH_LABELS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function monthlyBreakdown(transactions) {
  const months = MONTH_LABELS.map((label, i) => ({ label, income: 0, expense: 0 }));
  transactions.forEach(t => {
    const m = new Date(t.date).getMonth();
    if (t.type === 'income') months[m].income += t.amount; else months[m].expense += t.amount;
  });
  return months;
}

function findBestSavingMonth(transactions) {
  const months = monthlyBreakdown(transactions);
  let best = null;
  months.forEach(m => {
    const net = m.income - m.expense;
    if (!best || net > best.net) best = { label: m.label, net };
  });
  return best && best.net !== 0 ? best : null;
}

function findWorstSpendingMonth(transactions) {
  const months = monthlyBreakdown(transactions);
  let worst = null;
  months.forEach(m => {
    if (!worst || m.expense > worst.expense) worst = { label: m.label, expense: m.expense };
  });
  return worst && worst.expense > 0 ? worst : null;
}

function destroyChart(key) { if (charts[key]) { charts[key].destroy(); delete charts[key]; } }

function renderIncomeExpenseChart(transactions, year) {
  const months = monthlyBreakdown(transactions);
  destroyChart('ie');
  charts.ie = new Chart(document.getElementById('incomeExpenseChart'), {
    type: 'bar',
    data: {
      labels: months.map(m => m.label),
      datasets: [
        { label: 'Income', data: months.map(m => m.income), backgroundColor: '#1B5E4B', borderRadius: 4 },
        { label: 'Expense', data: months.map(m => m.expense), backgroundColor: '#A8493E', borderRadius: 4 }
      ]
    },
    options: { responsive: true, plugins: { legend: { position: 'bottom' } }, scales: { x: { grid: { display: false } } } }
  });
}

function renderTopCategoriesChart(transactions) {
  const totals = {};
  transactions.filter(t => t.type === 'expense').forEach(t => { totals[t.category] = (totals[t.category] || 0) + t.amount; });
  const top5 = Object.entries(totals).sort((a, b) => b[1] - a[1]).slice(0, 5);
  destroyChart('top');
  charts.top = new Chart(document.getElementById('topCategoriesChart'), {
    type: 'bar',
    data: {
      labels: top5.length ? top5.map(([id]) => categoryMeta(id).label) : ['No data'],
      datasets: [{ data: top5.length ? top5.map(([, v]) => v) : [0], backgroundColor: top5.length ? top5.map(([id]) => categoryMeta(id).color) : ['#E4E1D8'], borderRadius: 4 }]
    },
    options: { indexAxis: 'y', responsive: true, plugins: { legend: { display: false } } }
  });
}

function renderMonthlyTrendChart(transactions, year) {
  const months = monthlyBreakdown(transactions);
  destroyChart('trend');
  charts.trend = new Chart(document.getElementById('monthlyTrendChart'), {
    type: 'line',
    data: {
      labels: months.map(m => m.label),
      datasets: [
        { label: 'Income', data: months.map(m => m.income), borderColor: '#1B5E4B', tension: .35, pointRadius: 3 },
        { label: 'Expense', data: months.map(m => m.expense), borderColor: '#A8493E', tension: .35, pointRadius: 3 }
      ]
    },
    options: {
      responsive: true,
      plugins: { legend: { position: 'bottom' } },
      onClick: (evt, elements) => {
        if (elements.length) {
          const idx = elements[0].index;
          const monthNum = String(idx + 1).padStart(2, '0');
          window.location.href = `transactions.html?month=${year}-${monthNum}`;
        }
      }
    }
  });
}
