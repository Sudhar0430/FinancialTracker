// Builds the sidebar + topbar shell on every authenticated page.
const NAV_ITEMS = [
  { href: 'dashboard.html',    label: 'Dashboard',        icon: 'grid',    group: 'Overview' },
  { href: 'transactions.html', label: 'Transactions',     icon: 'list',    group: 'Overview' },
  { href: 'analytics.html',    label: 'Analytics',        icon: 'chart',   group: 'Overview' },
  { href: 'reports.html',      label: 'Reports',          icon: 'doc',     group: 'Overview' },
  { href: 'goals.html',        label: 'Goals',            icon: 'target',  group: 'Planning' },
  { href: 'budget.html',       label: 'Budget Planner',   icon: 'wallet',  group: 'Planning' },
  { href: 'emergency-fund.html', label: 'Emergency Fund', icon: 'shield',  group: 'Planning' },
  { href: 'net-worth.html',    label: 'Net Worth',        icon: 'trend',   group: 'Planning' },
  { href: 'loans.html',        label: 'Loan Manager',     icon: 'bank',    group: 'Obligations' },
  { href: 'subscriptions.html',label: 'Subscriptions',    icon: 'repeat',  group: 'Obligations' },
  { href: 'insurance.html',    label: 'Insurance',        icon: 'umbrella',group: 'Obligations' },
  { href: 'tax-estimator.html',label: 'Tax Estimator',    icon: 'percent', group: 'Obligations' },
  { href: 'investments.html',  label: 'Investments',      icon: 'candlestick', group: 'Markets' },
  { href: 'ai-advisor.html',   label: 'AI Advisor',       icon: 'spark',   group: 'Markets' },
  { href: 'settings.html',     label: 'Settings',         icon: 'gear',    group: 'Account' },
];

const ICONS = {
  grid: '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="8" height="8" rx="1.5"/><rect x="13" y="3" width="8" height="8" rx="1.5"/><rect x="3" y="13" width="8" height="8" rx="1.5"/><rect x="13" y="13" width="8" height="8" rx="1.5"/></svg>',
  list: '<svg viewBox="0 0 24 24"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/></svg>',
  chart: '<svg viewBox="0 0 24 24"><line x1="4" y1="20" x2="4" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="20" y1="20" x2="20" y2="14"/></svg>',
  doc: '<svg viewBox="0 0 24 24"><path d="M6 2h9l5 5v15H6z"/><line x1="9" y1="13" x2="17" y2="13"/><line x1="9" y1="17" x2="17" y2="17"/></svg>',
  target: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/></svg>',
  wallet: '<svg viewBox="0 0 24 24"><path d="M3 7a2 2 0 0 1 2-2h13a1 1 0 0 1 1 1v3"/><path d="M3 7v11a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1H8"/><circle cx="16" cy="14" r="1.4"/></svg>',
  shield: '<svg viewBox="0 0 24 24"><path d="M12 2l8 4v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6z"/></svg>',
  trend: '<svg viewBox="0 0 24 24"><polyline points="3,17 9,11 13,15 21,6"/><polyline points="15,6 21,6 21,12"/></svg>',
  bank: '<svg viewBox="0 0 24 24"><line x1="3" y1="21" x2="21" y2="21"/><line x1="5" y1="21" x2="5" y2="10"/><line x1="10" y1="21" x2="10" y2="10"/><line x1="14" y1="21" x2="14" y2="10"/><line x1="19" y1="21" x2="19" y2="10"/><polygon points="12,2 21,8 3,8"/></svg>',
  repeat: '<svg viewBox="0 0 24 24"><polyline points="17,1 21,5 17,9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7,23 3,19 7,15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>',
  umbrella: '<svg viewBox="0 0 24 24"><path d="M12 3a9 9 0 0 1 9 9H3a9 9 0 0 1 9-9z"/><line x1="12" y1="3" x2="12" y2="21"/><path d="M12 21a2.5 2.5 0 0 1-2.5-2.5"/></svg>',
  percent: '<svg viewBox="0 0 24 24"><line x1="19" y1="5" x2="5" y2="19"/><circle cx="6.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/></svg>',
  candlestick: '<svg viewBox="0 0 24 24"><line x1="6" y1="2" x2="6" y2="8"/><rect x="4" y="8" width="4" height="7"/><line x1="6" y1="15" x2="6" y2="22"/><line x1="16" y1="4" x2="16" y2="9"/><rect x="14" y="9" width="4" height="9"/><line x1="16" y1="18" x2="16" y2="22"/></svg>',
  spark: '<svg viewBox="0 0 24 24"><path d="M12 2l2.2 6.8L21 11l-6.8 2.2L12 20l-2.2-6.8L3 11l6.8-2.2z"/></svg>',
  gear: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1 1.55V21a2 2 0 0 1-4 0v-.09A1.7 1.7 0 0 0 9 19.36a1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.64 15a1.7 1.7 0 0 0-1.55-1H3a2 2 0 0 1 0-4h.09A1.7 1.7 0 0 0 4.64 9a1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.64 1.7 1.7 0 0 0 10 3.09V3a2 2 0 0 1 4 0v.09a1.7 1.7 0 0 0 1 1.55 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.36 9a1.7 1.7 0 0 0 1.55 1H21a2 2 0 0 1 0 4h-.09a1.7 1.7 0 0 0-1.55 1z"/></svg>',
};

