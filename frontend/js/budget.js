requireAuth();

// NOTE on data model: Budget Planner intentionally tracks its OWN entries (BudgetEntry
// collection) — it is a separate "what-if" planning ledger, distinct from the real
// Transactions store used by Dashboard/Transactions/Analytics. This is by design (see
// project brief §5) so future pages should not assume they share data.

let budgetEntries = [];
let currentBudgetType = 'expense';

document.addEventListener('DOMContentLoaded', async () => {
  const content = renderShell('budget.html');
  content.appendChild(document.getElementById('tpl').content.cloneNode(true));

  buildCategorySelect();
  wireModal();
  await loadEntries();
});

async function loadEntries() {
  try {
    budgetEntries = await api.get('/budget-entries');
  } catch (err) {
    showToast(err.message, 'error');
    budgetEntries = [];
  }
  renderBudgetEntries();
  calculateBudgetSummary();
}

function calculateBudgetSummary() {
  const income = budgetEntries.filter(e => e.type === 'income').reduce((s, e) => s + e.amount, 0);
  const expenses = budgetEntries.filter(e => e.type === 'expense').reduce((s, e) => s + e.amount, 0);
  document.getElementById('total-income').textContent = formatCurrency(income);
  document.getElementById('total-expenses').textContent = formatCurrency(expenses);
  document.getElementById('net-balance').textContent = formatCurrency(income - expenses);
}

function renderBudgetEntries() {
  const container = document.getElementById('budget-entries');
  if (budgetEntries.length === 0) {
    container.innerHTML = `<div class="empty-state"><div class="display">No entries yet</div>Add your first budget entry above.</div>`;
    return;
  }
  const sorted = [...budgetEntries].sort((a, b) => new Date(b.date) - new Date(a.date));
  container.innerHTML = `
    <div class="table-wrap"><table>
      <thead><tr><th>Date</th><th>Category</th><th>Note</th><th style="text-align:right;">Amount</th><th></th></tr></thead>
      <tbody>
        ${sorted.map(e => {
          const meta = categoryMeta(e.category);
          const cls = e.type === 'income' ? 'amount-pos' : 'amount-neg';
          const sign = e.type === 'income' ? '+' : '−';
          return `<tr>
            <td>${formatDate(e.date)}</td>
            <td><span class="category-dot" style="background:${meta.color}"></span>${meta.icon} ${meta.label}</td>
            <td class="faint">${e.note ? escapeHtml(e.note) : '—'}</td>
            <td style="text-align:right;" class="${cls} amount">${sign}${formatCurrency(e.amount).replace('-', '')}</td>
            <td><button class="icon-btn" onclick="deleteBudgetEntry('${e._id}')" title="Delete">${trashIcon()}</button></td>
          </tr>`;
        }).join('')}
      </tbody>
    </table></div>`;
}

function buildCategorySelect() {
  const sel = document.getElementById('budgetCategory');
  function refresh() {
    sel.innerHTML = CATEGORIES[currentBudgetType].map(c => `<option value="${c.id}">${c.icon} ${c.label}</option>`).join('');
  }
  refresh();
  sel.dataset.refresh = 'true';
  window.__refreshBudgetCategories = refresh;
}

function wireModal() {
  document.getElementById('openBudgetBtn').addEventListener('click', openBudgetModal);
  document.getElementById('budgetModalClose').addEventListener('click', closeBudgetModal);
  document.getElementById('budgetCancelBtn').addEventListener('click', closeBudgetModal);
  document.getElementById('budget-modal').addEventListener('click', (e) => { if (e.target.id === 'budget-modal') closeBudgetModal(); });
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentBudgetType = btn.dataset.type;
      window.__refreshBudgetCategories();
    });
  });
  document.getElementById('budget-form').addEventListener('submit', handleBudgetSubmit);
}

function openBudgetModal() { document.getElementById('budget-form').reset(); document.getElementById('budget-modal').hidden = false; }
function closeBudgetModal() { document.getElementById('budget-modal').hidden = true; }

async function handleBudgetSubmit(event) {
  event.preventDefault();
  const payload = {
    type: currentBudgetType,
    category: document.getElementById('budgetCategory').value,
    amount: parseFloat(document.getElementById('budgetAmount').value),
    note: document.getElementById('budgetNote').value.trim(),
    date: new Date()
  };
  if (!payload.amount || payload.amount <= 0) { showToast('Enter a valid amount.', 'error'); return; }
  try {
    await api.post('/budget-entries', payload);
    closeBudgetModal();
    showBudgetPopup();
    await loadEntries();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function deleteBudgetEntry(id) {
  if (!confirm('Delete this entry?')) return;
  try { await api.del(`/budget-entries/${id}`); showToast('Entry deleted.'); await loadEntries(); }
  catch (err) { showToast(err.message, 'error'); }
}

function showBudgetPopup() {
  const popup = document.getElementById('budget-popup');
  popup.style.display = 'block';
  setTimeout(() => { popup.style.display = 'none'; }, 2500);
}

function escapeHtml(str) { const div = document.createElement('div'); div.textContent = str; return div.innerHTML; }
function trashIcon() { return '<svg viewBox="0 0 24 24"><polyline points="3,6 5,6 21,6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>'; }
