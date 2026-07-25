requireAuth();

let snapshots = [];
let selectedAgeGroup = null;
let nwtCharts = {};

// Reference dataset for "average net worth by age group" — approximate benchmark figures
// (illustrative, not sourced from a live dataset — flagged in the original brief as needing
// external data). Values in INR lakhs, converted to rupees below.
const AGE_BENCHMARKS = { '18-24': 200000, '25-34': 1200000, '35-44': 3500000, '45-54': 7000000, '55-64': 11000000, '65+': 13000000 };

document.addEventListener('DOMContentLoaded', async () => {
  const content = renderShell('net-worth.html');
  content.appendChild(document.getElementById('tpl').content.cloneNode(true));

  document.querySelectorAll('.age-group-btn').forEach(btn => btn.addEventListener('click', () => selectAgeGroup(btn.dataset.group)));
  document.getElementById('nwt-generateDashboard').addEventListener('click', generateDashboard);
  document.getElementById('nwt-editDetailsBtn').addEventListener('click', editDetails);
  document.getElementById('trendPeriodToggle').addEventListener('change', (e) => renderNetWorthTrendChart(e.target.value));

  try { snapshots = await api.get('/net-worth'); } catch { snapshots = []; }
  if (snapshots.length > 0) showDashboard();
});

function selectAgeGroup(group) {
  selectedAgeGroup = group;
  document.querySelectorAll('.age-group-btn').forEach(b => b.classList.toggle('selected', b.dataset.group === group));
}

function getInputs() {
  return {
    ageGroup: selectedAgeGroup,
    cash: num('nwt-cashAmount'), investments: num('nwt-investmentAmount'), realEstate: num('nwt-realEstateAmount'), otherAssets: num('nwt-otherAssetsAmount'),
    creditCardDebt: num('nwt-creditCardDebt'), studentLoans: num('nwt-studentLoans'), mortgage: num('nwt-mortgageAmount'), otherDebts: num('nwt-otherDebts'),
    netWorthGoal: num('nwt-netWorthGoal'), timeframeMonths: num('nwt-timeframe') || 12
  };
}
function num(id) { return parseFloat(document.getElementById(id).value) || 0; }

async function generateDashboard() {
  const data = getInputs();
  try {
    const snap = await api.post('/net-worth', data);
    snapshots.push(snap);
    showDashboard();
    showToast('Dashboard generated.');
  } catch (err) { showToast(err.message, 'error'); }
}

function showDashboard() {
  document.getElementById('nwt-inputContainer').style.display = 'none';
  document.getElementById('nwt-dashboardContainer').style.display = 'block';
  renderCurrentNetWorthCard();
  renderAssetsBreakdown();
  renderLiabilitiesBreakdown();
  calculateDebtToAssetRatio();
  calculateNetWorthChange();
  renderInsights();
  renderProjection();
  renderNetWorthTrendChart('all');
}

function calculateNetWorth(s) {
  const totalAssets = s.cash + s.investments + s.realEstate + s.otherAssets;
  const totalLiabilities = s.creditCardDebt + s.studentLoans + s.mortgage + s.otherDebts;
  return { totalAssets, totalLiabilities, netWorth: totalAssets - totalLiabilities };
}

function latestSnapshot() { return snapshots[snapshots.length - 1]; }

function renderNetWorthTrendChart(period) {
  let filtered = snapshots;
  if (period !== 'all') {
    const cutoff = new Date(); cutoff.setMonth(cutoff.getMonth() - Number(period));
    filtered = snapshots.filter(s => new Date(s.date) >= cutoff);
  }
  if (nwtCharts.trend) nwtCharts.trend.destroy();

  if (filtered.length < 2) {
    nwtCharts.trend = new Chart(document.getElementById('nwt-trendChart'), {
      type: 'line',
      data: { labels: filtered.map(s => formatDate(s.date)), datasets: [{ data: filtered.map(s => calculateNetWorth(s).netWorth), borderColor: '#B4933D', tension: .3 }] },
      options: { plugins: { legend: { display: false }, title: { display: filtered.length < 2, text: 'Come back over time to see your trend', position: 'bottom' } } }
    });
    return;
  }
  nwtCharts.trend = new Chart(document.getElementById('nwt-trendChart'), {
    type: 'line',
    data: { labels: filtered.map(s => formatDate(s.date)), datasets: [{ label: 'Net Worth', data: filtered.map(s => calculateNetWorth(s).netWorth), borderColor: '#B4933D', backgroundColor: 'rgba(180,147,61,0.1)', fill: true, tension: .3 }] },
    options: { plugins: { legend: { display: false } } }
  });
}

