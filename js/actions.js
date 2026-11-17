// Lahat ng pindot sa app. Ang bawat key ng A ay tugma sa data-act sa views.js at auth.js.
import { DB, ctx, ui, isAdmin, cfg, HOSTS, SVC_TYPES, PROVIDERS, LOGIN_ROLES, STATUSES, KINDS, LOG_TYPES, RENEW_KINDS } from './state.js';
import { esc, money, fmtD, todayISO, addDays, addMonthsISO, toCSV, fillTemplate, genPass } from './util.js';
import { ic } from './icons.js';
import { $, modal, closeModal, curModal, confirmBox, openForm, toast, copyText, downloadText, downloadBlob, printHTML, getTheme, setTheme } from './dom.js';
import { add, upd, del, setSetting, createVaultDoc, inviteEmail, putFile, getFileData, delFile, delAppCascade, unlinkClient, setUserRole, removeUserAccess, commitRotation, MAX_ROTATE_WRITES, logEvent, commitRestore } from './data.js';
import { createVaultMeta, openVault, encStr, decStr, encBytes, decBytes } from './vcrypto.js';
import { buildRotation } from './rotate.js';
import { buildBackup, planRestore } from './backup.js';
import { CYCLES, applyPayment, periodInfo, billStatus } from './billing.js';
import { receiptHTML, invoiceHTML, receiptText } from './docs.js';
import { OPTIONS, VERSION } from './config.js';
import { setTab, forgot, resend, checkVerified, doSignOut } from './auth.js';
import { appName } from './views.js';

export const A = {};
let R = () => {};
export const bindRender = (f) => { R = f; };

const find = (coll, id) => DB[coll].find((x) => x.id === id);
const curApp = () => DB.apps.find((a) => a.id === ui.appId);
const form = (inner) => '<form id="mform" novalidate>' + inner + '</form>';
const top = () => window.scrollTo(0, 0);
let lastDoc = null;
let msgCtx = null;

/* ---------- vault key ---------- */
export function unlockModal(then) {
  const m = modal({
    title: 'Unlock secrets',
    body: form('<p class="muted">Enter the team passphrase. It stays in this tab\'s memory only and is forgotten when you lock, go idle or close the tab.</p><div class="fld"><label for="up">Team passphrase</label><div class="pw"><input id="up" type="password" autocomplete="off"><button type="button" class="icon-btn" data-act="tpw" data-t="up" title="Show or hide">' + ic('eye') + '</button></div></div><div class="form-err" id="ferr" role="alert"></div>'),
    foot: '<button class="btn ghost" data-act="close">Cancel</button><button class="btn pri" data-act="submit-form">Unlock</button>',
  });
  m.onSubmit = async () => {
    try { const meta = DB.vault; ctx.key = await openVault($('#up').value, meta); ctx.keySalt = meta.salt; } catch (e) { $('#ferr', m.el).textContent = 'Wrong passphrase.'; return; }
    closeModal();
    const lb = document.querySelector('.lockbar');
    if (lb) lb.remove();
    toast('Unlocked');
    logEvent('unlock', '');
    if (then) await then();
  };
}
function withKey(fn) {
  return async (el, e) => {
    const run = async () => { try { await fn(el, e); } catch (err) { console.error(err); toast('Could not do that: ' + (err && err.message ? err.message : err)); } };
    if (ctx.key) return run();
    if (!DB.vault) { if (isAdmin()) return A.setupVault(); toast('Ask the admin to create the team passphrase first.'); return; }
    unlockModal(run);
  };
}
A.unlock = () => unlockModal(null);
A.lockSecrets = () => { ctx.key = null; R(); toast('Secrets locked'); };
A.changePass = () => {
  if (!isAdmin() || !DB.vault) return;
  const m = modal({
    title: 'Change the team passphrase',
    body: form('<p class=\"muted\">Every saved password, key, .env and file is decrypted with the old passphrase and encrypted again with the new one, all in one step. Ask your team to stop editing until it finishes. Afterwards they must unlock with the new passphrase.</p><div class=\"fld\"><label for=\"cp0\">Current passphrase</label><input id=\"cp0\" type=\"password\" autocomplete=\"off\"></div><div class=\"fld\"><label for=\"cp1\">New passphrase</label><div class=\"pw\"><input id=\"cp1\" type=\"password\" autocomplete=\"off\" placeholder=\"At least 10 characters\"><button type=\"button\" class=\"icon-btn\" data-act=\"tpw\" data-t=\"cp1\" title=\"Show or hide\">' + ic('eye') + '</button></div></div><div class=\"fld\"><label for=\"cp2\">Repeat new passphrase</label><input id=\"cp2\" type=\"password\" autocomplete=\"off\"></div><label class=\"check\"><input id=\"cpack\" type=\"checkbox\"><span>I wrote the new passphrase down. It cannot be recovered.</span></label><div class=\"form-err\" id=\"ferr\" role=\"alert\"></div>'),
    foot: '<button class=\"btn ghost\" data-act=\"close\">Cancel</button><button class=\"btn pri\" data-act=\"submit-form\">Change passphrase</button>',
  });
  let working = false;
  m.onSubmit = async () => {
    if (working) return;
    const err = (t) => { $('#ferr', m.el).textContent = t; };
    const p0 = $('#cp0').value, p1 = $('#cp1').value, p2 = $('#cp2').value;
    if (!p0) return err('Type the current passphrase.');
    if (p1.length < 10) return err('Use at least 10 characters for the new passphrase.');
    if (p1 !== p2) return err('The two new passphrases do not match.');
    if (p1 === p0) return err('The new passphrase is the same as the old one.');
    if (!$('#cpack').checked) return err('Please tick the box to continue.');
    const count = DB.logins.filter((x) => x.pass).length + DB.services.filter((x) => x.secret).length + DB.envs.filter((x) => x.content).length + DB.files.length;
    if (count > MAX_ROTATE_WRITES) return err('Too many saved items to change safely at once (' + count + '). Nothing was changed.');
    working = true; ctx.rotating = true;
    try {
      let oldKey;
      try { oldKey = await openVault(p0, DB.vault); } catch (e) { err('The current passphrase is wrong.'); return; }
      err('Working… do not close this window.');
      const r = await createVaultMeta(p1);
      const ops = await buildRotation(oldKey, r.key, DB, getFileData);
      await commitRotation(ops, r.meta);
      ctx.key = r.key; ctx.keySalt = r.meta.salt;
      closeModal();
      toast('Passphrase changed. ' + ops.length + ' items re-encrypted.');
      logEvent('change passphrase', ops.length + ' items');
    } catch (e) {
      console.error(e);
      err('Nothing was changed. ' + (e && e.message ? e.message : e));
    } finally { working = false; ctx.rotating = false; R(); }
  };
};
A.setupVault = () => {
  if (!isAdmin()) return;
  if (DB.vault) return unlockModal(null);
  const m = modal({
    title: 'Create the team passphrase',
    body: form('<p class="muted">This passphrase encrypts passwords, API keys, .env text and files <b>in the browser</b> before they are saved. Share it with your developers in person or by a secure channel. Firebase and Google never see it.</p><div class="fld"><label for="sp1">Passphrase</label><div class="pw"><input id="sp1" type="password" autocomplete="off" placeholder="At least 10 characters"><button type="button" class="icon-btn" data-act="tpw" data-t="sp1" title="Show or hide">' + ic('eye') + '</button></div></div><div class="fld"><label for="sp2">Repeat passphrase</label><input id="sp2" type="password" autocomplete="off"></div><label class="check"><input id="sack" type="checkbox"><span>I understand it cannot be recovered. If everyone forgets it, the saved secrets are lost.</span></label><div class="form-err" id="ferr" role="alert"></div>'),
    foot: '<button class="btn ghost" data-act="close">Later</button><button class="btn pri" data-act="submit-form">Create passphrase</button>',
  });
  m.onSubmit = async () => {
    const p1 = $('#sp1').value, p2 = $('#sp2').value, err = (t) => { $('#ferr', m.el).textContent = t; };
    if (p1.length < 10) return err('Use at least 10 characters. A few random words works well.');
    if (p1 !== p2) return err('The two passphrases do not match.');
    if (!$('#sack').checked) return err('Please tick the box to continue.');
    const r = await createVaultMeta(p1);
    await createVaultDoc(r.meta);
    logEvent('create passphrase', '');
    ctx.key = r.key;
    ctx.keySalt = r.meta.salt;
    closeModal();
    toast('Team passphrase created');
  };
};

