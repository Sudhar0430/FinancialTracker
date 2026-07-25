requireAuth();

let allTx = [];
let filteredTx = [];
let currentType = 'expense';
let sortState = { field: 'date', dir: 'desc' };
let bulkMode = false;
let selectedIds = new Set();

document.addEventListener('DOMContentLoaded', async () => {
  const content = renderShell('transactions.html');
  content.appendChild(document.getElementById('tpl').content.cloneNode(true));

  buildCategoryFilterOptions();
  buildCategoryGrid();
  wireControls();
  wireModal();

  const params = new URLSearchParams(window.location.search);
  const monthParam = params.get('month');

  await loadTransactions();

  if (monthParam) {
    const [y, m] = monthParam.split('-').map(Number);
    filteredTx = allTx.filter(t => { const d = new Date(t.date); return d.getFullYear() === y && d.getMonth() + 1 === m; });
    renderTransactionsTable(filteredTx);
    showToast(`Showing transactions for ${monthParam}`);
  }
});

async function loadTransactions() {
  try {
    allTx = await api.get('/transactions');
  } catch (err) {
    showToast(err.message, 'error');
    allTx = [];
  }
  filterTransactions();
}

function buildCategoryFilterOptions() {
  const sel = document.getElementById('categoryFilter');
  allCategories().forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.id; opt.textContent = `${c.icon} ${c.label}`;
    sel.appendChild(opt);
  });
  const incomeOpt = document.createElement('option'); incomeOpt.value = '__income'; incomeOpt.textContent = 'All Income';
  const expenseOpt = document.createElement('option'); expenseOpt.value = '__expense'; expenseOpt.textContent = 'All Expense';
  sel.insertBefore(expenseOpt, sel.children[1]);
  sel.insertBefore(incomeOpt, sel.children[1]);
}

function wireControls() {
  document.getElementById('applyFiltersBtn').addEventListener('click', filterTransactions);
  document.getElementById('searchInput').addEventListener('input', debounce(filterTransactions, 250));
  document.getElementById('categoryFilter').addEventListener('change', filterTransactions);
  document.getElementById('dateFilter').addEventListener('change', filterTransactions);
  document.getElementById('clearFiltersBtn').addEventListener('click', () => {
    document.getElementById('searchInput').value = '';
    document.getElementById('categoryFilter').value = '';
    document.getElementById('dateFilter').value = '';
    filterTransactions();
  });
  document.querySelectorAll('th.sortable').forEach(th => {
    th.addEventListener('click', () => {
      const field = th.dataset.sort;
      sortState.dir = sortState.field === field && sortState.dir === 'asc' ? 'desc' : 'asc';
      sortState.field = field;
      filterTransactions();
    });
  });
  document.getElementById('exportCsvBtn').addEventListener('click', exportCsv);
  document.getElementById('bulkModeToggle').addEventListener('change', (e) => {
    bulkMode = e.target.checked;
    selectedIds.clear();
    document.getElementById('thCheck').style.display = bulkMode ? '' : 'none';
    document.getElementById('bulkDeleteBtn').style.display = bulkMode ? '' : 'none';
    renderTransactionsTable(filteredTx);
  });
  document.getElementById('bulkDeleteBtn').addEventListener('click', bulkDelete);
}

// ---------- Filtering ----------
function filterTransactions() {
  const search = document.getElementById('searchInput').value.trim().toLowerCase();
  const category = document.getElementById('categoryFilter').value;
  const date = document.getElementById('dateFilter').value;

  filteredTx = allTx.filter(t => {
    const matchesSearch = !search || t.description.toLowerCase().includes(search);
    let matchesCategory = true;
    if (category === '__income') matchesCategory = t.type === 'income';
    else if (category === '__expense') matchesCategory = t.type === 'expense';
    else if (category) matchesCategory = t.category === category;
    const matchesDate = !date || new Date(t.date).toISOString().slice(0, 10) === date;
    return matchesSearch && matchesCategory && matchesDate;
  });

  filteredTx.sort((a, b) => {
    let va = sortState.field === 'amount' ? a.amount : new Date(a.date);
    let vb = sortState.field === 'amount' ? b.amount : new Date(b.date);
    return sortState.dir === 'asc' ? va - vb : vb - va;
  });

  renderTransactionsTable(filteredTx);
}