function renderShell(activeHref) {
  const user = getCurrentUser();
  const groups = [...new Set(NAV_ITEMS.map(i => i.group))];

  const navHtml = groups.map(group => `
    <div class="nav-group">
      <div class="nav-group-label">${group}</div>
      ${NAV_ITEMS.filter(i => i.group === group).map(item => `
        <a href="${item.href}" class="nav-link ${item.href === activeHref ? 'active' : ''}">
          <span class="nav-icon">${ICONS[item.icon]}</span>
          <span>${item.label}</span>
        </a>
      `).join('')}
    </div>
  `).join('');

  const shell = document.createElement('div');
  shell.className = 'app-shell';
  shell.innerHTML = `
    <aside class="sidebar">
      <div class="brand">
        <div class="brand-left">
          <span class="brand-mark">◆</span>
          <span class="brand-name">Ledgerly</span>
        </div>
        <button class="sidebar-close-btn" id="sidebarCloseBtn" aria-label="Close menu">
          <svg viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12"/></svg>
        </button>
      </div>
      <nav class="nav">${navHtml}</nav>
      <div class="sidebar-footer">
        <button class="btn-ghost" id="darkModeToggle" title="Toggle dark mode">
          <svg viewBox="0 0 24 24" width="16" height="16"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.2" y1="4.2" x2="5.6" y2="5.6"/><line x1="18.4" y1="18.4" x2="19.8" y2="19.8"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.2" y1="19.8" x2="5.6" y2="18.4"/><line x1="18.4" y1="5.6" x2="19.8" y2="4.2"/></svg>
          Theme
        </button>
      </div>
    </aside>
    <div class="main-col">
      <header class="topbar">
        <button class="mobile-nav-toggle" id="mobileNavToggle" aria-label="Menu">
          <svg viewBox="0 0 24 24" width="20" height="20"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
        </button>
        <div class="topbar-spacer"></div>
        <div class="user-chip" id="userChip">
          <div class="avatar">${(user && user.name ? user.name[0] : 'U').toUpperCase()}</div>
          <div class="user-meta">
            <div class="user-name">${user ? user.name : 'Guest'}</div>
            <div class="user-email">${user ? user.email : ''}</div>
          </div>
          <button class="btn-ghost" id="logoutBtn">Log out</button>
        </div>
      </header>
      <main class="content" id="pageContent"></main>
    </div>
  `;
  document.body.prepend(shell);

  document.getElementById('logoutBtn').addEventListener('click', logout);
  document.getElementById('mobileNavToggle').addEventListener('click', () => {
    shell.querySelector('.sidebar').classList.toggle('open');
  });
  document.getElementById('sidebarCloseBtn').addEventListener('click', () => {
    shell.querySelector('.sidebar').classList.remove('open');
  });
  document.getElementById('darkModeToggle').addEventListener('click', () => {
    document.documentElement.classList.toggle('dark');
    localStorage.setItem('ft_dark', document.documentElement.classList.contains('dark') ? '1' : '0');
  });
  if (localStorage.getItem('ft_dark') === '1') document.documentElement.classList.add('dark');

  return document.getElementById('pageContent');
}