function renderCurrentNetWorthCard() {
  const s = latestSnapshot();
  const { totalAssets, totalLiabilities, netWorth } = calculateNetWorth(s);
  document.getElementById('nwt-currentNetWorth').textContent = formatCurrency(netWorth);

  if (s.ageGroup && AGE_BENCHMARKS[s.ageGroup]) {
    const benchmark = AGE_BENCHMARKS[s.ageGroup];
    const diff = netWorth - benchmark;
    document.getElementById('nwt-ageComparisonBadge').textContent = diff >= 0
      ? `${formatCurrency(diff)} above the typical ${s.ageGroup} benchmark`
      : `${formatCurrency(Math.abs(diff))} below the typical ${s.ageGroup} benchmark`;
  }

  const pct = s.netWorthGoal > 0 ? Math.min(100, Math.max(0, (netWorth / s.netWorthGoal) * 100)) : 0;
  document.getElementById('nwt-goalProgressBar').style.width = `${pct}%`;
  document.getElementById('nwt-goalProgressText').textContent = s.netWorthGoal > 0 ? `${pct.toFixed(1)}% of ${formatCurrency(s.netWorthGoal)} goal` : 'No goal set';
}

function renderAssetsBreakdown() {
  const s = latestSnapshot();
  if (nwtCharts.assets) nwtCharts.assets.destroy();
  nwtCharts.assets = new Chart(document.getElementById('nwt-assetsChart'), {
    type: 'pie',
    data: { labels: ['Cash', 'Investments', 'Real Estate', 'Other'], datasets: [{ data: [s.cash, s.investments, s.realEstate, s.otherAssets], backgroundColor: ['#1B5E4B', '#B4933D', '#4C6FA8', '#9C5B8C'] }] },
    options: { plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 11 } } } } }
  });
}
function renderLiabilitiesBreakdown() {
  const s = latestSnapshot();
  if (nwtCharts.liabilities) nwtCharts.liabilities.destroy();
  nwtCharts.liabilities = new Chart(document.getElementById('nwt-liabilitiesChart'), {
    type: 'pie',
    data: { labels: ['Credit Card', 'Student Loans', 'Mortgage', 'Other'], datasets: [{ data: [s.creditCardDebt, s.studentLoans, s.mortgage, s.otherDebts], backgroundColor: ['#A8493E', '#C06A4E', '#8A6D2F', '#557A99'] }] },
    options: { plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 11 } } } } }
  });
}

function calculateDebtToAssetRatio() {
  const s = latestSnapshot();
  const { totalAssets, totalLiabilities } = calculateNetWorth(s);
  const ratio = totalAssets > 0 ? totalLiabilities / totalAssets : 0;
  document.getElementById('nwt-debtRatioValue').textContent = ratio.toFixed(2);
  const label = ratio < 0.3 ? 'Healthy' : ratio < 0.6 ? 'Caution' : 'High Risk';
  const cls = ratio < 0.3 ? 'badge-low' : ratio < 0.6 ? 'badge-medium' : 'badge-high';
  const el = document.getElementById('nwt-debtRatioText');
  el.textContent = label; el.className = `badge ${cls}`;
}