/* ---------- navigation + ui state ---------- */
A.nav = (el) => { ui.view = el.dataset.v; ui.appId = null; ui.clientId = null; R(); top(); };
A.goPay = () => { ui.view = 'payments'; ui.appId = null; R(); top(); };
A.goRenew = () => { ui.view = 'renewals'; ui.appId = null; R(); top(); };
A.openApp = (el) => { ui.view = 'apps'; ui.appId = el.dataset.id; ui.tab = el.dataset.tab || 'overview'; R(); top(); };
A.openClient = (el) => { ui.view = 'clients'; ui.clientId = el.dataset.id; ui.appId = null; R(); top(); };
A.back = () => { ui.appId = null; R(); top(); };
A.backClient = () => { ui.clientId = null; R(); top(); };
A.tab = (el) => { ui.tab = el.dataset.v; R(); };
A.pfilter = (el) => { ui.pf = el.dataset.v; R(); };
A.rfilter = (el) => { ui.rf = el.dataset.v; R(); };
A.toggleArchived = () => { ui.showArchived = !ui.showArchived; R(); };
A.close = () => closeModal();
A['submit-form'] = () => { const m = curModal(); if (m && m.onSubmit) m.onSubmit(); };
A.yes = async () => { const m = curModal(); const f = m && m.onYes; closeModal(); if (f) await f(); };
A.theme = () => { const o = ['system', 'light', 'dark']; const t = o[(o.indexOf(getTheme()) + 1) % 3]; setTheme(t); toast('Theme: ' + t); R(); };
A.tpw = (el) => { const i = document.getElementById(el.dataset.t); if (i) i.type = i.type === 'password' ? 'text' : 'password'; };
A.genpw = (el) => { const i = document.getElementById(el.dataset.t); if (i) { i.value = genPass(); i.type = 'text'; } };
A.copyv = (el) => copyText(el.dataset.val, !!el.dataset.sens);
A.cfrom = (el) => { const t = document.getElementById(el.dataset.t); if (t) { t.select(); copyText(t.value, false); } };
A.signout = () => doSignOut();
A.authTab = (el) => setTab(el.dataset.v);
A.forgot = () => forgot();
A.resend = () => resend();
A.checkVerified = () => checkVerified();

const ask = (msg, fn, label) => confirmBox(msg, fn, label);

