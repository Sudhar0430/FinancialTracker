requireAuth();

// Slab tables kept in one place so they're easy to update each financial year.
// These reflect FY 2025-26 (AY 2026-27) rates as commonly published; ALWAYS confirm
// against the latest Finance Act before relying on this for real filing decisions.
const TAX_CONFIG = {
  standardDeduction: { old: 50000, new: 75000 },
  slabs: {
    old: [
      { upto: 250000, rate: 0 },
      { upto: 500000, rate: 0.05 },
      { upto: 1000000, rate: 0.20 },
      { upto: Infinity, rate: 0.30 }
    ],
    new: [
      { upto: 400000, rate: 0 },
      { upto: 800000, rate: 0.05 },
      { upto: 1200000, rate: 0.10 },
      { upto: 1600000, rate: 0.15 },
      { upto: 2000000, rate: 0.20 },
      { upto: 2400000, rate: 0.25 },
      { upto: Infinity, rate: 0.30 }
    ]
  },
  caps: { section80C: 150000, section80TTA: 10000 }
};

let currentRegime = 'old';
let lastResult = null;

document.addEventListener('DOMContentLoaded', async () => {
  const content = renderShell('tax-estimator.html');
  content.appendChild(document.getElementById('tpl').content.cloneNode(true));

  document.querySelectorAll('#regime-toggle .tab-btn').forEach(btn => btn.addEventListener('click', () => toggleRegime(btn.dataset.regime)));
  document.getElementById('calculate-btn').addEventListener('click', updateSummary);
  document.getElementById('compare-btn').addEventListener('click', showComparison);
  document.getElementById('comparisonModalClose').addEventListener('click', () => document.getElementById('comparison-modal').hidden = true);
  document.getElementById('comparisonCloseBtn').addEventListener('click', () => document.getElementById('comparison-modal').hidden = true);
  document.getElementById('applyRecommendationBtn').addEventListener('click', applyRecommendation);
  document.getElementById('export-csv').addEventListener('click', exportCSV);
  document.getElementById('save-plan').addEventListener('click', savePlan);

  updateSummary();
});

function toggleRegime(regime) {
  currentRegime = regime;
  document.querySelectorAll('#regime-toggle .tab-btn').forEach(b => b.classList.toggle('active', b.dataset.regime === regime));
  document.getElementById('regime-description').textContent = regime === 'old'
    ? 'Old Regime lets you claim deductions like 80C, 80D, HRA and more, at the cost of higher slab rates.'
    : 'New Regime offers lower slab rates and a higher standard deduction, but most deductions (80C, 80D, HRA) are not available.';
  document.getElementById('deductionsCard').style.opacity = regime === 'new' ? 0.45 : 1;
  document.querySelectorAll('#deductionsCard input').forEach(i => i.disabled = regime === 'new');
  updateSummary();
}

function calculateGrossIncome() {
  return num('salary') + num('freelance') + num('interest') + num('capital-gains') + num('other-income');
}

function calculateTotalDeductions(regime) {
  if (regime === 'new') return TAX_CONFIG.standardDeduction.new;
  const c80c = Math.min(num('80c'), TAX_CONFIG.caps.section80C);
  const c80tta = Math.min(num('80tta'), TAX_CONFIG.caps.section80TTA);
  return c80c + num('80d') + c80tta + num('hra') + num('other-deductions') + TAX_CONFIG.standardDeduction.old;
}

function calculateTax(taxableIncome, regime) {
  const slabs = TAX_CONFIG.slabs[regime];
  let tax = 0, lower = 0;
  const breakdown = [];
  for (const slab of slabs) {
    if (taxableIncome > lower) {
      const taxableInSlab = Math.min(taxableIncome, slab.upto) - lower;
      const slabTax = taxableInSlab * slab.rate;
      tax += slabTax;
      breakdown.push({ from: lower, to: Math.min(taxableIncome, slab.upto), rate: slab.rate, tax: slabTax });
    }
    lower = slab.upto;
    if (taxableIncome <= slab.upto) break;
  }
  return { tax, breakdown };
}

function num(id) { return parseFloat(document.getElementById(id).value) || 0; }

