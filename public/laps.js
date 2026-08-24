// ===== Theme =====
let currentTheme = localStorage.getItem('hostaka_theme') || 'light';
function setTheme(theme) {
  const html = document.documentElement;
  if (theme === 'dark') html.setAttribute('data-theme', 'dark'); else html.removeAttribute('data-theme');
  currentTheme = theme;
  localStorage.setItem('hostaka_theme', theme);
}
function toggleTheme() { setTheme(currentTheme === 'light' ? 'dark' : 'light'); }
setTheme(currentTheme);

// ===== Language (default English; user can switch to Arabic) =====
// i18n.js already applies the saved hostaka_lang on load / on setHostakaLang().
// We just flip the toggle-button label to always show the OTHER language.
function refreshLangToggleLabel() {
  const label = document.getElementById('langToggleLabel');
  if (!label) return;
  const lang = (window.currentLang === 'ar') ? 'ar' : 'en';
  label.textContent = lang === 'ar' ? 'English' : 'العربية';
}
function toggleLapsLang() {
  const next = (window.currentLang === 'ar') ? 'en' : 'ar';
  window.setHostakaLang(next);
}
document.addEventListener('hostaka:langchange', refreshLangToggleLabel);
refreshLangToggleLabel();

// ===== Auth helpers =====
function getToken() { return localStorage.getItem('hostaka_token') || ''; }

async function apiFetch(url, method = 'GET', body = null) {
  const token = getToken();
  const opts = { method, headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token } };
  if (body) opts.body = JSON.stringify(body);
  const r = await fetch(url, opts);
  return r.json();
}

// إذا ما فيه توكن محلي، جرّب تسحبه بصمت من وسيط التحقق المركزي
// (oauth.hostaka.fun) قبل ما نكمل — يسجّل حساب المستخدم تلقائياً بهذا
// النطاق الفرعي لو كان مسجّل دخول أصلاً بمكان ثاني بالمنظومة، بدون أي
// خطوة يدوية منه.
async function pullOAuthSessionIfNeeded() {
  if (getToken()) return;
  try {
    const r = await fetch('https://oauth.hostaka.fun/api/token', { credentials: 'include' });
    if (r.ok) {
      const d = await r.json();
      if (d && d.token) localStorage.setItem('hostaka_token', d.token);
    }
  } catch (e) {}
}

function renderUserChip(me) {
  const chip = document.getElementById('userChip');
  const avatar = document.getElementById('userAvatar');
  const name = document.getElementById('userName');
  if (!chip || !me) return;
  name.textContent = me.name || me.username || '';
  if (me.avatar) {
    avatar.innerHTML = '<img src="' + me.avatar + '" alt="">';
  } else {
    const initial = (me.name || me.username || '?').trim().charAt(0).toUpperCase();
    avatar.textContent = initial;
  }
  chip.classList.add('show');
}

async function initLaps() {
  await pullOAuthSessionIfNeeded();
  if (getToken()) {
    try {
      const me = await apiFetch('/api/me');
      if (me && !me.error) renderUserChip(me);
    } catch (e) { /* الصفحة تبقى شغّالة حتى لو تعذّر التحقق */ }
  }
}

initLaps();