/* ---------- secrets: reveal / copy ---------- */
const lab = (it) => { if (!it) return ''; const a = it.appId ? appName(it.appId) : ''; const n = it.label || it.name || it.title || it.username || it.user || ''; return (a + (a && n ? ' · ' : '') + n).slice(0, 150); };
function secretItem(el) { return find(el.dataset.coll, el.dataset.id); }
A.reveal = withKey(async (el) => {
  const code = el.closest('.sec').querySelector('[data-sec]');
  if (el.dataset.on) { code.textContent = '••••••••••'; delete el.dataset.on; return; }
  code.textContent = (await decStr(ctx.key, secretItem(el)[el.dataset.f])) || '—';
  el.dataset.on = '1';
  logEvent('reveal secret', lab(secretItem(el)));
});
A.copy = withKey(async (el) => { await copyText(await decStr(ctx.key, secretItem(el)[el.dataset.f]), true); logEvent('copy secret', lab(secretItem(el))); });

/* ---------- apps ---------- */
function appFields() {
  const f = [
    { k: 'name', label: 'App name', req: true, ph: 'e.g. Clinic Queue App' },
    { k: 'tagline', label: 'Short description', ph: 'One line about what it does' },
    { k: 'status', label: 'Status', type: 'select', opts: STATUSES, half: true },
    { k: 'url', label: 'Live URL', ph: 'https://', half: true },
  ];
  if (isAdmin()) f.push({ k: 'clientId', label: 'Client', type: 'select', opts: [['', '— None —']].concat(DB.clients.map((c) => [c.id, c.name])) });
  f.push(
    { k: 'description', label: 'Full description', type: 'textarea', rows: 4 },
    { k: 'features', label: 'Features', type: 'lines', rows: 4, hint: 'One feature per line' },
    { k: 'inclusions', label: 'What is included', type: 'lines', rows: 3, hint: 'One item per line. The package the client gets.' },
    { k: 'stack', label: 'Tech stack', type: 'csv', ph: 'React, Firebase, Tailwind', hint: 'Separate with commas' },
    { k: 'tags', label: 'Tags', type: 'csv', ph: 'client-work, clinic, 2026', hint: 'Separate with commas. Use them to filter the Apps page.' },
    { k: 'notes', label: 'Private notes', type: 'textarea', rows: 3 },
  );
  return f;
}
A.addApp = () => openForm({ title: 'Add app', fields: appFields(), values: { status: 'live' }, onSave: async (v) => { const id = await add('apps', Object.assign({}, v, { repo: {}, deploys: [], archived: false })); ui.view = 'apps'; ui.appId = id; ui.tab = 'overview'; R(); toast('App added'); } });
A.editApp = () => { const a = curApp(); openForm({ title: 'Edit app', fields: appFields(), values: a, onSave: async (v) => { await upd('apps', a.id, v); toast('Saved'); } }); };
A.archiveApp = async () => { const a = curApp(); await upd('apps', a.id, { archived: !a.archived }); toast(a.archived ? 'Restored' : 'Archived'); };
A.delApp = () => { const a = curApp(); ask('Delete "' + a.name + '" with its logins, keys, files, payment plans and update history? This cannot be undone.', async () => { await delAppCascade(a.id, isAdmin()); ui.appId = null; R(); toast('App deleted'); }); };
A.editRepo = () => {
  const a = curApp();
  openForm({
    title: 'GitHub repository',
    fields: [
      { k: 'account', label: 'GitHub account or organization', ph: 'your-username', half: true },
      { k: 'name', label: 'Repository name', ph: 'my-app', half: true },
      { k: 'url', label: 'Repository link', ph: 'https://github.com/...', hint: 'Leave empty to build it from the account and name' },
      { k: 'branch', label: 'Branch', def: 'main', half: true },
      { k: 'visibility', label: 'Visibility', type: 'select', opts: ['Private', 'Public'], half: true },
      { k: 'notes', label: 'Notes', type: 'textarea', rows: 2 },
    ],
    values: a.repo || {},
    onSave: async (v) => { if (!v.url && v.account && v.name) v.url = 'https://github.com/' + v.account + '/' + v.name; await upd('apps', a.id, { repo: v }); toast('Saved'); },
  });
};

/* deployments live inside the app document */
const deployFields = () => [
  { k: 'provider', label: 'Hosting provider', type: 'select', opts: HOSTS, req: true, half: true },
  { k: 'custom', label: 'Custom name', half: true, ph: 'Only if you chose Other' },
  { k: 'account', label: 'Account (email or username)', ph: 'you@example.com' },
  { k: 'project', label: 'Project or site name', half: true },
  { k: 'url', label: 'Live URL', half: true, ph: 'https://' },
  { k: 'domain', label: 'Custom domain', ph: 'app.yourdomain.com' },
  { k: 'notes', label: 'Notes', type: 'textarea', rows: 2 },
];
const provVals = (v) => (HOSTS.indexOf(v.provider) >= 0 ? Object.assign({}, v, { custom: '' }) : Object.assign({}, v, { provider: 'Other', custom: v.provider }));
const provSave = (v) => { const o = Object.assign({}, v); if (o.provider === 'Other' && o.custom) o.provider = o.custom; delete o.custom; return o; };
const newId = () => Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);
A.addDeploy = () => { const a = curApp(); openForm({ title: 'Add deployment', fields: deployFields(), values: { provider: 'Vercel' }, onSave: async (v) => { await upd('apps', a.id, { deploys: (a.deploys || []).concat([Object.assign({ id: newId() }, provSave(v))]) }); toast('Deployment added'); } }); };
A.editDeploy = (el) => { const a = curApp(), d = (a.deploys || []).find((x) => x.id === el.dataset.id); openForm({ title: 'Edit deployment', fields: deployFields(), values: provVals(d), onSave: async (v) => { await upd('apps', a.id, { deploys: a.deploys.map((x) => (x.id === d.id ? Object.assign({ id: d.id }, provSave(v)) : x)) }); toast('Saved'); } }); };
A.delDeploy = (el) => { const a = curApp(); ask('Remove this deployment?', async () => { await upd('apps', a.id, { deploys: a.deploys.filter((x) => x.id !== el.dataset.id) }); toast('Removed'); }, 'Remove'); };