function updateSummary() {
  const gross = calculateGrossIncome();
  const deductions = calculateTotalDeductions(currentRegime);
  const taxable = Math.max(0, gross - deductions);
  const { tax, breakdown } = calculateTax(taxable, currentRegime);
  const effectiveRate = gross > 0 ? (tax / gross) * 100 : 0;

  document.getElementById('gross-income').textContent = formatCurrency(gross);
  document.getElementById('total-deductions').textContent = formatCurrency(deductions);
  document.getElementById('taxable-income').textContent = formatCurrency(taxable);
  document.getElementById('tax-liability').textContent = formatCurrency(tax);
  document.getElementById('effective-rate').textContent = `${effectiveRate.toFixed(1)}%`;

  renderTaxChart(taxable, tax);
  renderSlabsTable(breakdown);
  renderTaxTips(gross, deductions, currentRegime);

  lastResult = { gross, deductions, taxable, tax, regime: currentRegime };
}

function renderTaxChart(taxable, tax) {
  const ctx = document.getElementById('taxChart');
  if (window.__taxChart) window.__taxChart.destroy();
  window.__taxChart = new Chart(ctx, {
    type: 'doughnut',
    data: { labels: ['Take-home (post-tax)', 'Tax Paid'], datasets: [{ data: [Math.max(0, taxable - tax), tax], backgroundColor: ['#1B5E4B', '#A8493E'] }] },
    options: { cutout: '62%', plugins: { legend: { position: 'bottom' } } }
  });
}

function renderSlabsTable(breakdown) {
  document.getElementById('slabs-container').style.display = 'block';
  document.getElementById('slabs-body').innerHTML = breakdown.map(b =>
    `<tr><td>${formatCurrency(b.from)} – ${b.to === Infinity ? '∞' : formatCurrency(b.to)}</td><td>${(b.rate * 100).toFixed(0)}%</td><td style="text-align:right;" class="mono">${formatCurrency(b.tax)}</td></tr>`
  ).join('') || `<tr class="empty-row"><td colspan="3">No tax due at this income level.</td></tr>`;
}

function renderTaxTips(gross, deductions, regime) {
  const tips = [];
  if (regime === 'old' && num('80c') < TAX_CONFIG.caps.section80C) tips.push(`You still have ${formatCurrency(TAX_CONFIG.caps.section80C - num('80c'))} of unused 80C room (ELSS, PPF, life insurance).`);
  if (regime === 'old' && num('80d') === 0) tips.push('Health insurance premiums are deductible under 80D — worth checking if you have a policy.');
  if (regime === 'new') tips.push('The New Regime has fewer deductions but a higher standard deduction and often lower rates for mid-range incomes.');
  tips.push('Run "Compare Regimes" below to see which one saves you more this year.');
  document.getElementById('tax-tips').innerHTML = tips.map(t => `<li>${t}</li>`).join('');
}

function showComparison() {
  const gross = calculateGrossIncome();
  const oldDeductions = calculateTotalDeductions('old');
  const newDeductions = calculateTotalDeductions('new');
  const oldTax = calculateTax(Math.max(0, gross - oldDeductions), 'old').tax;
  const newTax = calculateTax(Math.max(0, gross - newDeductions), 'new').tax;

  document.getElementById('old-regime-tax').textContent = formatCurrency(oldTax);
  document.getElementById('new-regime-tax').textContent = formatCurrency(newTax);
  const diff = Math.abs(oldTax - newTax);
  const better = oldTax <= newTax ? 'Old' : 'New';
  document.getElementById('regime-recommendation').textContent = diff === 0
    ? 'Both regimes result in the same tax liability for your inputs.'
    : `Based on your numbers, the ${better} Regime saves you ${formatCurrency(diff)} this year.`;
  document.getElementById('comparison-modal').hidden = false;
  window.__comparisonBetter = better.toLowerCase();
}

function applyRecommendation() {
  toggleRegime(window.__comparisonBetter || 'old');
  document.getElementById('comparison-modal').hidden = true;
  updateSummary();
}

function exportCSV() {
  if (!lastResult) return;
  const rows = [['Field', 'Value'], ['Regime', lastResult.regime], ['Gross Income', lastResult.gross], ['Total Deductions', lastResult.deductions], ['Taxable Income', lastResult.taxable], ['Tax Liability', lastResult.tax]];
  const csv = rows.map(r => r.join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = 'tax_estimate.csv'; a.click();
}

async function savePlan() {
  if (!lastResult) return;
  try {
    await api.post('/tax-plans', {
      year: new Date().getFullYear().toString(),
      regime: lastResult.regime,
      income: { salary: num('salary'), freelance: num('freelance'), interest: num('interest'), capitalGains: num('capital-gains'), other: num('other-income') },
      deductions: { section80C: num('80c'), section80D: num('80d'), section80TTA: num('80tta'), hra: num('hra'), other: num('other-deductions') },
      taxLiability: lastResult.tax
    });
    showToast('Tax plan saved.');
  } catch (err) { showToast(err.message, 'error'); }
}
