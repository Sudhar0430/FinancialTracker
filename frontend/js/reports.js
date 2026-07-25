requireAuth();

let allTxR = [];
let filteredR = [];

document.addEventListener('DOMContentLoaded', async () => {
  const content = renderShell('reports.html');
  content.appendChild(document.getElementById('tpl').content.cloneNode(true));

  const sel = document.getElementById('report-category-filter');
  allCategories().forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.id; opt.textContent = `${c.icon} ${c.label}`;
    sel.appendChild(opt);
  });

  document.getElementById('apply-report-filter').addEventListener('click', applyReportFilter);
  document.getElementById('download-report-btn').addEventListener('click', downloadReport);

  try { allTxR = await api.get('/transactions'); }
  catch (err) { showToast(err.message, 'error'); allTxR = []; }

  applyReportFilter();
});

// Filter list mixes type-level values ("income"/"expense") with specific categories.
// "income"/"expense" filter by transaction type; anything else filters by exact category.
function applyReportFilter() {
  const categoryVal = document.getElementById('report-category-filter').value;
  const monthVal = document.getElementById('report-date-filter').value;

  filteredR = allTxR.filter(t => {
    let matchesCategory = true;
    if (categoryVal === 'income' || categoryVal === 'expense') matchesCategory = t.type === categoryVal;
    else if (categoryVal) matchesCategory = t.category === categoryVal;

    let matchesMonth = true;
    if (monthVal) {
      const [y, m] = monthVal.split('-').map(Number);
      const d = new Date(t.date);
      matchesMonth = d.getFullYear() === y && d.getMonth() + 1 === m;
    }
    return matchesCategory && matchesMonth;
  });

  updateSummaryText(filteredR, categoryVal, monthVal);
  renderReportTable(filteredR);
}

function updateSummaryText(transactions, categoryVal, monthVal) {
  const monthLabel = monthVal ? new Date(monthVal + '-01').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }) : 'all time';
  const categoryLabel = categoryVal === 'income' ? 'Income' : categoryVal === 'expense' ? 'Expenses' : categoryVal ? categoryMeta(categoryVal).label : 'all categories';
  document.getElementById('report-summary-text').textContent =
    `Showing ${transactions.length} transaction${transactions.length === 1 ? '' : 's'} for ${monthLabel} in ${categoryLabel}.`;
}

function renderReportTable(transactions) {
  const tbody = document.getElementById('report-table-body');
  if (transactions.length === 0) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="5">No transactions match this filter.</td></tr>`;
    document.getElementById('reportTotal').textContent = formatCurrency(0);
    return;
  }
  const sorted = [...transactions].sort((a, b) => new Date(b.date) - new Date(a.date));
  tbody.innerHTML = sorted.map(t => {
    const meta = categoryMeta(t.category);
    const cls = t.type === 'income' ? 'amount-pos' : 'amount-neg';
    const sign = t.type === 'income' ? '+' : '−';
    return `<tr>
      <td>${formatDate(t.date)}</td>
      <td><span class="category-dot" style="background:${meta.color}"></span>${meta.icon} ${meta.label}</td>
      <td>${escapeHtml(t.description)}</td>
      <td style="text-transform:capitalize;">${t.type}</td>
      <td style="text-align:right;" class="${cls} amount">${sign}${formatCurrency(t.amount).replace('-', '')}</td>
    </tr>`;
  }).join('');

  const total = transactions.reduce((s, t) => s + (t.type === 'income' ? t.amount : -t.amount), 0);
  const totalEl = document.getElementById('reportTotal');
  totalEl.textContent = formatCurrency(total);
  totalEl.className = `mono ${total >= 0 ? 'amount-pos' : 'amount-neg'}`;
}

function downloadReport() {
  if (filteredR.length === 0) { showToast('Nothing to export for this filter.', 'error'); return; }
  const rows = [['Date', 'Category', 'Description', 'Type', 'Amount']];
  filteredR.forEach(t => rows.push([formatDate(t.date), categoryMeta(t.category).label, t.description, t.type, t.amount]));
  const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `report_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
}

function escapeHtml(str) { const div = document.createElement('div'); div.textContent = str; return div.innerHTML; }