/* ---------- accounts, logins, env (encrypted fields) ---------- */
const svcFields = () => [
  { k: 'type', label: 'Type', type: 'select', opts: SVC_TYPES, half: true },
  { k: 'provider', label: 'Provider', list: PROVIDERS, half: true, ph: 'e.g. Supabase' },
  { k: 'account', label: 'Account (email or username)' },
  { k: 'project', label: 'Project, ID or URL' },
  { k: 'secret', label: 'API key / secret / token', type: 'password', hint: 'Encrypted in your browser before saving.' },
  { k: 'notes', label: 'Notes', type: 'textarea', rows: 2 },
];
A.addService = withKey(() => openForm({ title: 'Add account or key', fields: svcFields(), values: { type: 'Firebase' }, onSave: async (v) => { await add('services', Object.assign({}, v, { appId: ui.appId, secret: await encStr(ctx.key, v.secret) })); toast('Saved'); } }));
A.editService = withKey(async (el) => { const s = find('services', el.dataset.id); openForm({ title: 'Edit account or key', fields: svcFields(), values: Object.assign({}, s, { secret: await decStr(ctx.key, s.secret) }), onSave: async (v) => { await upd('services', s.id, Object.assign({}, v, { secret: await encStr(ctx.key, v.secret) })); toast('Saved'); } }); });
A.delService = (el) => ask('Delete this saved account?', async () => { await del('services', el.dataset.id); toast('Deleted'); });

const loginFields = () => [
  { k: 'role', label: 'Login type', type: 'select', opts: LOGIN_ROLES, half: true },
  { k: 'url', label: 'Login page', half: true, ph: 'https://' },
  { k: 'user', label: 'Username or email' },
  { k: 'pass', label: 'Password', type: 'password', gen: true, hint: 'Encrypted in your browser before saving.' },
  { k: 'notes', label: 'Notes', type: 'textarea', rows: 2, ph: 'e.g. 2FA on, shared with client' },
];
A.addLogin = withKey(() => openForm({ title: 'Add login', fields: loginFields(), values: { role: 'Developer' }, onSave: async (v) => { await add('logins', Object.assign({}, v, { appId: ui.appId, pass: await encStr(ctx.key, v.pass) })); toast('Saved'); } }));
A.editLogin = withKey(async (el) => { const l = find('logins', el.dataset.id); openForm({ title: 'Edit login', fields: loginFields(), values: Object.assign({}, l, { pass: await decStr(ctx.key, l.pass) }), onSave: async (v) => { await upd('logins', l.id, Object.assign({}, v, { pass: await encStr(ctx.key, v.pass) })); toast('Saved'); } }); });
A.delLogin = (el) => ask('Delete this login?', async () => { await del('logins', el.dataset.id); toast('Deleted'); });

const envFields = () => [
  { k: 'name', label: 'File name', req: true, ph: '.env.production' },
  { k: 'content', label: 'Contents', type: 'textarea', rows: 9, mono: true, raw: true, ph: 'KEY=value', hint: 'Encrypted in your browser before saving.' },
  { k: 'notes', label: 'Notes', type: 'textarea', rows: 2 },
];
A.addEnv = withKey(() => openForm({ title: 'Add .env file', wide: true, fields: envFields(), values: { name: '.env' }, onSave: async (v) => { await add('envs', Object.assign({}, v, { appId: ui.appId, content: await encStr(ctx.key, v.content) })); toast('Saved'); } }));
A.editEnv = withKey(async (el) => { const e = find('envs', el.dataset.id); openForm({ title: 'Edit .env file', wide: true, fields: envFields(), values: Object.assign({}, e, { content: await decStr(ctx.key, e.content) }), onSave: async (v) => { await upd('envs', e.id, Object.assign({}, v, { content: await encStr(ctx.key, v.content) })); toast('Saved'); } }); });
A.delEnv = (el) => ask('Delete this .env file?', async () => { await del('envs', el.dataset.id); toast('Deleted'); });

