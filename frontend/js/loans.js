requireAuth();

let allLoans = [];
let loanCharts = {};
let currentPeriod = 'monthly';
let paymentTargetLoanId = null;

document.addEventListener('DOMContentLoaded', async () => {
  const content = renderShell('loans.html');
  content.appendChild(document.getElementById('tpl').content.cloneNode(true));

  document.getElementById('loanStartDate').value = new Date().toISOString().slice(0, 10);
  document.getElementById('paymentDate').value = new Date().toISOString().slice(0, 10);
  wireControls();
  await loadLoans();
});

async function loadLoans() {
  try { allLoans = await api.get('/loans'); }
  catch (err) { showToast(err.message, 'error'); allLoans = []; }
  calculateStats();
  renderLoansList();
  renderLoanDistributionChart();
  renderInterestPrincipalChart();
  switchPaymentPeriod(currentPeriod);
  buildAmortizationSelect();
}

function wireControls() {
  document.getElementById('openLoanBtn').addEventListener('click', () => { document.getElementById('loan-form').reset(); document.getElementById('loanStartDate').value = new Date().toISOString().slice(0, 10); document.getElementById('loan-modal').hidden = false; });
  document.getElementById('loanModalClose').addEventListener('click', () => document.getElementById('loan-modal').hidden = true);
  document.getElementById('loanCancelBtn').addEventListener('click', () => document.getElementById('loan-modal').hidden = true);
  document.getElementById('loan-form').addEventListener('submit', handleLoanSubmit);

  document.getElementById('compare-loans-btn').addEventListener('click', compareLoans);

  document.querySelectorAll('.time-period-toggle .tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.time-period-toggle .tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      switchPaymentPeriod(btn.dataset.period);
    });
  });

  document.getElementById('amortizationLoanSelect').addEventListener('change', (e) => selectLoanForAmortization(e.target.value));

  document.getElementById('paymentModalClose').addEventListener('click', () => document.getElementById('payment-modal').hidden = true);
  document.getElementById('paymentCancelBtn').addEventListener('click', () => document.getElementById('payment-modal').hidden = true);
  document.getElementById('payment-form').addEventListener('submit', handlePaymentSubmit);
  document.getElementById('paymentAmount').addEventListener('input', showExtraPaymentImpact);
  document.getElementById('paymentType').addEventListener('change', showExtraPaymentImpact);
}

async function handleLoanSubmit(event) {
  event.preventDefault();
  const payload = {
    name: document.getElementById('loanName').value.trim(),
    type: document.getElementById('loanType').value,
    amount: parseFloat(document.getElementById('loanAmount').value),
    interestRate: parseFloat(document.getElementById('loanRate').value),
    termMonths: parseInt(document.getElementById('loanTerm').value),
    startDate: document.getElementById('loanStartDate').value,
    paymentFrequency: document.getElementById('loanFrequency').value
  };
  try {
    await api.post('/loans', payload);
    showToast('Loan added.');
    document.getElementById('loan-modal').hidden = true;
    await loadLoans();
  } catch (err) { showToast(err.message, 'error'); }
}

function calculateStats() {
  const totalOwed = allLoans.reduce((s, l) => s + (l.remainingBalance ?? l.amount), 0);
  document.getElementById('total-loans').textContent = allLoans.length;
  document.getElementById('total-owed').textContent = formatCurrency(totalOwed);
  // total interest across all loans requires each loan's schedule — fetched lazily below
  Promise.all(allLoans.map(l => api.get(`/loans/${l._id}/amortization`).catch(() => ({ schedule: [] }))))
    .then(results => {
      const totalInterest = results.reduce((s, r) => s + r.schedule.reduce((si, row) => si + row.interest, 0), 0);
      document.getElementById('total-interest').textContent = formatCurrency(totalInterest);
    });
}

