requireAuth();

let fund = null;

document.addEventListener('DOMContentLoaded', async () => {
  const content = renderShell('emergency-fund.html');
  content.appendChild(document.getElementById('tpl').content.cloneNode(true));

  document.getElementById('transaction-date').value = new Date().toISOString().slice(0, 10);
  document.getElementById('update-goals').addEventListener('click', updateGoals);
  document.getElementById('add-funds').addEventListener('click', () => submitFundChange('deposit'));
  document.getElementById('withdraw-funds').addEventListener('click', () => submitFundChange('withdrawal'));

  await loadFund();
});

async function loadFund() {
  try {
    fund = await api.get('/emergency-fund');
  } catch (err) {
    showToast(err.message, 'error');
    fund = { goalAmount: 0, monthlyExpenses: 0, currentBalance: 0, transactions: [] };
  }
  document.getElementById('fund-goal').value = fund.goalAmount || '';
  document.getElementById('monthly-expenses').value = fund.monthlyExpenses || '';
  document.getElementById('current-savings').value = fund.currentBalance || '';
  renderAll();
}

function calculateMonthsCovered(balance, monthlyExpenses) {
  if (!monthlyExpenses) return 0;
  return Math.round((balance / monthlyExpenses) * 10) / 10;
}

function renderAll() {
  const pct = fund.goalAmount > 0 ? Math.min(100, Math.round((fund.currentBalance / fund.goalAmount) * 100)) : 0;
  document.getElementById('progress-bar').style.width = `${pct}%`;
  document.getElementById('progress-percentage').textContent = `${pct}%`;
  document.getElementById('goal-amount-display').textContent = `Goal: ${formatCurrency(fund.goalAmount)}`;
  document.getElementById('current-balance').textContent = formatCurrency(fund.currentBalance);

  const months = calculateMonthsCovered(fund.currentBalance, fund.monthlyExpenses);
  document.getElementById('months-covered').textContent = `${months} months`;
  document.getElementById('lowCoverageWarning').style.display = (fund.monthlyExpenses > 0 && months < 3) ? 'block' : 'none';

  renderTransactionHistory();
}

function renderTransactionHistory() {
  const tbody = document.getElementById('transaction-history');
  const txs = fund.transactions || [];
  if (txs.length === 0) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="4">No transactions yet</td></tr>`;
    return;
  }
  const sorted = [...txs].sort((a, b) => new Date(b.date) - new Date(a.date));
  tbody.innerHTML = sorted.map(t => {
    const cls = t.type === 'deposit' ? 'amount-pos' : 'amount-neg';
    const sign = t.type === 'deposit' ? '+' : '−';
    return `<tr>
      <td>${formatDate(t.date)}</td>
      <td style="text-transform:capitalize;">${t.type}</td>
      <td class="faint">${t.notes ? escapeHtml(t.notes) : '—'}</td>
      <td style="text-align:right;" class="${cls} amount">${sign}${formatCurrency(t.amount).replace('-', '')}</td>
    </tr>`;
  }).join('');
}

async function updateGoals() {
  try {
    fund = await api.put('/emergency-fund/goals', {
      goalAmount: parseFloat(document.getElementById('fund-goal').value) || 0,
      monthlyExpenses: parseFloat(document.getElementById('monthly-expenses').value) || 0,
      currentSavings: parseFloat(document.getElementById('current-savings').value) || 0
    });
    showToast('Goals updated.');
    renderAll();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function submitFundChange(type) {
  const amount = parseFloat(document.getElementById('transaction-amount').value);
  const date = document.getElementById('transaction-date').value;
  const notes = document.getElementById('transaction-notes').value.trim();
  if (!amount || amount <= 0) { showToast('Enter a valid amount.', 'error'); return; }
  if (type === 'withdrawal' && amount > fund.currentBalance) { showToast('Withdrawal exceeds current balance.', 'error'); return; }

  try {
    fund = await api.post('/emergency-fund/transaction', { type, amount, date, notes });
    showToast(type === 'deposit' ? 'Funds added.' : 'Funds withdrawn.');
    document.getElementById('transaction-amount').value = '';
    document.getElementById('transaction-notes').value = '';
    document.getElementById('current-savings').value = fund.currentBalance;
    renderAll();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function escapeHtml(str) { const div = document.createElement('div'); div.textContent = str; return div.innerHTML; }