/* ---------- files ---------- */
async function shrinkImage(file, maxBytes) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    let scale = Math.min(1, 1600 / Math.max(img.width, img.height));
    let q = 0.82;
    for (let t = 0; t < 5; t++) {
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', q));
      if (blob && blob.size <= maxBytes) return blob;
      scale *= 0.8; q = Math.max(0.5, q - 0.08);
    }
  } finally { URL.revokeObjectURL(url); }
  return null;
}
A.addFile = withKey(() => {
  const max = OPTIONS.maxFileKB * 1024;
  const m = modal({
    title: 'Upload file',
    body: form('<p class="muted small">The file is encrypted in your browser before it is saved. Up to ' + OPTIONS.maxFileKB + ' KB. Large photos are shrunk automatically.</p><div class="fld"><label for="upf">File</label><input id="upf" type="file"></div><div class="fld"><label for="upn">Note</label><input id="upn" type="text" placeholder="e.g. Signed contract"></div><div class="form-err" id="ferr" role="alert"></div>'),
    foot: '<button class="btn ghost" data-act="close">Cancel</button><button class="btn pri" data-act="submit-form">Upload</button>',
  });
  m.onSubmit = async () => {
    const err = (t) => { $('#ferr', m.el).textContent = t; };
    const f = $('#upf').files[0];
    if (!f) return err('Choose a file first.');
    let blob = f, name = f.name, type = f.type;
    if (/^image\//.test(f.type) && f.type !== 'image/svg+xml' && f.size > max * 0.5) {
      const s = await shrinkImage(f, Math.floor(max * 0.7));
      if (s) { blob = s; name = name.replace(/\.[^.]+$/, '') + '.jpg'; type = 'image/jpeg'; }
    }
    if (blob.size > max) return err('That file is too big. The limit is ' + OPTIONS.maxFileKB + ' KB.');
    const enc = await encBytes(ctx.key, await blob.arrayBuffer());
    await putFile({ appId: ui.appId, name, type, size: blob.size, notes: $('#upn').value.trim() }, enc);
    closeModal();
    toast('Uploaded');
  };
});
A.dlFile = withKey(async (el) => {
  const meta = find('files', el.dataset.id);
  const d = await getFileData(meta.id);
  logEvent('download file', lab(meta));
  downloadBlob(meta.name, new Blob([await decBytes(ctx.key, d.iv, d.data)], { type: meta.type || 'application/octet-stream' }));
});
A.delFile = (el) => ask('Delete this file?', async () => { await delFile(el.dataset.id); toast('Deleted'); });

/* ---------- renewals ---------- */
function renewFields(needApp) {
  const f = [];
  if (needApp) f.push({ k: 'appId', label: 'App', type: 'select', opts: [['', '— None —']].concat(DB.apps.map((a) => [a.id, a.name])) });
  f.push(
    { k: 'kind', label: 'Type', type: 'select', opts: RENEW_KINDS, half: true },
    { k: 'name', label: 'Name', req: true, half: true, ph: 'example.com' },
    { k: 'provider', label: 'Provider or registrar', half: true, ph: 'Namecheap, Vercel, Let\'s Encrypt' },
    { k: 'expiresAt', label: 'Expires on', type: 'date', req: true, half: true },
    { k: 'autoRenew', label: 'Auto-renew', type: 'select', opts: [['no', 'Off'], ['yes', 'On']], half: true },
    { k: 'notes', label: 'Notes', type: 'textarea', rows: 2 },
  );
  return f;
}
A.addRenew = () => { const need = !(ui.view === 'apps' && ui.appId); openForm({ title: 'Add renewal', fields: renewFields(need), values: { appId: need ? '' : ui.appId, kind: 'Domain', autoRenew: 'no', expiresAt: addDays(365) }, onSave: async (v) => { await add('renewals', Object.assign({}, v, need ? {} : { appId: ui.appId })); toast('Saved'); } }); };
A.editRenew = (el) => { const r = find('renewals', el.dataset.id); openForm({ title: 'Edit renewal', fields: renewFields(true), values: r, onSave: async (v) => { await upd('renewals', r.id, v); toast('Saved'); } }); };
A.delRenew = (el) => ask('Delete this renewal?', async () => { await del('renewals', el.dataset.id); toast('Deleted'); });
A.renewed = (el) => {
  const r = find('renewals', el.dataset.id);
  const base = r.expiresAt && r.expiresAt > todayISO() ? r.expiresAt : todayISO();
  openForm({ title: 'Mark renewed', submit: 'Save', fields: [{ k: 'expiresAt', label: 'New expiry date', type: 'date', req: true }], values: { expiresAt: addMonthsISO(base, 12) }, onSave: async (v) => { await upd('renewals', r.id, { expiresAt: v.expiresAt }); toast('Renewed until ' + fmtD(v.expiresAt)); } });
};

/* ---------- changelog ---------- */
function logFields(needApp) {
  const f = [];
  if (needApp) f.push({ k: 'appId', label: 'App', type: 'select', opts: DB.apps.map((a) => [a.id, a.name]), req: true });
  f.push(
    { k: 'title', label: 'What changed?', req: true, ph: 'e.g. Added SMS reminders' },
    { k: 'type', label: 'Type', type: 'select', opts: LOG_TYPES, half: true },
    { k: 'version', label: 'Version', ph: 'v1.3.0', half: true },
    { k: 'date', label: 'Date', type: 'date', req: true },
    { k: 'details', label: 'Details', type: 'textarea', rows: 3 },
  );
  return f;
}
A.addLog = () => { if (!DB.apps.length) return toast('Add an app first.'); const need = !(ui.view === 'apps' && ui.appId); openForm({ title: 'Log an update', fields: logFields(need), values: { appId: ui.appId || (DB.apps[0] && DB.apps[0].id), type: 'Feature', date: todayISO() }, onSave: async (v) => { await add('changelog', Object.assign({}, v, need ? {} : { appId: ui.appId })); toast('Update logged'); } }); };
A.editLog = (el) => { const l = find('changelog', el.dataset.id); openForm({ title: 'Edit update', fields: logFields(false), values: l, onSave: async (v) => { await upd('changelog', l.id, v); toast('Saved'); } }); };
A.delLog = (el) => ask('Delete this update entry?', async () => { await del('changelog', el.dataset.id); toast('Deleted'); });

