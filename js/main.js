// Simula ng app: auth, listeners, render, at mga event.
import { DB, ctx, ui, isAdmin, cfg } from './state.js';
import { setCurrency } from './util.js';
import { $, curModal, toast, getTheme, setTheme } from './dom.js';
import { shell, searchResults } from './views.js';
import { authState, authHTML, initAuth, submitLogin, submitJoin, submitMfa, submitEnroll, meterUpdate, doSignOut } from './auth.js';
import { startListeners, stopListeners } from './data.js';
import { A, bindRender, tplChange, saveSetting } from './actions.js';
import { OPTIONS } from './config.js';

const root = $('#root');
let prompted = false;

function render() {
  if (authState.stage !== 'ready') {
    root.innerHTML = authHTML();
    const f = root.querySelector('input');
    if (f) f.focus();
    return;
  }
  setCurrency(cfg().currency);
  root.innerHTML = shell();
  const sel = document.getElementById('theme-sel');
  if (sel) sel.value = getTheme();
}

let rt = null;
function scheduleRender() {
  clearTimeout(rt);
  rt = setTimeout(() => {
    const a = document.activeElement;
    if (authState.stage === 'ready' && a && root.contains(a) && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)) { rt = setTimeout(scheduleRender, 600); return; }
    render();
    afterData();
  }, 60);
}

// Kapag admin at wala pang team passphrase, ipakita ang setup minsan.
function afterData() {
  if (authState.stage === 'ready' && !ctx.pending.size && isAdmin() && !DB.vault && !prompted && !curModal()) { prompted = true; A.setupVault(); }
}

/* ---------- idle ---------- */
let keyT = null, outT = null;
function resetIdle() {
  clearTimeout(keyT); clearTimeout(outT);
  if (authState.stage !== 'ready') return;
  if (OPTIONS.idleKeyLockMinutes > 0) keyT = setTimeout(() => { if (ctx.key) { ctx.key = null; render(); toast('Secrets locked after a while idle'); } }, OPTIONS.idleKeyLockMinutes * 60000);
  if (OPTIONS.idleSignOutMinutes > 0) outT = setTimeout(() => { authState.notice = 'You were signed out after being idle.'; doSignOut(); }, OPTIONS.idleSignOutMinutes * 60000);
}
['pointerdown', 'keydown', 'scroll', 'touchstart'].forEach((e) => window.addEventListener(e, resetIdle, { passive: true }));

/* ---------- events ---------- */
document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const fn = A[el.dataset.act];
  if (!fn) return;
  e.preventDefault();
  Promise.resolve().then(() => fn(el, e)).catch((err) => { console.error(err); toast('Something went wrong: ' + (err && err.message ? err.message : err)); });
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { const m = curModal(); if (m) m.el.remove(), A.close(); }
  const t = e.target;
  if ((e.key === 'Enter' || e.key === ' ') && t.matches && t.matches('[role="button"][data-act]')) { e.preventDefault(); t.click(); }
  if (e.key === '/' && authState.stage === 'ready' && !curModal() && !/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName || '')) {
    e.preventDefault(); ui.view = 'search'; ui.appId = null; ui.clientId = null; render();
    const q = document.getElementById('gq'); if (q) q.focus();
  }
});
document.addEventListener('submit', (e) => {
  e.preventDefault();
  const id = e.target.id;
  if (id === 'mform') { const m = curModal(); if (m && m.onSubmit) m.onSubmit(); }
  else if (id === 'f-login') submitLogin();
  else if (id === 'f-join') submitJoin();
  else if (id === 'f-mfa') submitMfa();
  else if (id === 'f-enroll') submitEnroll();
});
document.addEventListener('input', (e) => {
  const t = e.target;
  if (t.id === 'jn-pass') meterUpdate(t.value);
  else if (t.id === 'gq') { ui.q = t.value; const r = document.getElementById('sres'); if (r) r.innerHTML = searchResults(ui.q); }
});
document.addEventListener('change', async (e) => {
  const t = e.target;
  if (t.id === 'theme-sel') { setTheme(t.value); return; }
  if (t.dataset && t.dataset.f) { ui[t.dataset.f] = t.value; render(); return; }
  if (t.dataset && t.dataset.tplsel !== undefined) { tplChange(t); return; }
  if (t.dataset && t.dataset.set && isAdmin()) {
    const k = t.dataset.set;
    let v = t.value;
    if (k === 'warnDays') v = Math.min(60, Math.max(1, Number(v) || 7));
    else if (k === 'renewWarnDays') v = Math.min(180, Math.max(1, Number(v) || 30));
    else if (k === 'currency') v = v.trim().slice(0, 4) || '₱';
    try { await saveSetting(k, v); toast('Saved'); } catch (err) { console.error(err); toast('Could not save that setting.'); }
  }
});

/* ---------- boot ---------- */
setTheme(getTheme());
bindRender(render);
initAuth({
  change: render,
  reset: () => { stopListeners(); ctx.key = null; prompted = false; },
  ready: () => {
    startListeners(isAdmin(), (err) => {
      if (err) toast('Some data could not load: ' + (err.code || err.message));
      if (ctx.relocked) { ctx.relocked = false; toast('The team passphrase was changed. Unlock with the new one.'); }
      scheduleRender();
    });
    resetIdle();
    render();
  },
});
render();
