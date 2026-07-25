requireAuth();

let allGoals = [];
let sortMode = 'priority';
let fundsTargetGoalId = null;

document.addEventListener('DOMContentLoaded', async () => {
  const content = renderShell('goals.html');
  content.appendChild(document.getElementById('tpl').content.cloneNode(true));

  wireModal();
  document.getElementById('goalSortSelect').addEventListener('change', (e) => { sortMode = e.target.value; renderGoals(); });

  await loadGoals();
});

async function loadGoals() {
  try {
    allGoals = await api.get('/goals');
  } catch (err) {
    showToast(err.message, 'error');
    allGoals = [];
  }
  renderGoals();
  renderSummary();
}

function renderSummary() {
  const active = allGoals.filter(g => !g.completed);
  const totalSaved = allGoals.reduce((s, g) => s + g.saved, 0);
  const completedCount = allGoals.filter(g => g.completed).length;
  const top = [...active].sort((a, b) => (priorityWeight(b.priority) - priorityWeight(a.priority)) || (b.target - a.target))[0];

  document.getElementById('summary-total').textContent = formatCurrency(totalSaved);
  document.getElementById('summary-top').textContent = top ? top.title : '—';
  document.getElementById('summary-complete').textContent = completedCount;
}

function priorityWeight(p) { return { high: 3, medium: 2, low: 1 }[p] || 0; }

function renderGoals() {
  const container = document.getElementById('goals-container');
  const active = allGoals.filter(g => !g.completed);

  if (active.length === 0) {
    container.innerHTML = `<div class="empty-state" style="grid-column:1/-1;"><div class="display">No active goals yet</div>Add your first savings goal to start tracking progress.</div>`;
  } else {
    const sorted = [...active].sort((a, b) => {
      if (sortMode === 'priority') return priorityWeight(b.priority) - priorityWeight(a.priority);
      return (a.date ? new Date(a.date) : Infinity) - (b.date ? new Date(b.date) : Infinity);
    });

    container.innerHTML = sorted.map(g => {
      const pct = Math.min(100, Math.round((g.saved / g.target) * 100));
      const daysLeft = g.date ? Math.ceil((new Date(g.date) - new Date()) / (1000 * 60 * 60 * 24)) : null;
      const monthsLeft = g.date ? Math.max(1, Math.ceil(daysLeft / 30)) : null;
      const suggestion = monthsLeft ? Math.max(0, (g.target - g.saved) / monthsLeft) : null;

      return `
      <div class="card">
        <div class="flex-between" style="margin-bottom:10px;">
          <div style="font-size:22px;">${g.tag || '💰'}</div>
          <span class="badge badge-${g.priority}">${g.priority}</span>
        </div>
        <div class="display" style="font-size:17px; margin-bottom:4px;">${escapeHtml(g.title)}</div>
        <div class="faint" style="font-size:12.5px; margin-bottom:12px;">${formatCurrency(g.saved)} of ${formatCurrency(g.target)}</div>
        <div class="progress-track" style="margin-bottom:6px;"><div class="progress-fill" style="width:${pct}%"></div></div>
        <div class="flex-between" style="margin-bottom:12px;">
          <span class="faint" style="font-size:12px;">${pct}% funded</span>
          <span class="faint" style="font-size:12px;">${daysLeft !== null ? (daysLeft >= 0 ? `${daysLeft} days left` : 'Past target date') : 'No target date'}</span>
        </div>
        ${suggestion !== null ? `<div class="hint" style="margin-bottom:12px;">Suggested: ~${formatCurrency(suggestion)}/month to reach goal on time</div>` : ''}
        ${g.note ? `<div class="hint" style="margin-bottom:12px; font-style:italic;">"${escapeHtml(g.note)}"</div>` : ''}
        <div style="display:flex; gap:8px;">
          <button class="btn btn-brass btn-sm" style="flex:1;" onclick="openFundsModal('${g._id}')">+ Add Funds</button>
          <button class="icon-btn edit" onclick="editGoal('${g._id}')" title="Edit">${editIcon()}</button>
          <button class="icon-btn" onclick="deleteGoal('${g._id}')" title="Delete">${trashIcon()}</button>
        </div>
      </div>`;
    }).join('');
  }

  const historyBody = document.getElementById('goal-history-list');
  const completed = allGoals.filter(g => g.completed);
  historyBody.innerHTML = completed.length === 0
    ? `<tr class="empty-row"><td colspan="3">No completed goals yet.</td></tr>`
    : completed.map(g => `<tr><td>${g.tag || '💰'} ${escapeHtml(g.title)}</td><td>${formatCurrency(g.target)}</td><td>${formatDate(g.completedAt)}</td></tr>`).join('');
}