/* ---------- clients (admin) ---------- */
const clientFields = () => [
  { k: 'name', label: 'Name', req: true, half: true },
  { k: 'company', label: 'Company or business', half: true },
  { k: 'phone', label: 'Phone', half: true, ph: '09xx xxx xxxx' },
  { k: 'email', label: 'Email', type: 'email', half: true },
  { k: 'notes', label: 'Notes', type: 'textarea', rows: 3 },
];
A.addClient = () => openForm({ title: 'Add client', fields: clientFields(), onSave: async (v) => { await add('clients', v); toast('Client saved'); } });
A.editClient = (el) => { const c = find('clients', el.dataset.id); openForm({ title: 'Edit client', fields: clientFields(), values: c, onSave: async (v) => { await upd('clients', c.id, v); toast('Saved'); } }); };
A.delClient = (el) => { const c = find('clients', el.dataset.id); ask('Delete "' + c.name + '"? Their apps and payment plans stay, but become unlinked.', async () => { await unlinkClient(c.id); ui.clientId = null; R(); toast('Client deleted'); }); };

/* ---------- billing (admin) ---------- */
function billFields(needApp) {
  const f = [];
  if (needApp) f.push({ k: 'appId', label: 'App', type: 'select', opts: DB.apps.map((a) => [a.id, a.name]), req: true });
  f.push(
    { k: 'title', label: 'What is this payment for?', req: true, ph: 'e.g. Monthly maintenance and hosting' },
    { k: 'dir', label: 'Direction', type: 'select', opts: [['in', 'Client pays me (income)'], ['out', 'I pay (expense)']], half: true },
    { k: 'kind', label: 'Type', type: 'select', opts: KINDS, half: true },
    { k: 'clientId', label: 'Client', type: 'select', opts: [['', '— None —']].concat(DB.clients.map((c) => [c.id, c.name])), half: true, hint: 'For "Client pays me"' },
    { k: 'party', label: 'Paid to', half: true, ph: 'For "I pay", e.g. Namecheap' },
    { k: 'plan', label: 'Plan or package name', half: true, ph: 'e.g. Standard Care Plan' },
    { k: 'method', label: 'Payment method', half: true, ph: 'GCash, bank transfer, card' },
    { k: 'amount', label: 'Amount per period', type: 'number', req: true, half: true },
    { k: 'discount', label: 'Discount per period', type: 'number', half: true },
    { k: 'cycle', label: 'How often', type: 'select', opts: CYCLES, half: true },
    { k: 'nextDue', label: 'Next due date', type: 'date', req: true, half: true },
    { k: 'lateType', label: 'Late fee', type: 'select', opts: [['none', 'No late fee'], ['flat', 'Flat amount'], ['percent', 'Percent of amount']], half: true },
    { k: 'lateValue', label: 'Late fee value', type: 'number', half: true, hint: 'Amount, or percent' },
    { k: 'graceDays', label: 'Grace days before late fee', type: 'number', half: true },
    { k: 'state', label: 'Plan status', type: 'select', opts: [['active', 'Active'], ['paused', 'Paused'], ['completed', 'Completed']], half: true },
    { k: 'inclusions', label: 'Package inclusions', type: 'lines', rows: 3, hint: 'One item per line' },
    { k: 'notes', label: 'Notes', type: 'textarea', rows: 2 },
  );
  return f;
}
A.addBill = () => {
  if (!DB.apps.length) return toast('Add an app first.');
  const need = !(ui.view === 'apps' && ui.appId);
  openForm({ title: 'Add payment plan', wide: true, fields: billFields(need), values: { appId: ui.appId || DB.apps[0].id, dir: 'in', kind: 'Subscription', cycle: 'monthly', nextDue: addDays(30), state: 'active', lateType: 'none' }, onSave: async (v) => { await add('billing', Object.assign({}, v, need ? {} : { appId: ui.appId }, { history: [], paidThisPeriod: 0 })); toast('Payment plan added'); } });
};
A.editBill = (el) => { const b = find('billing', el.dataset.id); openForm({ title: 'Edit payment plan', wide: true, fields: billFields(false), values: b, onSave: async (v) => { await upd('billing', b.id, v); toast('Saved'); } }); };
A.delBill = (el) => ask('Delete this payment plan and its history?', async () => { await del('billing', el.dataset.id); toast('Deleted'); });
A.delPay = (el) => { const b = find('billing', el.dataset.id); ask('Remove this payment entry? The due date will not change.', async () => { await upd('billing', b.id, { history: b.history.filter((h) => h.id !== el.dataset.h) }); toast('Removed'); }, 'Remove'); };

function msgFor(b, kind, entry) {
  const s = cfg(), c = find('clients', b.clientId), info = periodInfo(b);
  const map = { client: c ? c.name : 'sir/ma\'am', title: b.title, app: appName(b.appId), balance: money(info.balance), due_date: fmtD(b.nextDue), pay_info: s.payInfo || '', business: s.businessName || '', paid: entry ? money(entry.amount) : '', receipt_no: entry ? entry.receiptNo : '' };
  const t = kind === 'receipt' ? s.msgReceipt : kind === 'overdue' ? s.msgOverdue : s.msgDue;
  return fillTemplate(t, map).replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}