function renderLoansList() {
  const container = document.getElementById('loans-list');
  if (allLoans.length === 0) {
    container.innerHTML = `<div class="empty-state"><div class="display">No loans yet</div>Add one to start tracking payoff progress.</div>`;
    return;
  }
  container.innerHTML = `<div class="table-wrap"><table>
    <thead><tr><th>Name</th><th>Type</th><th>Remaining Balance</th><th>Rate</th><th>Payoff Date</th><th></th></tr></thead>
    <tbody>
      ${allLoans.map(l => {
        const payoff = new Date(l.startDate); payoff.setMonth(payoff.getMonth() + l.termMonths);
        return `<tr>
          <td>${escapeHtml(l.name)}</td>
          <td>${l.type}</td>
          <td class="mono">${formatCurrency(l.remainingBalance ?? l.amount)}</td>
          <td>${l.interestRate}%</td>
          <td>${formatDate(payoff)}</td>
          <td>
            <button class="btn btn-outline btn-sm" onclick="selectLoanForAmortization('${l._id}')">View Amortization</button>
            <button class="btn btn-brass btn-sm" onclick="openPaymentModal('${l._id}')">Record Payment</button>
            <button class="icon-btn" onclick="deleteLoan('${l._id}')" title="Delete">${trashIcon()}</button>
          </td>
        </tr>`;
      }).join('')}
    </tbody></table></div>`;
}

function renderLoanDistributionChart() {
  if (loanCharts.dist) loanCharts.dist.destroy();
  loanCharts.dist = new Chart(document.getElementById('loan-distribution-chart'), {
    type: 'doughnut',
    data: { labels: allLoans.length ? allLoans.map(l => l.name) : ['No data'], datasets: [{ data: allLoans.length ? allLoans.map(l => l.remainingBalance ?? l.amount) : [1], backgroundColor: ['#B4933D','#1B5E4B','#A8493E','#4C6FA8','#9C5B8C','#557A99'] }] },
    options: { cutout: '60%', plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 11 } } } } }
  });
}

async function renderInterestPrincipalChart() {
  if (loanCharts.ip) loanCharts.ip.destroy();
  const results = await Promise.all(allLoans.map(l => api.get(`/loans/${l._id}/amortization`).catch(() => ({ schedule: [] }))));
  const totalPrincipal = allLoans.reduce((s, l) => s + l.amount, 0);
  const totalInterest = results.reduce((s, r) => s + r.schedule.reduce((si, row) => si + row.interest, 0), 0);
  loanCharts.ip = new Chart(document.getElementById('interest-principal-chart'), {
    type: 'pie',
    data: { labels: ['Principal', 'Interest'], datasets: [{ data: [totalPrincipal, totalInterest], backgroundColor: ['#1B5E4B', '#A8493E'] }] },
    options: { plugins: { legend: { position: 'bottom' } } }
  });
}

async function compareLoans() {
  const loan1 = { amount: parseFloat(document.getElementById('compare-amount1').value), rate: parseFloat(document.getElementById('compare-rate1').value), term: parseInt(document.getElementById('compare-term1').value) };
  const loan2 = { amount: parseFloat(document.getElementById('compare-amount2').value), rate: parseFloat(document.getElementById('compare-rate2').value), term: parseInt(document.getElementById('compare-term2').value) };
  if (!loan1.amount || !loan1.rate || !loan1.term || !loan2.amount || !loan2.rate || !loan2.term) {
    showToast('Fill in both loan options completely.', 'error'); return;
  }
  try {
    const result = await api.post('/loans/compare', { loan1, loan2 });
    document.getElementById('comparison-results').innerHTML = `
      <div class="grid grid-2">
        <div class="card"><div class="card-title">Option A</div>
          <div>Monthly payment: <strong class="mono">${formatCurrency(result.loan1.monthlyPayment)}</strong></div>
          <div>Total interest: <strong class="mono">${formatCurrency(result.loan1.totalInterest)}</strong></div>
        </div>
        <div class="card"><div class="card-title">Option B</div>
          <div>Monthly payment: <strong class="mono">${formatCurrency(result.loan2.monthlyPayment)}</strong></div>
          <div>Total interest: <strong class="mono">${formatCurrency(result.loan2.totalInterest)}</strong></div>
        </div>
      </div>
      <p class="hint" style="margin-top:10px;">${result.loan1.totalInterest < result.loan2.totalInterest ? 'Option A' : 'Option B'} costs less in total interest.</p>`;
  } catch (err) { showToast(err.message, 'error'); }
}