// ---------- Modal: add/edit goal ----------
function wireModal() {
  document.getElementById('openGoalBtn').addEventListener('click', () => openModal());
  document.getElementById('goalModalClose').addEventListener('click', closeModal);
  document.getElementById('goalCancelBtn').addEventListener('click', closeModal);
  document.getElementById('goalModalOverlay').addEventListener('click', (e) => { if (e.target.id === 'goalModalOverlay') closeModal(); });
  document.getElementById('goal-form').addEventListener('submit', handleGoalSubmit);

  document.getElementById('fundsModalClose').addEventListener('click', closeFundsModal);
  document.getElementById('fundsCancelBtn').addEventListener('click', closeFundsModal);
  document.getElementById('fundsModalOverlay').addEventListener('click', (e) => { if (e.target.id === 'fundsModalOverlay') closeFundsModal(); });
  document.getElementById('funds-form').addEventListener('submit', handleAddFunds);
}

function openModal(goal = null) {
  document.getElementById('goal-form').reset();
  if (goal) {
    document.getElementById('goalModalTitle').textContent = 'Edit Goal';
    document.getElementById('goalId').value = goal._id;
    document.getElementById('title').value = goal.title;
    document.getElementById('target').value = goal.target;
    document.getElementById('saved').value = goal.saved;
    document.getElementById('date').value = goal.date ? new Date(goal.date).toISOString().slice(0, 10) : '';
    document.getElementById('priority').value = goal.priority;
    document.getElementById('tag').value = goal.tag || '💰';
    document.getElementById('note').value = goal.note || '';
  } else {
    document.getElementById('goalModalTitle').textContent = 'Add Goal';
    document.getElementById('goalId').value = '';
  }
  document.getElementById('goalModalOverlay').hidden = false;
}
function closeModal() { document.getElementById('goalModalOverlay').hidden = true; }

async function handleGoalSubmit(event) {
  event.preventDefault();
  const id = document.getElementById('goalId').value;
  const payload = {
    title: document.getElementById('title').value.trim(),
    target: parseFloat(document.getElementById('target').value),
    saved: parseFloat(document.getElementById('saved').value) || 0,
    date: document.getElementById('date').value || null,
    priority: document.getElementById('priority').value,
    tag: document.getElementById('tag').value,
    note: document.getElementById('note').value.trim()
  };
  if (!payload.title || !payload.target) { showToast('Please fill in a title and target amount.', 'error'); return; }
  payload.completed = payload.saved >= payload.target;
  if (payload.completed) payload.completedAt = new Date();

  try {
    if (id) await api.put(`/goals/${id}`, payload);
    else await api.post('/goals', payload);
    showToast(id ? 'Goal updated.' : 'Goal added.');
    closeModal();
    await loadGoals();
    if (payload.completed) showCompletionPopup();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function editGoal(id) { const g = allGoals.find(x => x._id === id); if (g) openModal(g); }

async function deleteGoal(id) {
  if (!confirm('Delete this goal?')) return;
  try { await api.del(`/goals/${id}`); showToast('Goal deleted.'); await loadGoals(); }
  catch (err) { showToast(err.message, 'error'); }
}

// ---------- Quick add funds ----------
function openFundsModal(goalId) { fundsTargetGoalId = goalId; document.getElementById('funds-form').reset(); document.getElementById('fundsModalOverlay').hidden = false; }
function closeFundsModal() { document.getElementById('fundsModalOverlay').hidden = true; }

async function handleAddFunds(event) {
  event.preventDefault();
  const amount = parseFloat(document.getElementById('fundsAmount').value);
  if (!amount || amount <= 0) return;
  await addToGoal(fundsTargetGoalId, amount);
  closeFundsModal();
}

async function addToGoal(goalId, amount) {
  const goal = allGoals.find(g => g._id === goalId);
  if (!goal) return;
  const newSaved = goal.saved + amount;
  const completed = checkGoalCompletion({ ...goal, saved: newSaved });
  try {
    await api.put(`/goals/${goalId}`, { ...goal, saved: newSaved, completed, completedAt: completed ? new Date() : null });
    showToast('Funds added.');
    await loadGoals();
    if (completed) showCompletionPopup();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function checkGoalCompletion(goal) { return goal.saved >= goal.target; }

function showCompletionPopup() {
  const popup = document.getElementById('completion-popup');
  popup.style.display = 'block';
  setTimeout(() => { popup.style.display = 'none'; }, 3000);
}

function escapeHtml(str) { const div = document.createElement('div'); div.textContent = str; return div.innerHTML; }
function editIcon() { return '<svg viewBox="0 0 24 24"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>'; }
function trashIcon() { return '<svg viewBox="0 0 24 24"><polyline points="3,6 5,6 21,6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>'; }