A.pay = (el) => {
  const b = find('billing', el.dataset.id), info = periodInfo(b, todayISO());
  openForm({
    title: 'Mark as paid', submit: 'Save payment',
    intro: '<p class="muted small" style="margin-bottom:10px">Base ' + esc(money(info.base)) + (info.disc ? ' − discount ' + esc(money(info.disc)) : '') + (info.late ? ' + late fee ' + esc(money(info.late)) : '') + (info.paid ? ' − paid so far ' + esc(money(info.paid)) : '') + ' = <b>' + esc(money(info.balance)) + '</b> balance. Pay less to log a partial payment.</p>',
    fields: [
      { k: 'date', label: 'Date paid', type: 'date', req: true, half: true },
      { k: 'amount', label: 'Amount paid', type: 'number', req: true, half: true },
      { k: 'ref', label: 'Reference number', ph: 'Receipt or transaction no.' },
      { k: 'note', label: 'Note', type: 'textarea', rows: 2 },
    ],
    values: { date: todayISO(), amount: info.balance },
    onSave: async (v) => {
      if (!(v.amount > 0)) return 'Enter an amount above zero.';
      const r = applyPayment(b, v);
      await upd('billing', b.id, r.patch);
      toast(r.settled ? 'Paid. ' + (b.cycle === 'onetime' ? 'Plan completed.' : 'Next due ' + fmtD(r.patch.nextDue)) : 'Partial payment saved. Balance ' + money(r.balance));
      showReceipt(Object.assign({}, b, r.patch), r.entry);
    },
  });
};
function showReceipt(b, entry) {
  const html = receiptHTML({ b, entry, client: find('clients', b.clientId), app: find('apps', b.appId), biz: cfg() });
  lastDoc = { html, b, entry };
  modal({
    title: 'Receipt ' + entry.receiptNo, wide: true,
    body: '<iframe class="docframe" sandbox srcdoc="' + esc(html) + '" title="Receipt preview"></iframe>',
    foot: '<button class="btn" data-act="msgReceipt">' + ic('msg', 14) + ' Thank-you message</button><button class="btn pri" data-act="printDoc">' + ic('print', 14) + ' Print / Save as PDF</button><button class="btn ghost" data-act="close">Close</button>',
  });
}
A.receipt = (el) => { const b = find('billing', el.dataset.id), e = (b.history || []).find((h) => h.id === el.dataset.h); if (e) showReceipt(b, e); };
A.invoice = (el) => {
  const b = find('billing', el.dataset.id);
  const html = invoiceHTML({ b, client: find('clients', b.clientId), app: find('apps', b.appId), biz: cfg() });
  lastDoc = { html, b, entry: null };
  modal({
    title: 'Invoice', wide: true,
    body: '<iframe class="docframe" sandbox srcdoc="' + esc(html) + '" title="Invoice preview"></iframe>',
    foot: '<button class="btn" data-act="msgInvoice">' + ic('msg', 14) + ' Reminder message</button><button class="btn pri" data-act="printDoc">' + ic('print', 14) + ' Print / Save as PDF</button><button class="btn ghost" data-act="close">Close</button>',
  });
};
A.printDoc = () => { if (lastDoc) printHTML(lastDoc.html); };
A.msgReceipt = () => { if (lastDoc && lastDoc.entry) openMsg(lastDoc.b, 'receipt', lastDoc.entry); };
A.msgInvoice = () => { if (lastDoc) openMsg(lastDoc.b, billStatus(lastDoc.b, cfg().warnDays).k === 'over' ? 'overdue' : 'due', null); };
A.msg = (el) => { const b = find('billing', el.dataset.id); openMsg(b, billStatus(b, cfg().warnDays).k === 'over' ? 'overdue' : 'due', null); };
function openMsg(b, kind, entry) {
  msgCtx = { b, entry };
  modal({
    title: 'Message to client', wide: true,
    body: '<div class="fld"><label for="mt-kind">Template</label><select id="mt-kind" data-tplsel>' + [['due', 'Payment reminder'], ['overdue', 'Overdue notice']].concat(entry ? [['receipt', 'Thank-you after payment']] : []).map((o) => '<option value="' + o[0] + '"' + (o[0] === kind ? ' selected' : '') + '>' + o[1] + '</option>').join('') + '</select></div><div class="fld"><label for="mt-text">Message</label><textarea id="mt-text" rows="9">' + esc(msgFor(b, kind, entry)) + '</textarea><small class="hint">Edit it if you like, then copy and paste into Messenger, Viber or SMS. Change the wording of the templates in Settings.</small></div>',
    foot: '<button class="btn ghost" data-act="close">Close</button><button class="btn pri" data-act="cfrom" data-t="mt-text">' + ic('copy', 14) + ' Copy message</button>',
  });
}
export function tplChange(sel) { if (msgCtx) { const t = document.getElementById('mt-text'); if (t) t.value = msgFor(msgCtx.b, sel.value, msgCtx.entry); } }

