// Mga bagay na kailangan ng DOM: modal, toast, form builder, copy, print, download.
import { ic } from './icons.js';
import { esc } from './util.js';
import { OPTIONS } from './config.js';

export const $ = (s, r) => (r || document).querySelector(s);

/* ---------- modal ---------- */
let cur = null;
export const curModal = () => cur;
export function modal(o) {
  closeModal();
  const el = document.createElement('div');
  el.className = 'ov';
  el.innerHTML = '<div class="modal ' + (o.wide ? 'wide' : '') + '" role="dialog" aria-modal="true" aria-label="' + esc(o.title) + '"><div class="mh"><h2>' + esc(o.title) + '</h2><button class="icon-btn" data-act="close" title="Close">' + ic('x') + '</button></div><div class="mb">' + o.body + '</div>' + (o.foot ? '<div class="mf">' + o.foot + '</div>' : '') + '</div>';
  document.body.appendChild(el);
  cur = { el, onYes: o.onYes, onSubmit: o.onSubmit };
  const f = el.querySelector('input:not([type=hidden]):not([type=checkbox]):not([type=file]),select,textarea');
  if (f) setTimeout(() => f.focus(), 30);
  return cur;
}
export function closeModal() { if (cur) { cur.el.remove(); cur = null; } }

export function confirmBox(msg, yes, label) {
  modal({ title: 'Are you sure?', body: '<p>' + esc(msg) + '</p>', foot: '<button class="btn ghost" data-act="close">Cancel</button><button class="btn danger" data-act="yes">' + esc(label || 'Delete') + '</button>', onYes: yes });
}

