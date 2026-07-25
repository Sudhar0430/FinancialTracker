requireAuth();

let allInvestments = [];
let invCharts = {};
let currentInterval = '5min';

document.addEventListener('DOMContentLoaded', async () => {
  const content = renderShell('investments.html');
  content.appendChild(document.getElementById('tpl').content.cloneNode(true));

  wireMarketControls();
  wirePortfolioControls();
  await loadInvestments();
});

// ---------------- Market data (requires ALPHA_VANTAGE_KEY on the backend) ----------------
function wireMarketControls() {
  document.getElementById('searchBtn').addEventListener('click', handleSearch);
  document.getElementById('symbolInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') handleSearch(); });
  document.querySelectorAll('.interval-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.interval-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      handleIntervalChange(btn.dataset.interval);
    });
  });
}

async function handleSearch() {
  const symbol = document.getElementById('symbolInput').value.trim();
  if (!symbol) return;
  // No live market-data key is configured in this build (see README) — we're explicit
  // about that instead of pretending to fetch real data.
  showToast('Live market data requires a backend API key — see the note on this page.', 'error');
}

function handleIntervalChange(interval) {
  currentInterval = interval;
  if (document.getElementById('symbolInput').value.trim()) handleSearch();
}

// ---------------- Portfolio tracker (fully working, backed by MongoDB) ----------------
function wirePortfolioControls() {
  document.getElementById('openInvBtn').addEventListener('click', () => openModal());
  document.getElementById('invModalClose').addEventListener('click', closeModal);
  document.getElementById('invCancelBtn').addEventListener('click', closeModal);
  document.getElementById('investmentModalOverlay').addEventListener('click', (e) => { if (e.target.id === 'investmentModalOverlay') closeModal(); });
  document.getElementById('investmentFormContainer').addEventListener('submit', handleInvestmentSubmit);

  ['investmentsSearchInput', 'investmentTypeFilterSelect', 'investmentSortBySelect'].forEach(id => {
    document.getElementById(id).addEventListener('input', applyInvFilters);
    document.getElementById(id).addEventListener('change', applyInvFilters);
  });
}

async function loadInvestments() {
  try { allInvestments = await api.get('/investments'); }
  catch (err) { showToast(err.message, 'error'); allInvestments = []; }
  calculatePortfolioSummary();
  renderInvestmentsList(allInvestments);
  renderPortfolioAllocationChart();
  renderReturnsChart();
}

function currentValueOf(inv) { return inv.quantity * inv.currentPrice; }
function returnPctOf(inv) { return inv.buyPrice > 0 ? ((inv.currentPrice - inv.buyPrice) / inv.buyPrice) * 100 : 0; }
function daysHeld(inv) { return inv.purchaseDate ? Math.max(0, Math.floor((new Date() - new Date(inv.purchaseDate)) / (1000 * 60 * 60 * 24))) : null; }

function calculatePortfolioSummary() {
  const totalValue = allInvestments.reduce((s, i) => s + currentValueOf(i), 0);
  const stocksValue = allInvestments.filter(i => i.type === 'stock').reduce((s, i) => s + currentValueOf(i), 0);
  const mfValue = allInvestments.filter(i => i.type === 'mutual_fund').reduce((s, i) => s + currentValueOf(i), 0);

  const totalInvested = allInvestments.reduce((s, i) => s + i.quantity * i.buyPrice, 0);
  const weightedReturn = totalInvested > 0
    ? allInvestments.reduce((s, i) => s + (i.quantity * i.buyPrice) * returnPctOf(i), 0) / totalInvested
    : 0;

  document.getElementById('totalPortfolioValueDisplay').textContent = formatCurrency(totalValue);
  document.getElementById('stocksValueDisplay').textContent = formatCurrency(stocksValue);
  document.getElementById('mutualFundsValueDisplay').textContent = formatCurrency(mfValue);
  const returnEl = document.getElementById('annualReturnPercentage');
  returnEl.textContent = `${weightedReturn.toFixed(1)}%`;
  returnEl.style.color = weightedReturn >= 0 ? 'var(--emerald)' : 'var(--rust)';
}

function applyInvFilters() {
  const search = document.getElementById('investmentsSearchInput').value.toLowerCase();
  const type = document.getElementById('investmentTypeFilterSelect').value;
  const sortBy = document.getElementById('investmentSortBySelect').value;
  let list = allInvestments.filter(i => (!search || i.name.toLowerCase().includes(search)) && (!type || i.type === type));
  list.sort((a, b) => {
    if (sortBy === 'value') return currentValueOf(b) - currentValueOf(a);
    if (sortBy === 'return') return returnPctOf(b) - returnPctOf(a);
    if (sortBy === 'date') return new Date(b.purchaseDate || 0) - new Date(a.purchaseDate || 0);
    return a.name.localeCompare(b.name);
  });
  renderInvestmentsList(list);
}

