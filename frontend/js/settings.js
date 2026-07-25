requireAuth();

document.addEventListener('DOMContentLoaded', async () => {
  const content = renderShell('settings.html');
  content.appendChild(document.getElementById('tpl').content.cloneNode(true));

  await loadUserProfile();

  document.getElementById('settings-form').addEventListener('submit', handleSettingsSubmit);
  document.getElementById('savePrefsBtn').addEventListener('click', savePreferences);
  document.getElementById('logoutAllBtn').addEventListener('click', () => { if (confirm('Log out?')) logout(); });
});

async function loadUserProfile() {
  try {
    const user = await api.get('/auth/me');
    document.getElementById('settings-name').value = user.name;
    document.getElementById('settings-email').value = user.email;
    document.getElementById('settings-currency').value = user.currency || '₹';
    document.getElementById('settings-darkmode').checked = !!user.darkMode;
    document.getElementById('settings-income').value = user.monthlyIncome || '';
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function handleSettingsSubmit(event) {
  event.preventDefault();
  const errorEl = document.getElementById('settingsError');
  errorEl.style.display = 'none';

  const name = document.getElementById('settings-name').value.trim();
  const email = document.getElementById('settings-email').value.trim();
  const password = document.getElementById('settings-password').value;
  const monthlyIncome = parseFloat(document.getElementById('settings-income').value) || 0;

  if (!/^\S+@\S+\.\S+$/.test(email)) { errorEl.textContent = 'Please enter a valid email address.'; errorEl.style.display = 'block'; return; }
  if (password && password.length < 6) { errorEl.textContent = 'Password must be at least 6 characters.'; errorEl.style.display = 'block'; return; }

  const payload = { name, email, monthlyIncome };
  if (password) payload.password = password; // only sent if the user actually wants to change it

  const btn = document.getElementById('settingsSaveBtn');
  btn.disabled = true; btn.textContent = 'Saving…';
  try {
    const updated = await api.put('/settings', payload);
    const stored = getCurrentUser();
    localStorage.setItem('ft_user', JSON.stringify({ ...stored, ...updated }));
    showToast('Profile updated.');
    document.getElementById('settings-password').value = '';
  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.style.display = 'block';
  } finally {
    btn.disabled = false; btn.textContent = 'Save Changes';
  }
}

async function savePreferences() {
  try {
    const updated = await api.put('/settings', {
      currency: document.getElementById('settings-currency').value,
      darkMode: document.getElementById('settings-darkmode').checked
    });
    const stored = getCurrentUser();
    localStorage.setItem('ft_user', JSON.stringify({ ...stored, ...updated }));
    document.documentElement.classList.toggle('dark', updated.darkMode);
    localStorage.setItem('ft_dark', updated.darkMode ? '1' : '0');
    showToast('Preferences saved.');
  } catch (err) {
    showToast(err.message, 'error');
  }
}