function calculateNetWorthChange() {
  const current = calculateNetWorth(latestSnapshot()).netWorth;
  const now = new Date();
  const monthAgo = snapshots.filter(s => new Date(s.date) < new Date(now.getFullYear(), now.getMonth(), 1)).pop();
  const yearAgo = snapshots.filter(s => new Date(s.date) < new Date(now.getFullYear() - 1, now.getMonth(), 1)).pop();
  document.getElementById('nwt-monthlyChange').textContent = monthAgo ? formatCurrency(current - calculateNetWorth(monthAgo).netWorth) : 'Not enough history yet';
  document.getElementById('nwt-annualChange').textContent = yearAgo ? formatCurrency(current - calculateNetWorth(yearAgo).netWorth) : 'Not enough history yet';
}

function renderInsights() {
  const s = latestSnapshot();
  const { totalAssets, netWorth } = calculateNetWorth(s);
  const insights = [];
  if (totalAssets > 0) {
    const rePct = ((s.realEstate / totalAssets) * 100).toFixed(0);
    if (s.realEstate > 0) insights.push(`Your real estate makes up ${rePct}% of your total assets.`);
    const cashPct = ((s.cash / totalAssets) * 100).toFixed(0);
    if (s.cash / totalAssets > 0.4) insights.push(`${cashPct}% of your assets are sitting in cash — consider whether some could be invested for growth.`);
  }
  if (s.netWorthGoal > 0) {
    const monthly = (s.netWorthGoal - netWorth) / s.timeframeMonths;
    insights.push(monthly > 0
      ? `You'll need to grow your net worth by about ${formatCurrency(monthly)}/month to hit your goal in ${s.timeframeMonths} months.`
      : `You're already on track to meet or exceed your goal.`);
  }
  if (insights.length === 0) insights.push('Add a few snapshots over time to unlock personalized insights.');
  document.getElementById('nwt-insightsList').innerHTML = insights.map(i => `<li>${i}</li>`).join('');
}

function renderProjection() {
  const s = latestSnapshot();
  const { netWorth } = calculateNetWorth(s);
  const assumedGrowthRate = 0.06 / 12; // 6% annual, illustrative assumption
  const months = Math.max(s.timeframeMonths, 12);
  const projected = [];
  let value = netWorth;
  for (let i = 0; i <= months; i++) { projected.push(value); value *= (1 + assumedGrowthRate); }

  if (nwtCharts.proj) nwtCharts.proj.destroy();
  nwtCharts.proj = new Chart(document.getElementById('nwt-projectionChart'), {
    type: 'line',
    data: { labels: projected.map((_, i) => `M${i}`), datasets: [{ data: projected, borderColor: '#1B5E4B', tension: .3, pointRadius: 0 }] },
    options: { plugins: { legend: { display: false } } }
  });

  document.getElementById('nwt-projectedNetWorth').textContent = formatCurrency(projected[projected.length - 1]);
  const neededMonthly = s.netWorthGoal > 0 ? Math.max(0, (s.netWorthGoal - netWorth) / s.timeframeMonths) : 0;
  document.getElementById('nwt-neededGrowth').textContent = formatCurrency(neededMonthly);
}

function editDetails() {
  const s = latestSnapshot();
  document.getElementById('nwt-cashAmount').value = s.cash;
  document.getElementById('nwt-investmentAmount').value = s.investments;
  document.getElementById('nwt-realEstateAmount').value = s.realEstate;
  document.getElementById('nwt-otherAssetsAmount').value = s.otherAssets;
  document.getElementById('nwt-creditCardDebt').value = s.creditCardDebt;
  document.getElementById('nwt-studentLoans').value = s.studentLoans;
  document.getElementById('nwt-mortgageAmount').value = s.mortgage;
  document.getElementById('nwt-otherDebts').value = s.otherDebts;
  document.getElementById('nwt-netWorthGoal').value = s.netWorthGoal;
  document.getElementById('nwt-timeframe').value = s.timeframeMonths;
  if (s.ageGroup) selectAgeGroup(s.ageGroup);
  document.getElementById('nwt-dashboardContainer').style.display = 'none';
  document.getElementById('nwt-inputContainer').style.display = 'block';
}
