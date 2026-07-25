requireAuth();

let allSubs = [];
let subCharts = {};

document.addEventListener('DOMContentLoaded', async () => {
  const content = renderShell('subscriptions.html');
  content.appendChild(document.getElementById('tpl').content.cloneNode(true));

  wireControls();
  await loadSubs();
});

async function loadSubs() {
  try { allSubs = await api.get('/subscriptions'); }
  catch (err) { showToast(err.message, 'error'); allSubs = []; }
  buildCategoryFilter();
  calculateSummary();
  renderSubscriptionList(allSubs);
  renderCategoryChart();
  renderTrendChart();
  checkReminders();
  renderCancelCandidates();
}

function buildCategoryFilter() {
  const sel = document.getElementById('category-filter');
  const cats = [...new Set(allSubs.map(s => s.category))];
  sel.innerHTML = `<option value="">All categories</option>` + cats.map(c => `<option value="${c}">${c}</option>`).join('');
}

function wireControls() {
  document.getElementById('openSubBtn').addEventListener('click', () => openModal());
  document.getElementById('subModalClose').addEventListener('click', closeModal);
  document.getElementById('subCancelBtn').addEventListener('click', closeModal);
  document.getElementById('subscription-modal').addEventListener('click', (e) => { if (e.target.id === 'subscription-modal') closeModal(); });
  document.getElementById('subscription-form').addEventListener('submit', handleSubscriptionSubmit);

  ['subscription-search', 'category-filter', 'sort-by'].forEach(id => {
    document.getElementById(id).addEventListener('input', applyListFilters);
    document.getElementById(id).addEventListener('change', applyListFilters);
  });
}

function applyListFilters() {
  const search = document.getElementById('subscription-search').value.toLowerCase();
  const category = document.getElementById('category-filter').value;
  const sortBy = document.getElementById('sort-by').value;

  let list = allSubs.filter(s => (!search || s.name.toLowerCase().includes(search)) && (!category || s.category === category));
  list.sort((a, b) => {
    if (sortBy === 'cost') return b.cost - a.cost;
    if (sortBy === 'nextBillingDate') return new Date(a.nextBillingDate) - new Date(b.nextBillingDate);
    return a.name.localeCompare(b.name);
  });
  renderSubscriptionList(list);
}

function monthlyEquivalent(sub) {
  if (sub.billingCycle === 'yearly') return sub.cost / 12;
  if (sub.billingCycle === 'weekly') return sub.cost * 4.33;
  return sub.cost;
}

function calculateSummary() {
  const active = allSubs.filter(s => s.status === 'active' || !s.status);
  const monthly = active.reduce((s, sub) => s + monthlyEquivalent(sub), 0);
  document.getElementById('active-count').textContent = active.length;
  document.getElementById('monthly-cost').textContent = formatCurrency(monthly);
  document.getElementById('yearly-cost').textContent = formatCurrency(monthly * 12);

  // Health score: starts at 100, penalize overlapping categories and a high subscription load.
  const catCounts = {};
  active.forEach(s => { catCounts[s.category] = (catCounts[s.category] || 0) + 1; });
  let score = 100;
  Object.values(catCounts).forEach(count => { if (count > 1) score -= (count - 1) * 8; });
  if (active.length > 10) score -= (active.length - 10) * 2;
  score = Math.max(0, Math.min(100, score));
  const scoreEl = document.getElementById('health-score');
  scoreEl.textContent = score;
  scoreEl.style.color = score >= 75 ? 'var(--emerald)' : score >= 45 ? 'var(--brass)' : 'var(--rust)';
}

function renderSubscriptionList(list) {
  const container = document.getElementById('subscription-list');
  if (list.length === 0) {
    container.innerHTML = `<div class="empty-state"><div class="display">No subscriptions yet</div>Add one to start tracking recurring costs.</div>`;
    return;
  }
  container.innerHTML = `<div class="table-wrap"><table>
    <thead><tr><th>Name</th><th>Category</th><th>Cost</th><th>Cycle</th><th>Renews In</th><th></th></tr></thead>
    <tbody>
      ${list.map(s => {
        const days = Math.ceil((new Date(s.nextBillingDate) - new Date()) / (1000 * 60 * 60 * 24));
        const renewLabel = days < 0 ? 'Overdue' : days === 0 ? 'Today' : `${days} days`;
        return `<tr>
          <td>${escapeHtml(s.name)}${s.status === 'cancelled' ? ' <span class="badge badge-low">Cancelled</span>' : ''}</td>
          <td>${escapeHtml(s.category)}</td>
          <td class="mono">${formatCurrency(s.cost)}</td>
          <td style="text-transform:capitalize;">${s.billingCycle}</td>
          <td class="${days <= (s.reminderDays || 3) ? 'amount-neg' : ''}">${renewLabel}</td>
          <td>
            <button class="icon-btn edit" onclick="editSub('${s._id}')" title="Edit">${editIcon()}</button>
            ${s.status !== 'cancelled' ? `<button class="icon-btn" onclick="markCancelled('${s._id}')" title="Mark cancelled">${cancelIcon()}</button>` : ''}
            <button class="icon-btn" onclick="deleteSub('${s._id}')" title="Delete">${trashIcon()}</button>
          </td>
        </tr>`;
      }).join('')}
    </tbody></table></div>`;
}

function renderCategoryChart() {
  const totals = {};
  allSubs.forEach(s => { totals[s.category] = (totals[s.category] || 0) + monthlyEquivalent(s); });
  if (subCharts.cat) subCharts.cat.destroy();
  const entries = Object.entries(totals);
  subCharts.cat = new Chart(document.getElementById('category-chart'), {
    type: 'pie',
    data: { labels: entries.length ? entries.map(e => e[0]) : ['No data'], datasets: [{ data: entries.length ? entries.map(e => e[1]) : [1], backgroundColor: ['#B4933D','#1B5E4B','#A8493E','#4C6FA8','#9C5B8C','#557A99','#8A8378'] }] },
    options: { plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 11 } } } } }
  });
}

