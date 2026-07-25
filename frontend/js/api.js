// Thin fetch wrapper: attaches the JWT, handles JSON, and redirects to login on 401.
const api = {
  async request(path, options = {}) {
    const token = localStorage.getItem('ft_token');
    const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
    if (token) headers.Authorization = `Bearer ${token}`;

    const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

    if (res.status === 401) {
      localStorage.removeItem('ft_token');
      localStorage.removeItem('ft_user');
      if (!window.location.pathname.endsWith('login.html') && !window.location.pathname.endsWith('index.html') && window.location.pathname !== '/') {
        window.location.href = 'login.html';
      }
      throw new Error('Unauthorized');
    }

    const contentType = res.headers.get('content-type') || '';
    const data = contentType.includes('application/json') ? await res.json() : null;

    if (!res.ok) {
      throw new Error((data && data.message) || 'Something went wrong. Please try again.');
    }
    return data;
  },
  get(path) { return this.request(path); },
  post(path, body) { return this.request(path, { method: 'POST', body: JSON.stringify(body) }); },
  put(path, body) { return this.request(path, { method: 'PUT', body: JSON.stringify(body) }); },
  del(path) { return this.request(path, { method: 'DELETE' }); }
};

function requireAuth() {
  if (!localStorage.getItem('ft_token')) {
    window.location.href = 'login.html';
  }
}

function getCurrentUser() {
  try { return JSON.parse(localStorage.getItem('ft_user')); } catch { return null; }
}

function logout() {
  localStorage.removeItem('ft_token');
  localStorage.removeItem('ft_user');
  window.location.href = 'login.html';
}

function formatCurrency(amount) {
  const user = getCurrentUser();
  const symbol = (user && user.currency) || '₹';
  const n = Number(amount) || 0;
  return `${symbol}${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function showToast(message, type = 'success') {
  let container = document.getElementById('toastContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toastContainer';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('show'));
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 3200);
}