function renderInvestmentsList(list) {
  const container = document.getElementById('investmentsListContainer');
  if (list.length === 0) {
    container.innerHTML = `<div class="empty-state"><div class="display">No holdings yet</div>Add your first investment to start tracking your portfolio.</div>`;
    return;
  }
  container.innerHTML = `<div class="table-wrap"><table>
    <thead><tr><th>Name</th><th>Type</th><th>Qty</th><th>Value</th><th>Return</th><th>Days Held</th><th></th></tr></thead>
    <tbody>
      ${list.map(i => {
        const value = currentValueOf(i);
        const ret = returnPctOf(i);
        const cls = ret >= 0 ? 'amount-pos' : 'amount-neg';
        const held = daysHeld(i);
        return `<tr>
          <td>${escapeHtml(i.name)} ${i.symbol ? `<span class="faint">(${escapeHtml(i.symbol)})</span>` : ''}</td>
          <td style="text-transform:capitalize;">${i.type.replace('_', ' ')}</td>
          <td class="mono">${i.quantity}</td>
          <td class="mono">${formatCurrency(value)}</td>
          <td class="${cls} mono">${ret >= 0 ? '+' : ''}${ret.toFixed(1)}%</td>
          <td class="faint">${held !== null ? `${held}d` : '—'}</td>
          <td>
            <button class="icon-btn edit" onclick="editInvestment('${i._id}')" title="Edit">${editIcon()}</button>
            <button class="icon-btn" onclick="deleteInvestment('${i._id}')" title="Delete">${trashIcon()}</button>
          </td>
        </tr>`;
      }).join('')}
    </tbody></table></div>`;
}

function renderPortfolioAllocationChart() {
  const totals = {};
  allInvestments.forEach(i => { totals[i.type] = (totals[i.type] || 0) + currentValueOf(i); });
  if (invCharts.alloc) invCharts.alloc.destroy();
  const entries = Object.entries(totals);
  invCharts.alloc = new Chart(document.getElementById('portfolioAllocationChartCanvas'), {
    type: 'pie',
    data: { labels: entries.length ? entries.map(e => e[0].replace('_', ' ')) : ['No data'], datasets: [{ data: entries.length ? entries.map(e => e[1]) : [1], backgroundColor: ['#1B5E4B','#B4933D','#4C6FA8','#9C5B8C','#A8493E'] }] },
    options: { plugins: { legend: { position: 'bottom' } } }
  });
}

function renderReturnsChart() {
  if (invCharts.ret) invCharts.ret.destroy();
  invCharts.ret = new Chart(document.getElementById('returnsChartCanvas'), {
    type: 'bar',
    data: {
      labels: allInvestments.length ? allInvestments.map(i => i.name) : ['No data'],
      datasets: [{ data: allInvestments.length ? allInvestments.map(i => returnPctOf(i)) : [0], backgroundColor: allInvestments.map(i => returnPctOf(i) >= 0 ? '#1B5E4B' : '#A8493E'), borderRadius: 4 }]
    },
    options: { indexAxis: 'y', plugins: { legend: { display: false } } }
  });
}

function openModal(inv = null) {
  document.getElementById('investmentFormContainer').reset();
  if (inv) {
    document.getElementById('invModalTitle').textContent = 'Edit Holding';
    document.getElementById('invId').value = inv._id;
    document.getElementById('invType').value = inv.type;
    document.getElementById('invName').value = inv.name;
    document.getElementById('invSymbol').value = inv.symbol || '';
    document.getElementById('invPurchaseDate').value = inv.purchaseDate ? new Date(inv.purchaseDate).toISOString().slice(0, 10) : '';
    document.getElementById('invQuantity').value = inv.quantity;
    document.getElementById('invBuyPrice').value = inv.buyPrice;
    document.getElementById('investmentCurrentPriceInput').value = inv.currentPrice;
    document.getElementById('invBroker').value = inv.broker || '';
    document.getElementById('invCategory').value = inv.category || '';
    document.getElementById('invDividendYield').value = inv.dividendYield || 0;
    document.getElementById('invNotes').value = inv.notes || '';
  } else {
    document.getElementById('invModalTitle').textContent = 'Add Holding';
    document.getElementById('invId').value = '';
  }
  document.getElementById('investmentModalOverlay').hidden = false;
}
function closeModal() { document.getElementById('investmentModalOverlay').hidden = true; }

async function handleInvestmentSubmit(event) {
  event.preventDefault();
  const id = document.getElementById('invId').value;
  const payload = {
    type: document.getElementById('invType').value,
    name: document.getElementById('invName').value.trim(),
    symbol: document.getElementById('invSymbol').value.trim(),
    purchaseDate: document.getElementById('invPurchaseDate').value || null,
    quantity: parseFloat(document.getElementById('invQuantity').value),
    buyPrice: parseFloat(document.getElementById('invBuyPrice').value),
    currentPrice: parseFloat(document.getElementById('investmentCurrentPriceInput').value),
    broker: document.getElementById('invBroker').value.trim(),
    category: document.getElementById('invCategory').value.trim(),
    dividendYield: parseFloat(document.getElementById('invDividendYield').value) || 0,
    notes: document.getElementById('invNotes').value.trim()
  };
  try {
    if (id) await api.put(`/investments/${id}`, payload);
    else await api.post('/investments', payload);
    showToast('Holding saved.');
    closeModal();
    await loadInvestments();
  } catch (err) { showToast(err.message, 'error'); }
}

function editInvestment(id) { const i = allInvestments.find(x => x._id === id); if (i) openModal(i); }
async function deleteInvestment(id) {
  if (!confirm('Delete this holding?')) return;
  try { await api.del(`/investments/${id}`); showToast('Deleted.'); await loadInvestments(); }
  catch (err) { showToast(err.message, 'error'); }
}

function escapeHtml(str) { const div = document.createElement('div'); div.textContent = str; return div.innerHTML; }
function editIcon() { return '<svg viewBox="0 0 24 24"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>'; }
function trashIcon() { return '<svg viewBox="0 0 24 24"><polyline points="3,6 5,6 21,6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>'; }