/* ---------- toast ---------- */
let toastT = null;
export function toast(msg) {
  let t = $('#toast');
  if (!t) { t = document.createElement('div'); t.id = 'toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastT);
  toastT = setTimeout(() => t.classList.remove('show'), 2600);
}

/* ---------- clipboard ---------- */
let clipT = null;
export function copyText(text, sensitive) {
  const secs = OPTIONS.clipboardClearSeconds || 30;
  const ok = () => {
    toast(sensitive ? 'Copied. It clears from the clipboard in ' + secs + 's.' : 'Copied');
    if (sensitive) {
      clearTimeout(clipT);
      clipT = setTimeout(() => { try { navigator.clipboard.writeText(' '); } catch (e) { /* ignore */ } }, secs * 1000);
    }
  };
  const bad = () => toast('Copy is blocked here. Select the text and copy it manually.');
  try { navigator.clipboard.writeText(text).then(ok, bad); } catch (e) { bad(); }
}

/* ---------- files out ---------- */
export function downloadBlob(name, blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
export const downloadText = (name, text, mime) => downloadBlob(name, new Blob(['﻿' + text], { type: (mime || 'text/csv') + ';charset=utf-8' }));
export function printHTML(html) {
  const f = document.createElement('iframe');
  f.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
  document.body.appendChild(f);
  const d = f.contentWindow.document;
  d.open(); d.write(html); d.close();
  const clean = () => f.remove();
  setTimeout(() => {
    try { f.contentWindow.addEventListener('afterprint', clean); f.contentWindow.focus(); f.contentWindow.print(); } catch (e) { toast('Printing is blocked here.'); clean(); }
    setTimeout(clean, 120000);
  }, 250);
}

/* ---------- generic form ---------- */
export function fieldHTML(f, v) {
  const id = 'f_' + f.k;
  let val = v[f.k];
  if (val === undefined) val = f.def !== undefined ? f.def : '';
  if (Array.isArray(val)) val = val.join(f.type === 'csv' ? ', ' : '\n');
  const lab = '<label for="' + id + '">' + esc(f.label) + (f.req ? '<i>*</i>' : '') + '</label>';
  let inp;
  if (f.type === 'select') {
    inp = '<select id="' + id + '">' + f.opts.map((o) => { const a = Array.isArray(o) ? o : [o, o]; return '<option value="' + esc(a[0]) + '"' + (String(a[0]) === String(val) ? ' selected' : '') + '>' + esc(a[1]) + '</option>'; }).join('') + '</select>';
  } else if (f.type === 'textarea' || f.type === 'lines') {
    inp = '<textarea id="' + id + '" rows="' + (f.rows || 3) + '"' + (f.mono ? ' class="monoarea"' : '') + ' placeholder="' + esc(f.ph || '') + '" spellcheck="false">' + esc(val) + '</textarea>';
  } else if (f.type === 'password') {
    inp = '<div class="pw"><input id="' + id + '" type="password" autocomplete="off" spellcheck="false" value="' + esc(val) + '" placeholder="' + esc(f.ph || '') + '"><button type="button" class="icon-btn" data-act="tpw" data-t="' + id + '" title="Show or hide">' + ic('eye') + '</button>' + (f.gen ? '<button type="button" class="icon-btn" data-act="genpw" data-t="' + id + '" title="Generate a strong password">' + ic('bolt') + '</button>' : '') + '</div>';
  } else {
    const t = f.type === 'csv' ? 'text' : (f.type || 'text');
    inp = '<input id="' + id + '" type="' + t + '" ' + (f.list ? 'list="dl_' + id + '" ' : '') + 'value="' + esc(val) + '" placeholder="' + esc(f.ph || '') + '" ' + (t === 'number' ? 'step="any" min="0" inputmode="decimal" ' : '') + 'autocomplete="off">' + (f.list ? '<datalist id="dl_' + id + '">' + f.list.map((x) => '<option value="' + esc(x) + '">').join('') + '</datalist>' : '');
  }
  return '<div class="fld' + (f.half ? ' half' : '') + '">' + lab + inp + (f.hint ? '<small class="hint">' + esc(f.hint) + '</small>' : '') + '<small class="err" id="e_' + id + '"></small></div>';
}

export function openForm(o) {
  const vals = o.values || {};
  const body = (o.intro || '') + '<form id="mform" novalidate><div class="fgrid">' + o.fields.map((f) => fieldHTML(f, vals)).join('') + '</div><div class="form-err" id="ferr" role="alert"></div></form>';
  const m = modal({ title: o.title, wide: o.wide, body, foot: '<button class="btn ghost" data-act="close">Cancel</button><button class="btn pri" data-act="submit-form">' + esc(o.submit || 'Save') + '</button>' });
  m.onSubmit = async function () {
    const out = {};
    let bad = false;
    o.fields.forEach((f) => {
      const el = m.el.querySelector('#f_' + f.k);
      let v = el.value;
      const er = m.el.querySelector('#e_f_' + f.k);
      er.textContent = '';
      if (f.type === 'lines') v = v.split('\n').map((s) => s.trim()).filter(Boolean);
      else if (f.type === 'csv') v = v.split(',').map((s) => s.trim()).filter(Boolean);
      else if (f.type === 'number') v = v === '' ? '' : Number(v);
      else if (f.type !== 'password' && !f.raw) v = v.trim();
      if (f.req && (v === '' || (Array.isArray(v) && !v.length))) { er.textContent = 'Required'; bad = true; }
      out[f.k] = v;
    });
    if (bad) return;
    const btn = m.el.querySelector('[data-act="submit-form"]');
    if (btn) btn.disabled = true;
    try {
      const r = await o.onSave(out);
      if (typeof r === 'string') { $('#ferr', m.el).textContent = r; if (btn) btn.disabled = false; return; }
      if (cur === m) closeModal();
    } catch (e) {
      console.error(e);
      $('#ferr', m.el).textContent = (e && e.code === 'permission-denied') ? 'Not allowed. Your role or sign-in may not cover this.' : 'Could not save: ' + (e && e.message ? e.message : e);
      if (btn) btn.disabled = false;
    }
  };
  return m;
}

/* ---------- theme ---------- */
export const getTheme = () => { try { return localStorage.getItem('av.theme') || 'system'; } catch (e) { return 'system'; } };
export function setTheme(t) {
  try { localStorage.setItem('av.theme', t); } catch (e) { /* ignore */ }
  const r = document.documentElement;
  if (t === 'light' || t === 'dark') r.setAttribute('data-theme', t); else r.removeAttribute('data-theme');
}