/* ---------- team (admin) ---------- */
A.invite = async () => {
  const i = document.getElementById('inv-email');
  const email = (i.value || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return toast('Type a valid email.');
  await inviteEmail(email);
  logEvent('invite', email);
  i.value = '';
  toast('Invited. Ask them to Join with ' + email);
};
A.rmInvite = (el) => ask('Remove this invite?', async () => { await del('invites', el.dataset.id); toast('Removed'); }, 'Remove');
A.setRole = (el) => { const u = find('users', el.dataset.id); const to = u.role === 'admin' ? 'developer' : 'admin'; ask('Make ' + (u.name || u.email) + ' a' + (to === 'admin' ? 'n admin? Admins can see payments, clients and team settings.' : ' developer? They will lose access to payments, clients and team settings.'), async () => { await setUserRole(u.id, to); logEvent('change role', u.email + ' → ' + to); toast('Role updated'); }, 'Yes, change'); };
A.rmUser = (el) => { const u = find('users', el.dataset.id); ask('Remove access for ' + (u.name || u.email) + '? They cannot get back in unless you invite them again. They may still know the team passphrase, so change it afterwards in Settings → Secrets vault.', async () => { await removeUserAccess(u.id, u.email); logEvent('remove access', u.email); toast('Access removed'); }, 'Remove access'); };

/* ---------- export ---------- */
A.restore = () => {
  if (!isAdmin()) return;
  const m = modal({
    title: 'Restore from backup',
    body: form('<p class="muted">Choose a backup file made by App Vault. Only items that are <b>missing</b> are added back. Nothing that is already here is changed or deleted. Restored items are marked as created by you, and the original author is kept in the item.</p><div class="fld"><label for="rf">Backup file (.json)</label><input id="rf" type="file" accept=".json,application/json"></div><div id="rsum" class="muted small"></div><div class="form-err" id="ferr" role="alert"></div>'),
    foot: '<button class="btn ghost" data-act="close">Cancel</button><button class="btn pri" data-act="submit-form">Check file</button>',
  });
  let plan = null, busy = false;
  const btn = () => m.el.querySelector('[data-act="submit-form"]');
  $('#rf', m.el).onchange = () => { plan = null; btn().textContent = 'Check file'; $('#rsum', m.el).textContent = ''; $('#ferr', m.el).textContent = ''; };
  m.onSubmit = async () => {
    if (busy) return;
    const err = (t) => { $('#ferr', m.el).textContent = t; };
    err('');
    busy = true;
    try {
      if (!plan) {
        const f = $('#rf', m.el).files[0];
        if (!f) return err('Choose a backup file first.');
        if (f.size > 40 * 1024 * 1024) return err('That file is too big (over 40 MB).');
        let b;
        try { b = JSON.parse(await f.text()); } catch (e) { return err('That file could not be read as a backup.'); }
        const ids = {};
        ['apps', 'logins', 'services', 'envs', 'files', 'changelog', 'renewals', 'clients', 'billing'].forEach((c) => { ids[c] = new Set(DB[c].map((x) => x.id)); });
        const p = planRestore(b, { vault: DB.vault, settings: DB.settings, ids }, ctx.user.uid);
        if (p.error) return err(p.error);
        const parts = Object.keys(p.counts).map((c) => p.counts[c] + ' ' + c);
        $('#rsum', m.el).textContent = (parts.length || p.vaultAction ? 'Will add: ' + (parts.join(', ') || 'nothing') + (p.vaultAction ? ' + the team passphrase record' : '') + '. ' : 'Nothing to add. ') + 'Already here and skipped: ' + p.skippedTotal + '.' + (p.filesNoData ? ' Skipped ' + p.filesNoData + ' file(s) with no file data in the backup.' : '');
        if (!p.ops.length && !p.vaultAction) return;
        plan = p; btn().textContent = 'Restore now';
        return;
      }
      err('Working… do not close this window.');
      await commitRestore(plan);
      logEvent('restore backup', plan.ops.length + ' docs');
      closeModal();
      toast('Restored ' + plan.ops.length + ' documents.');
    } catch (e) {
      console.error(e); err('Could not finish. ' + (e && e.message ? e.message : e) + ' You can run Restore again to add what is still missing.');
    } finally { busy = false; }
  };
};
A.backup = async () => {
  if (!isAdmin()) return;
  toast('Preparing backup…');
  const fd = {};
  for (const f of DB.files) { const d = await getFileData(f.id); fd[f.id] = { iv: d.iv, data: d.data }; }
  const json = JSON.stringify(buildBackup(DB, fd, VERSION), null, 1);
  downloadBlob('app-vault-backup-' + todayISO() + '.json', new Blob([json], { type: 'application/json' }));
  toast('Backup downloaded (' + Math.round(json.length / 1024) + ' KB)');
  logEvent('full backup', Math.round(json.length / 1024) + ' KB');
};
A.expApps = () => {
  const rows = [['Name', 'Status', 'URL', 'Tags', 'Client', 'GitHub account', 'Repository', 'Deployments', 'Logins', 'Accounts and keys', 'Archived']];
  DB.apps.forEach((a) => { const c = find('clients', a.clientId); rows.push([a.name, a.status, a.url, (a.tags || []).join('; '), c ? c.name : '', a.repo && a.repo.account, a.repo && a.repo.name, (a.deploys || []).map((d) => d.provider + (d.account ? ' (' + d.account + ')' : '')).join('; '), DB.logins.filter((x) => x.appId === a.id).length, DB.services.filter((x) => x.appId === a.id).length, a.archived ? 'yes' : '']); });
  downloadText('apps-' + todayISO() + '.csv', toCSV(rows));
};
A.expPay = () => {
  const rows = [['App', 'Plan', 'Direction', 'Type', 'Client or payee', 'Amount per period', 'Discount', 'Cycle', 'Next due', 'Status', 'Date paid', 'Amount paid', 'Reference', 'Receipt no']];
  DB.billing.forEach((b) => {
    const c = find('clients', b.clientId);
    const base = [appName(b.appId), b.title, b.dir === 'in' ? 'Income' : 'Expense', b.kind, c ? c.name : b.party || '', b.amount, b.discount || '', b.cycle, b.nextDue, b.state];
    if ((b.history || []).length) b.history.forEach((h) => rows.push(base.concat([h.date, h.amount, h.ref, h.receiptNo]))); else rows.push(base.concat(['', '', '', '']));
  });
  downloadText('payments-' + todayISO() + '.csv', toCSV(rows));
};

/* ---------- settings ---------- */
export async function saveSetting(k, v) { await setSetting({ [k]: v }); }