// ---------- Render ----------
function renderTransactionsTable(transactions) {
  const tbody = document.getElementById('txBody');
  if (transactions.length === 0) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="7">No transactions match these filters.</td></tr>`;
    document.getElementById('filteredTotal').textContent = formatCurrency(0);
    return;
  }

  tbody.innerHTML = transactions.map(t => {
    const meta = categoryMeta(t.category);
    const sign = t.type === 'income' ? '+' : '−';
    const cls = t.type === 'income' ? 'amount-pos' : 'amount-neg';
    return `
      <tr>
        ${bulkMode ? `<td><input type="checkbox" class="row-check" data-id="${t._id}" ${selectedIds.has(t._id) ? 'checked' : ''}></td>` : ''}
        <td>${formatDate(t.date)}</td>
        <td>${escapeHtml(t.description)}</td>
        <td><span class="category-dot" style="background:${meta.color}"></span>${meta.icon} ${meta.label}</td>
        <td style="text-transform:capitalize;">${t.type}</td>
        <td style="text-align:right;" class="${cls} amount">${sign}${formatCurrency(t.amount).replace('-', '')}</td>
        <td>
          <button class="icon-btn edit" onclick="editTransaction('${t._id}')" title="Edit">${editIcon()}</button>
          <button class="icon-btn" onclick="deleteTransaction('${t._id}')" title="Delete">${trashIcon()}</button>
        </td>
      </tr>`;
  }).join('');

  document.querySelectorAll('.row-check').forEach(chk => {
    chk.addEventListener('change', () => {
      if (chk.checked) selectedIds.add(chk.dataset.id); else selectedIds.delete(chk.dataset.id);
    });
  });

  const total = transactions.reduce((s, t) => s + (t.type === 'income' ? t.amount : -t.amount), 0);
  const totalEl = document.getElementById('filteredTotal');
  totalEl.textContent = formatCurrency(total);
  totalEl.className = `mono ${total >= 0 ? 'amount-pos' : 'amount-neg'}`;
}

async function bulkDelete() {
  if (selectedIds.size === 0) { showToast('Select at least one row first.', 'error'); return; }
  if (!confirm(`Delete ${selectedIds.size} transaction(s)? This cannot be undone.`)) return;
  try {
    await Promise.all([...selectedIds].map(id => api.del(`/transactions/${id}`)));
    showToast('Selected transactions deleted.');
    selectedIds.clear();
    await loadTransactions();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function exportCsv() {
  const rows = [['Date', 'Description', 'Category', 'Type', 'Amount']];
  filteredTx.forEach(t => rows.push([formatDate(t.date), t.description, categoryMeta(t.category).label, t.type, t.amount]));
  const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `transactions_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
}

// ---------- Modal (add / edit) ----------
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
  document.querySelectorAll('.category-option').forEach(el => { el.hidden = el.dataset.type !== currentType; });
}

function wireModal() {
  document.getElementById('openAddBtn').addEventListener('click', () => openTransactionModal());
  document.getElementById('closeModalBtn').addEventListener('click', closeTransactionModal);
  document.getElementById('cancelBtn').addEventListener('click', closeTransactionModal);
  document.getElementById('transactionModal').addEventListener('click', (e) => { if (e.target.id === 'transactionModal') closeTransactionModal(); });
  document.querySelectorAll('.tab-btn').forEach(btn => {
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
  document.getElementById('transactionForm').reset();
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
function closeTransactionModal() { document.getElementById('transactionModal').hidden = true; }

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
    if (id) { await api.put(`/transactions/${id}`, payload); showToast('Transaction updated.'); }
    else { await api.post('/transactions', payload); showToast('Transaction added.'); }
    closeTransactionModal();
    await loadTransactions();
  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.style.display = 'block';
  } finally {
    btn.disabled = false; btn.textContent = 'Save Transaction';
  }
}

function editTransaction(id) {
  const tx = allTx.find(t => t._id === id);
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

function debounce(fn, ms) { let t; return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); }; }
function escapeHtml(str) { const div = document.createElement('div'); div.textContent = str; return div.innerHTML; }
function editIcon() { return '<svg viewBox="0 0 24 24"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>'; }
function trashIcon() { return '<svg viewBox="0 0 24 24"><polyline points="3,6 5,6 21,6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>'; }
