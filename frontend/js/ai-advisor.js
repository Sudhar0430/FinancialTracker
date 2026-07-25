requireAuth();

const CACHE_KEY = 'ft_ai_advice_cache';
const HISTORY_KEY = 'ft_ai_advice_history';

document.addEventListener('DOMContentLoaded', async () => {
  const content = renderShell('ai-advisor.html');
  content.appendChild(document.getElementById('tpl').content.cloneNode(true));

  document.getElementById('refreshBtn').addEventListener('click', () => fetchAIAdvice(true));
  renderHistory();

  const cached = getCache();
  if (cached) {
    populate(cached);
  } else {
    await fetchAIAdvice(false);
  }
});

function getCache() {
  try {
    const raw = JSON.parse(localStorage.getItem(CACHE_KEY));
    if (!raw) return null;
    // Cache is only reused for 6 hours — after that we quietly refetch so advice
    // doesn't go stale, without forcing the user to click Refresh every visit.
    if (Date.now() - raw.timestamp > 6 * 60 * 60 * 1000) return null;
    return raw.data;
  } catch { return null; }
}
function setCache(data) { localStorage.setItem(CACHE_KEY, JSON.stringify({ timestamp: Date.now(), data })); }

async function fetchAIAdvice(isManualRefresh) {
  setLoadingState();
  try {
    const data = await api.post('/ai-advisor', {});
    populate(data);
    setCache(data);
    pushHistory(data);
    if (isManualRefresh) showToast('Insights refreshed.');
  } catch (err) {
    document.getElementById('ai-summary').textContent = 'Could not generate insights right now.';
    document.getElementById('ai-summary').classList.remove('loading-text');
    document.getElementById('ai-insights').innerHTML = '<li>Please try again in a moment.</li>';
    document.getElementById('ai-advice-text').textContent = err.message;
    document.getElementById('ai-advice-text').classList.remove('loading-text');
  }
}

function setLoadingState() {
  document.getElementById('ai-summary').textContent = 'Analyzing your finances…';
  document.getElementById('ai-summary').classList.add('loading-text');
  document.getElementById('ai-insights').innerHTML = '<li class="loading-text">Analyzing…</li>';
  document.getElementById('ai-advice-text').textContent = 'Thinking…';
  document.getElementById('ai-advice-text').classList.add('loading-text');
}

function populate(data) {
  document.getElementById('ai-summary').textContent = data.summary || 'No summary available.';
  document.getElementById('ai-summary').classList.remove('loading-text');

  const insightsEl = document.getElementById('ai-insights');
  insightsEl.innerHTML = (data.insights && data.insights.length)
    ? data.insights.map(i => `<li>${severityTag(i)}</li>`).join('')
    : '<li>No specific insights yet — add a few transactions and check back.</li>';

  document.getElementById('ai-advice-text').textContent = data.advice || 'No advice available yet.';
  document.getElementById('ai-advice-text').classList.remove('loading-text');
}

function severityTag(text) {
  const lower = text.toLowerCase();
  if (lower.includes('overspend') || lower.includes('exceed') || lower.includes('debt') || lower.includes('high')) return `⚠️ ${escapeHtml(text)}`;
  return `💡 ${escapeHtml(text)}`;
}

function pushHistory(data) {
  const history = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
  history.unshift({ date: new Date().toISOString(), summary: data.summary });
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, 10)));
  renderHistory();
}

function renderHistory() {
  const history = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
  const el = document.getElementById('ai-history');
  if (history.length === 0) { el.textContent = 'No previous insights yet.'; return; }
  el.innerHTML = history.map(h => `<div style="margin-bottom:8px;"><strong>${formatDate(h.date)}:</strong> ${escapeHtml(h.summary)}</div>`).join('');
}

function escapeHtml(str) { const div = document.createElement('div'); div.textContent = str; return div.innerHTML; }