function renderTrendChart() {
  // Trend of monthly-equivalent cost accumulated by subscription start month over the last 12 months
  const now = new Date();
  const months = [];
  for (let i = 11; i >= 0; i--) { const d = new Date(now.getFullYear(), now.getMonth() - i, 1); months.push(d); }
  const data = months.map(m => {
    return allSubs.filter(s => s.startDate && new Date(s.startDate) <= m).reduce((sum, s) => sum + monthlyEquivalent(s), 0);
  });
  if (subCharts.trend) subCharts.trend.destroy();
  subCharts.trend = new Chart(document.getElementById('trend-chart'), {
    type: 'line',
    data: { labels: months.map(m => m.toLocaleDateString('en-IN', { month: 'short' })), datasets: [{ data, borderColor: '#B4933D', backgroundColor: 'rgba(180,147,61,0.1)', fill: true, tension: .35 }] },
    options: { plugins: { legend: { display: false } } }
  });
}

function checkReminders() {
  const dueSoon = allSubs.filter(s => {
    if (s.status === 'cancelled') return false;
    const days = Math.ceil((new Date(s.nextBillingDate) - new Date()) / (1000 * 60 * 60 * 24));
    return days >= 0 && days <= (s.reminderDays || 3);
  });
  if (dueSoon.length > 0) showToast(`${dueSoon.length} subscription(s) renewing soon.`);
}

function renderCancelCandidates() {
  const catCounts = {};
  allSubs.filter(s => s.status !== 'cancelled').forEach(s => { catCounts[s.category] = (catCounts[s.category] || []).concat(s); });
  const overlaps = Object.entries(catCounts).filter(([, list]) => list.length > 1);
  const card = document.getElementById('cancelCandidatesCard');
  if (overlaps.length === 0) { card.style.display = 'none'; return; }
  card.style.display = 'block';
  document.getElementById('cancelCandidatesList').innerHTML = overlaps.map(([cat, list]) =>
    `You have ${list.length} <strong>${cat}</strong> subscriptions: ${list.map(s => s.name).join(', ')} — consider keeping just one.`
  ).join('<br>');
}

function openModal(sub = null) {
  document.getElementById('subscription-form').reset();
  if (sub) {
    document.getElementById('subModalTitle').textContent = 'Edit Subscription';
    document.getElementById('subId').value = sub._id;
    document.getElementById('subName').value = sub.name;
    document.getElementById('subCategory').value = sub.category;
    document.getElementById('subCost').value = sub.cost;
    document.getElementById('subCycle').value = sub.billingCycle;
    document.getElementById('subNextBilling').value = new Date(sub.nextBillingDate).toISOString().slice(0, 10);
    document.getElementById('subStartDate').value = sub.startDate ? new Date(sub.startDate).toISOString().slice(0, 10) : '';
    document.getElementById('subReminder').value = sub.reminderDays;
    document.getElementById('subPaymentMethod').value = sub.paymentMethod || '';
    document.getElementById('subAutoRenew').checked = sub.autoRenew;
  } else {
    document.getElementById('subModalTitle').textContent = 'Add Subscription';
    document.getElementById('subId').value = '';
    document.getElementById('subReminder').value = 3;
  }
  document.getElementById('subscription-modal').hidden = false;
}
function closeModal() { document.getElementById('subscription-modal').hidden = true; }

async function handleSubscriptionSubmit(event) {
  event.preventDefault();
  const id = document.getElementById('subId').value;
  const payload = {
    name: document.getElementById('subName').value.trim(),
    category: document.getElementById('subCategory').value,
    cost: parseFloat(document.getElementById('subCost').value),
    billingCycle: document.getElementById('subCycle').value,
    nextBillingDate: document.getElementById('subNextBilling').value,
    startDate: document.getElementById('subStartDate').value || null,
    reminderDays: parseInt(document.getElementById('subReminder').value) || 3,
    paymentMethod: document.getElementById('subPaymentMethod').value.trim(),
    autoRenew: document.getElementById('subAutoRenew').checked,
    status: 'active'
  };
  try {
    if (id) await api.put(`/subscriptions/${id}`, payload);
    else await api.post('/subscriptions', payload);
    showToast('Subscription saved.');
    closeModal();
    await loadSubs();
  } catch (err) { showToast(err.message, 'error'); }
}

function editSub(id) { const s = allSubs.find(x => x._id === id); if (s) openModal(s); }
async function markCancelled(id) {
  const s = allSubs.find(x => x._id === id);
  try { await api.put(`/subscriptions/${id}`, { ...s, status: 'cancelled' }); showToast('Marked as cancelled.'); await loadSubs(); }
  catch (err) { showToast(err.message, 'error'); }
}
async function deleteSub(id) {
  if (!confirm('Delete this subscription permanently?')) return;
  try { await api.del(`/subscriptions/${id}`); showToast('Deleted.'); await loadSubs(); }
  catch (err) { showToast(err.message, 'error'); }
}

function escapeHtml(str) { const div = document.createElement('div'); div.textContent = str; return div.innerHTML; }
function editIcon() { return '<svg viewBox="0 0 24 24"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>'; }
function trashIcon() { return '<svg viewBox="0 0 24 24"><polyline points="3,6 5,6 21,6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>'; }
function cancelIcon() { return '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><line x1="9" y1="9" x2="15" y2="15"/><line x1="15" y1="9" x2="9" y2="15"/></svg>'; }
