requireAuth();

let allPolicies = [];
let insChart = null;
const RECOMMENDED_TYPES = ['Health', 'Life']; // benchmark used by the coverage-gap checklist

document.addEventListener('DOMContentLoaded', async () => {
  const content = renderShell('insurance.html');
  content.appendChild(document.getElementById('tpl').content.cloneNode(true));
  wireControls();
  await loadPolicies();
});

async function loadPolicies() {
  try { allPolicies = await api.get('/insurance-policies'); }
  catch (err) { showToast(err.message, 'error'); allPolicies = []; }
  buildTypeFilter();
  calculateSummary();
  renderPolicyList(allPolicies);
  renderInsuranceChart();
  checkExpiringPolicies();
  renderGapChecklist();
}

function buildTypeFilter() {
  const sel = document.getElementById('insuranceTypeFilter');
  const types = [...new Set(allPolicies.map(p => p.type))];
  sel.innerHTML = `<option value="">All types</option>` + types.map(t => `<option value="${t}">${t}</option>`).join('');
}

function wireControls() {
  document.getElementById('openInsBtn').addEventListener('click', () => openModal());
  document.getElementById('insModalClose').addEventListener('click', closeModal);
  document.getElementById('insCancelBtn').addEventListener('click', closeModal);
  document.getElementById('insuranceModal').addEventListener('click', (e) => { if (e.target.id === 'insuranceModal') closeModal(); });
  document.getElementById('insuranceForm').addEventListener('submit', handleInsuranceSubmit);
  ['insuranceSearch', 'insuranceTypeFilter', 'insuranceSortBy'].forEach(id => {
    document.getElementById(id).addEventListener('input', applyFilters);
    document.getElementById(id).addEventListener('change', applyFilters);
  });
}

function applyFilters() {
  const search = document.getElementById('insuranceSearch').value.toLowerCase();
  const type = document.getElementById('insuranceTypeFilter').value;
  const sortBy = document.getElementById('insuranceSortBy').value;
  let list = allPolicies.filter(p => (!search || p.name.toLowerCase().includes(search)) && (!type || p.type === type));
  list.sort((a, b) => sortBy === 'premium' ? annualPremium(b) - annualPremium(a) : new Date(a.endDate) - new Date(b.endDate));
  renderPolicyList(list);
}

function frequencyToMonths(freq) { return { monthly: 1, quarterly: 3, 'half-yearly': 6, yearly: 12, 'one-time': null }[freq]; }
function monthlyPremiumOf(p) {
  const months = frequencyToMonths(p.premiumFrequency);
  if (months === null) return 0; // one-time premiums aren't recurring
  return p.premiumAmount / months;
}
function annualPremium(p) { return monthlyPremiumOf(p) * 12; }

function calculateSummary() {
  const active = allPolicies.filter(p => new Date(p.endDate) >= new Date());
  const monthly = active.reduce((s, p) => s + monthlyPremiumOf(p), 0);
  document.getElementById('activePoliciesCount').textContent = active.length;
  document.getElementById('monthlyPremium').textContent = formatCurrency(monthly);
  document.getElementById('annualPremium').textContent = formatCurrency(monthly * 12);

  // Coverage score: checks whether recommended coverage types exist, benchmarked loosely
  // against income (10x annual income in life cover is a common rule of thumb).
  const user = getCurrentUser();
  const types = new Set(active.map(p => p.type));
  let score = 0;
  RECOMMENDED_TYPES.forEach(t => { if (types.has(t)) score += 35; });
  const totalCoverage = active.reduce((s, p) => s + p.coverageAmount, 0);
  const annualIncome = (user?.monthlyIncome || 0) * 12;
  if (annualIncome > 0) score += Math.min(30, (totalCoverage / (annualIncome * 10)) * 30);
  else score += active.length > 0 ? 15 : 0;
  score = Math.round(Math.max(0, Math.min(100, score)));
  const el = document.getElementById('coverageScore');
  el.textContent = score;
  el.style.color = score >= 70 ? 'var(--emerald)' : score >= 40 ? 'var(--brass)' : 'var(--rust)';
}

function renderPolicyList(list) {
  const container = document.getElementById('insurancePoliciesList');
  if (list.length === 0) {
    container.innerHTML = `<div class="empty-state"><div class="display">No policies yet</div>Add one to start tracking coverage.</div>`;
    return;
  }
  container.innerHTML = `<div class="table-wrap"><table>
    <thead><tr><th>Name</th><th>Type</th><th>Provider</th><th>Coverage</th><th>Premium</th><th>Expiry</th><th></th></tr></thead>
    <tbody>
      ${list.map(p => {
        const daysLeft = Math.ceil((new Date(p.endDate) - new Date()) / (1000 * 60 * 60 * 24));
        const expiring = daysLeft <= 30;
        return `<tr>
          <td>${escapeHtml(p.name)}</td>
          <td>${p.type}</td>
          <td class="faint">${p.provider ? escapeHtml(p.provider) : '—'}</td>
          <td class="mono">${formatCurrency(p.coverageAmount)}</td>
          <td class="mono">${formatCurrency(p.premiumAmount)}/${p.premiumFrequency}</td>
          <td class="${expiring ? 'amount-neg' : ''}">${formatDate(p.endDate)}${expiring ? (daysLeft < 0 ? ' (expired)' : ' ⚠️') : ''}</td>
          <td>
            <button class="icon-btn edit" onclick="editPolicy('${p._id}')" title="Edit">${editIcon()}</button>
            <button class="icon-btn" onclick="deletePolicy('${p._id}')" title="Delete">${trashIcon()}</button>
          </td>
        </tr>`;
      }).join('')}
    </tbody></table></div>`;
}