async function switchPaymentPeriod(period) {
  currentPeriod = period;
  const results = await Promise.all(allLoans.map(l => api.get(`/loans/${l._id}/amortization`).catch(() => ({ schedule: [] }))));
  const now = new Date();
  let principal = 0, interest = 0;

  results.forEach(r => {
    let rows = r.schedule;
    if (period === 'monthly') rows = rows.filter(row => { const d = new Date(row.date); return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth(); });
    else if (period === 'yearly') rows = rows.filter(row => new Date(row.date).getFullYear() === now.getFullYear());
    principal += rows.reduce((s, row) => s + row.principal, 0);
    interest += rows.reduce((s, row) => s + row.interest, 0);
  });

  document.getElementById('principal-remaining').textContent = formatCurrency(principal);
  document.getElementById('interest-remaining').textContent = formatCurrency(interest);
  document.getElementById('total-remaining').textContent = formatCurrency(principal + interest);
}

function buildAmortizationSelect() {
  const sel = document.getElementById('amortizationLoanSelect');
  sel.innerHTML = `<option value="">No loan selected</option>` + allLoans.map(l => `<option value="${l._id}">${l.name}</option>`).join('');
}

async function selectLoanForAmortization(loanId) {
  document.getElementById('amortizationLoanSelect').value = loanId;
  const tbody = document.getElementById('amortization-table');
  if (!loanId) { tbody.innerHTML = `<tr class="empty-row"><td colspan="6">No loan selected</td></tr>`; return; }
  tbody.innerHTML = `<tr class="empty-row"><td colspan="6">Loading…</td></tr>`;
  try {
    const { schedule } = await api.get(`/loans/${loanId}/amortization`);
    tbody.innerHTML = schedule.map(row => `<tr>
      <td>${row.paymentNum}</td><td>${formatDate(row.date)}</td>
      <td style="text-align:right;" class="mono">${formatCurrency(row.payment)}</td>
      <td style="text-align:right;" class="mono">${formatCurrency(row.principal)}</td>
      <td style="text-align:right;" class="mono">${formatCurrency(row.interest)}</td>
      <td style="text-align:right;" class="mono">${formatCurrency(row.balance)}</td>
    </tr>`).join('');
  } catch (err) { tbody.innerHTML = `<tr class="empty-row"><td colspan="6">Failed to load schedule.</td></tr>`; }
}

function openPaymentModal(loanId) {
  paymentTargetLoanId = loanId;
  document.getElementById('payment-form').reset();
  document.getElementById('paymentDate').value = new Date().toISOString().slice(0, 10);
  document.getElementById('extraImpactPreview').style.display = 'none';
  document.getElementById('payment-modal').hidden = false;
}

function showExtraPaymentImpact() {
  const type = document.getElementById('paymentType').value;
  const amount = parseFloat(document.getElementById('paymentAmount').value);
  const preview = document.getElementById('extraImpactPreview');
  if (type === 'extra' && amount > 0) {
    const loan = allLoans.find(l => l._id === paymentTargetLoanId);
    if (loan) {
      const monthlyRate = loan.interestRate / 100 / 12;
      const estInterestSaved = amount * monthlyRate * 12; // rough one-year estimate, refined server-side via real schedule
      preview.textContent = `Applying this now could save roughly ${formatCurrency(estInterestSaved)} in interest over the next year and shorten your payoff timeline.`;
      preview.style.display = 'block';
    }
  } else {
    preview.style.display = 'none';
  }
}

async function handlePaymentSubmit(event) {
  event.preventDefault();
  const payload = {
    amount: parseFloat(document.getElementById('paymentAmount').value),
    date: document.getElementById('paymentDate').value,
    type: document.getElementById('paymentType').value,
    notes: document.getElementById('paymentNotes').value.trim()
  };
  try {
    await api.post(`/loans/${paymentTargetLoanId}/payments`, payload);
    showToast('Payment recorded.');
    document.getElementById('payment-modal').hidden = true;
    await loadLoans();
  } catch (err) { showToast(err.message, 'error'); }
}

async function deleteLoan(id) {
  if (!confirm('Delete this loan and its payment history?')) return;
  try { await api.del(`/loans/${id}`); showToast('Loan deleted.'); await loadLoans(); }
  catch (err) { showToast(err.message, 'error'); }
}

function escapeHtml(str) { const div = document.createElement('div'); div.textContent = str; return div.innerHTML; }
function trashIcon() { return '<svg viewBox="0 0 24 24"><polyline points="3,6 5,6 21,6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>'; }