function renderInsuranceChart() {
  const totals = {};
  allPolicies.forEach(p => { totals[p.type] = (totals[p.type] || 0) + annualPremium(p); });
  if (insChart) insChart.destroy();
  const entries = Object.entries(totals);
  insChart = new Chart(document.getElementById('insuranceChart'), {
    type: 'doughnut',
    data: { labels: entries.length ? entries.map(e => e[0]) : ['No data'], datasets: [{ data: entries.length ? entries.map(e => e[1]) : [1], backgroundColor: ['#7A4FA0','#1B5E4B','#B4933D','#4C6FA8','#A8493E','#557A99'] }] },
    options: { cutout: '60%', plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 11 } } } } }
  });
}

function checkExpiringPolicies() {
  const expiring = allPolicies.filter(p => { const d = Math.ceil((new Date(p.endDate) - new Date()) / (1000 * 60 * 60 * 24)); return d >= 0 && d <= 30; });
  if (expiring.length > 0) showToast(`${expiring.length} polic${expiring.length === 1 ? 'y' : 'ies'} expiring within 30 days.`);
}

function renderGapChecklist() {
  const types = new Set(allPolicies.filter(p => new Date(p.endDate) >= new Date()).map(p => p.type));
  const all = ['Health', 'Life', 'Auto', 'Home'];
  const have = all.filter(t => types.has(t));
  const missing = all.filter(t => !types.has(t));
  document.getElementById('gapChecklist').innerHTML =
    (have.length ? `You have ${have.join(' + ')} coverage.<br>` : '') +
    (missing.length ? `Consider adding: <strong>${missing.join(', ')}</strong>.` : 'Great — you have all core coverage types.');
}

function openModal(p = null) {
  document.getElementById('insuranceForm').reset();
  if (p) {
    document.getElementById('insModalTitle').textContent = 'Edit Policy';
    document.getElementById('insId').value = p._id;
    document.getElementById('insName').value = p.name;
    document.getElementById('insType').value = p.type;
    document.getElementById('insProvider').value = p.provider || '';
    document.getElementById('insPolicyNumber').value = p.policyNumber || '';
    document.getElementById('insStartDate').value = p.startDate ? new Date(p.startDate).toISOString().slice(0, 10) : '';
    document.getElementById('insEndDate').value = new Date(p.endDate).toISOString().slice(0, 10);
    document.getElementById('insPremium').value = p.premiumAmount;
    document.getElementById('insFrequency').value = p.premiumFrequency;
    document.getElementById('insCoverage').value = p.coverageAmount;
    document.getElementById('insBeneficiaries').value = (p.beneficiaries || []).join(', ');
    document.getElementById('insNotes').value = p.notes || '';
  } else {
    document.getElementById('insModalTitle').textContent = 'Add Policy';
    document.getElementById('insId').value = '';
  }
  document.getElementById('insuranceModal').hidden = false;
}
function closeModal() { document.getElementById('insuranceModal').hidden = true; }

async function handleInsuranceSubmit(event) {
  event.preventDefault();
  const id = document.getElementById('insId').value;
  const payload = {
    name: document.getElementById('insName').value.trim(),
    type: document.getElementById('insType').value,
    provider: document.getElementById('insProvider').value.trim(),
    policyNumber: document.getElementById('insPolicyNumber').value.trim(),
    startDate: document.getElementById('insStartDate').value || null,
    endDate: document.getElementById('insEndDate').value,
    premiumAmount: parseFloat(document.getElementById('insPremium').value),
    premiumFrequency: document.getElementById('insFrequency').value,
    coverageAmount: parseFloat(document.getElementById('insCoverage').value),
    beneficiaries: document.getElementById('insBeneficiaries').value.split(',').map(s => s.trim()).filter(Boolean),
    notes: document.getElementById('insNotes').value.trim()
  };
  try {
    if (id) await api.put(`/insurance-policies/${id}`, payload);
    else await api.post('/insurance-policies', payload);
    showToast('Policy saved.');
    closeModal();
    await loadPolicies();
  } catch (err) { showToast(err.message, 'error'); }
}

function editPolicy(id) { const p = allPolicies.find(x => x._id === id); if (p) openModal(p); }
async function deletePolicy(id) {
  if (!confirm('Delete this policy?')) return;
  try { await api.del(`/insurance-policies/${id}`); showToast('Deleted.'); await loadPolicies(); }
  catch (err) { showToast(err.message, 'error'); }
}

function escapeHtml(str) { const div = document.createElement('div'); div.textContent = str; return div.innerHTML; }
function editIcon() { return '<svg viewBox="0 0 24 24"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>'; }
function trashIcon() { return '<svg viewBox="0 0 24 24"><polyline points="3,6 5,6 21,6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>'; }
