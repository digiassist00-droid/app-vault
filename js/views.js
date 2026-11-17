// Lahat ng screen. Pure na HTML string ang ibinabalik, walang DOM at walang Firebase.
import { DB, ctx, ui, isAdmin, cfg, STATUSES, LOG_TYPES, RENEW_KINDS } from './state.js';
import { esc, money, short, fmtD, initials, safeUrl, todayISO, daysBetween } from './util.js';
import { ic, logo } from './icons.js';
import { VERSION } from './config.js';
import { billStatus, periodInfo, renewStatus, monthlyAmt, forecast, ORD, CYC_SUF } from './billing.js';

/* ---------- lookups ---------- */
const appById = (id) => DB.apps.find((a) => a.id === id);
const clientById = (id) => DB.clients.find((c) => c.id === id);
export const appName = (id) => { const a = appById(id); return a ? a.name : '—'; };
const clientName = (id) => { const c = clientById(id); return c ? c.name : ''; };
const warnD = () => Number(cfg().warnDays) || 7;
const renewD = () => Number(cfg().renewWarnDays) || 30;
const activeBills = () => DB.billing.filter((b) => b.state === 'active');
const billSort = (a, b) => (ORD[billStatus(a, warnD()).k] - ORD[billStatus(b, warnD()).k]) || String(a.nextDue).localeCompare(String(b.nextDue));
const renewSort = (a, b) => String(a.expiresAt).localeCompare(String(b.expiresAt));
const sum = (a, f) => a.reduce((s, x) => s + f(x), 0);
const byDateDesc = (a, b) => String(b.date).localeCompare(String(a.date));

export function attention() {
  let over = 0, soon = 0, toCollect = 0, toPay = 0, rOver = 0, rSoon = 0;
  if (isAdmin()) {
    activeBills().forEach((b) => {
      const s = billStatus(b, warnD());
      if (s.k === 'over') { over++; if (b.dir === 'in') toCollect++; else toPay++; } else if (s.k === 'soon') soon++;
    });
  }
  DB.renewals.forEach((r) => {
    const s = renewStatus(r, renewD());
    if (s.k === 'over') rOver++; else if (s.k === 'soon') rSoon++;
  });
  return { over, soon, toCollect, toPay, rOver, rSoon };
}
const plural = (n, w) => n + ' ' + w + (n === 1 ? '' : 's');

/* ---------- small pieces ---------- */
const statusPill = (k) => {
  const m = { live: ['good', 'Live'], dev: ['info', 'In development'], maint: ['warn', 'Maintenance'], paused: ['', 'Paused'], archived: ['', 'Archived'] }[k] || ['', k];
  return '<span class="pill ' + m[0] + '">' + m[1] + '</span>';
};
const typePill = (t) => (t === 'Feature' ? '<span class="pill info">Feature</span>' : t === 'Improvement' ? '<span class="pill good">Improvement</span>' : '<span class="tag plain">' + esc(t) + '</span>');
const pageHead = (t, sub, act) => '<div class="phead"><div><h1>' + t + '</h1>' + (sub ? '<p>' + sub + '</p>' : '') + '</div><div class="pact">' + (act || '') + '</div></div>';
const kv = (l, v) => (v ? '<div class="kv"><span>' + l + '</span><div>' + v + '</div></div>' : '');
const copyv = (v, sens) => (v ? '<span class="cv"><span class="mono">' + esc(v) + '</span><button class="icon-btn" data-act="copyv" ' + (sens ? 'data-sens="1" ' : '') + 'data-val="' + esc(v) + '" title="Copy">' + ic('copy', 15) + '</button></span>' : '');
const link = (u) => { const s = safeUrl(u); return s ? '<a href="' + esc(s) + '" target="_blank" rel="noopener noreferrer">' + esc(String(u).replace(/^https?:\/\//, '')) + ' ' + ic('ext', 13) + '</a>' : ''; };
const empty = (t, s, btn) => '<div class="empty"><b>' + t + '</b><span>' + s + '</span>' + (btn || '') + '</div>';
const tagChips = (a) => ((a.tags || []).length ? '<div class="chips">' + a.tags.map((t) => '<span class="chip tagc">' + ic('tag', 11) + esc(t) + '</span>').join('') + '</div>' : '');
const secretCell = (coll, id, f, val, env) => (val
  ? '<span class="sec' + (env ? ' env' : '') + '"><code data-sec>••••••••••</code><button class="icon-btn" data-act="reveal" data-coll="' + coll + '" data-id="' + id + '" data-f="' + f + '" title="Show or hide">' + ic('eye', 15) + '</button><button class="icon-btn" data-act="copy" data-coll="' + coll + '" data-id="' + id + '" data-f="' + f + '" title="Copy">' + ic('copy', 15) + '</button></span>'
  : '');
const iconBtns = (editAct, delAct, id, extra) => '<button class="icon-btn" data-act="' + editAct + '" data-id="' + id + '" title="Edit">' + ic('edit', 15) + '</button><button class="icon-btn" data-act="' + delAct + '" data-id="' + id + '" title="Delete">' + ic('trash', 15) + '</button>' + (extra || '');
const list = (items, icn) => (items && items.length ? '<ul class="feat">' + items.map((i) => '<li>' + ic(icn || 'check', 15) + '<span>' + esc(i) + '</span></li>').join('') + '</ul>' : '<p class="muted">Nothing added yet.</p>');
const greet = () => { const h = new Date().getHours(); return h < 12 ? 'Magandang umaga' : h < 18 ? 'Magandang hapon' : 'Magandang gabi'; };

function banner(A) {
  const out = [];
  if (A.over) out.push(['bad', '<b>' + plural(A.over, 'payment') + ' overdue.</b> ' + A.toCollect + ' to collect, ' + A.toPay + ' to pay.', 'goPay']);
  if (A.rOver) out.push(['bad', '<b>' + plural(A.rOver, 'renewal') + ' expired.</b> Renew before the site goes down.', 'goRenew']);
  if (A.soon) out.push(['warn', '<b>' + plural(A.soon, 'payment') + ' due soon.</b> Check before they turn overdue.', 'goPay']);
  if (A.rSoon) out.push(['warn', '<b>' + plural(A.rSoon, 'renewal') + ' coming up.</b> Domains, SSL or hosting expire soon.', 'goRenew']);
  return out.map((o) => '<div class="alert ' + o[0] + '">' + ic('bell') + '<span class="grow">' + o[1] + '</span><button class="btn sm" data-act="' + o[2] + '">Review</button></div>').join('');
}

function appBillPill(aid) {
  if (!isAdmin()) return '';
  const bs = DB.billing.filter((b) => b.appId === aid && b.state === 'active');
  if (!bs.length) return '<span class="muted">No billing</span>';
  const w = bs.map((b) => billStatus(b, warnD())).sort((a, b) => ORD[a.k] - ORD[b.k])[0];
  return '<span class="pill ' + w.cls + '">' + w.label + '</span>';
}
function appCard(a) {
  return '<div class="acard' + (a.archived ? ' dim' : '') + '" role="button" tabindex="0" data-act="openApp" data-id="' + a.id + '"><div class="ahead"><span class="avatar">' + esc(initials(a.name)) + '</span><div class="grow"><h3>' + esc(a.name) + '</h3><p>' + esc(a.tagline || '') + '</p></div>' + (a.archived ? '<span class="tag plain">Archived</span>' : '') + '</div>' +
    '<div class="chips">' + statusPill(a.status) + (a.deploys || []).slice(0, 3).map((d) => '<span class="chip">' + esc(d.provider) + '</span>').join('') + '</div>' + tagChips(a) +
    '<div class="afoot"><span>' + ic('git', 14) + esc((a.repo && a.repo.account) || 'No repo yet') + '</span>' + appBillPill(a.id) + '</div></div>';
}

/* ---------- billing cards (admin) ---------- */
function billCard(b, showApp) {
  const st = billStatus(b, warnD()), info = periodInfo(b), inc = b.dir === 'in';
  const cl = clientById(b.clientId);
  const hist = (b.history || []).slice().sort(byDateDesc);
  const tot = sum(hist, (h) => Number(h.amount) || 0);
  const who = inc ? (cl ? cl.name : '—') : (b.party || '—');
  const active = b.state === 'active';
  const extra = [];
  if (info.disc) extra.push('Discount −' + money(info.disc));
  if (info.late) extra.push('Late fee +' + money(info.late));
  if (info.paid && active) extra.push('Paid so far ' + money(info.paid));
  return '<article class="bill ' + st.cls + '"><div class="bill-h"><div class="grow"><span class="eyebrow">' + (inc ? 'Client pays me' : 'I pay') + ' · ' + esc(b.kind || 'Payment') + '</span><h3>' + esc(b.title) + '</h3><small class="muted">' + (showApp ? esc(appName(b.appId)) + (b.plan ? ' · ' : '') : '') + esc(b.plan || '') + '</small></div><span class="pill ' + st.cls + '">' + st.label + '</span></div>' +
    '<div class="bill-m"><div class="amt">' + esc(money(active ? info.balance || info.total : b.amount)) + '<small>' + (active && (info.paid || info.late || info.disc) ? 'balance' : (CYC_SUF[b.cycle] || '')) + '</small></div><div><span>Next due</span><b>' + (b.state === 'completed' ? '—' : fmtD(b.nextDue)) + '</b></div><div><span>' + (inc ? 'Client' : 'Paid to') + '</span><b>' + esc(who) + '</b></div><div><span>Method</span><b>' + esc(b.method || '—') + '</b></div></div>' +
    (extra.length ? '<p class="muted small">' + esc(extra.join(' · ')) + ' · Base ' + esc(money(info.base)) + (b.cycle !== 'onetime' ? esc(CYC_SUF[b.cycle] || '') : '') + '</p>' : '') +
    ((b.inclusions || []).length ? '<ul class="incl">' + b.inclusions.map((i) => '<li>' + ic('check', 14) + '<span>' + esc(i) + '</span></li>').join('') + '</ul>' : '') +
    (b.notes ? '<p class="muted small pre">' + esc(b.notes) + '</p>' : '') +
    '<div class="bill-a">' + (active ? '<button class="btn pri sm" data-act="pay" data-id="' + b.id + '">' + ic('check', 14) + ' Mark as paid</button>' : '') +
    (inc && active ? '<button class="btn sm" data-act="msg" data-id="' + b.id + '">' + ic('msg', 14) + ' Message</button><button class="btn sm" data-act="invoice" data-id="' + b.id + '">' + ic('receipt', 14) + ' Invoice</button>' : '') +
    '<button class="btn sm" data-act="editBill" data-id="' + b.id + '">' + ic('edit', 14) + ' Edit</button><button class="btn sm ghost" data-act="delBill" data-id="' + b.id + '">' + ic('trash', 14) + '</button></div>' +
    '<details class="hist"><summary>Payment history · ' + hist.length + (hist.length ? ' · ' + esc(money(tot)) + ' total' : '') + '</summary>' +
    (hist.length ? '<div class="scroll"><table class="tbl"><thead><tr><th>Date</th><th>Amount</th><th>Reference</th><th>Receipt</th><th></th></tr></thead><tbody>' + hist.map((h) => '<tr><td>' + fmtD(h.date) + '</td><td>' + esc(money(h.amount)) + (h.settled === false ? ' <span class="pill warn">Partial</span>' : '') + '</td><td class="mono">' + esc(h.ref || '—') + '</td><td><button class="btn sm" data-act="receipt" data-id="' + b.id + '" data-h="' + h.id + '">' + ic('receipt', 13) + ' ' + esc(h.receiptNo || 'View') + '</button></td><td><button class="icon-btn" data-act="delPay" data-id="' + b.id + '" data-h="' + h.id + '" title="Remove entry">' + ic('trash', 14) + '</button></td></tr>').join('') + '</tbody></table></div>' : '<p class="muted small">No payments logged yet.</p>') + '</details></article>';
}
function renewCard(r, showApp) {
  const st = renewStatus(r, renewD());
  return '<article class="bill ' + st.cls + '"><div class="bill-h"><div class="grow"><span class="eyebrow">' + esc(r.kind) + (r.autoRenew === 'yes' ? ' · auto-renew on' : '') + '</span><h3>' + esc(r.name) + '</h3><small class="muted">' + (showApp ? esc(appName(r.appId)) + (r.provider ? ' · ' : '') : '') + esc(r.provider || '') + '</small></div><span class="pill ' + st.cls + '">' + st.label + '</span></div>' +
    '<div class="bill-m"><div><span>Expires</span><b>' + fmtD(r.expiresAt) + '</b></div></div>' + (r.notes ? '<p class="muted small pre">' + esc(r.notes) + '</p>' : '') +
    '<div class="bill-a"><button class="btn pri sm" data-act="renewed" data-id="' + r.id + '">' + ic('check', 14) + ' Mark renewed</button><button class="btn sm" data-act="editRenew" data-id="' + r.id + '">' + ic('edit', 14) + ' Edit</button><button class="btn sm ghost" data-act="delRenew" data-id="' + r.id + '">' + ic('trash', 14) + '</button></div></article>';
}
function logItem(l, showApp) {
  return '<article class="tl-i"><div class="tl-d"><b>' + fmtD(l.date) + '</b>' + (l.version ? '<span class="mono muted">' + esc(l.version) + '</span>' : '') + '</div><div class="tl-c"><div class="tl-h">' + typePill(l.type) + (showApp ? '<span class="muted small">' + esc(appName(l.appId)) + '</span>' : '') + (l.createdByName ? '<span class="muted small">by ' + esc(l.createdByName) + '</span>' : '') + '<span class="grow"></span>' + iconBtns('editLog', 'delLog', l.id) + '</div><h3>' + esc(l.title) + '</h3>' + (l.details ? '<p>' + esc(l.details) + '</p>' : '') + '</div></article>';
}

/* ---------- dashboard ---------- */
function chart(fc) {
  const W = 440, H = 200, L = 40, R = 8, T = 14, B = 28, pw = W - L - R, ph = H - T - B;
  const max = Math.max.apply(null, fc.map((x) => Math.max(x.inn, x.out)));
  if (!max) return '<div class="chart-empty">Add a payment plan to see your next 6 months of income and costs here.</div>';
  const p = Math.pow(10, Math.floor(Math.log10(max))), f = max / p;
  const nm = (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * p, gw = pw / fc.length, bw = Math.min(18, gw / 2 - 4);
  let s = '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Income and costs for the next six months">';
  [0, 0.5, 1].forEach((t) => { const y = T + ph - ph * t; s += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + y + '" y2="' + y + '" style="stroke:var(--hero-line)" stroke-width="1"/><text x="' + (L - 6) + '" y="' + (y + 4) + '" text-anchor="end" font-size="10" style="fill:var(--hero-ink-2)">' + short(nm * t) + '</text>'; });
  fc.forEach((m, i) => {
    const cx = L + gw * i + gw / 2;
    [[m.inn, cx - bw - 1, 'var(--hero-in)'], [m.out, cx + 1, 'var(--hero-out)']].forEach((a) => {
      if (a[0] > 0) { const h = Math.max(2, ph * a[0] / nm); s += '<rect x="' + a[1] + '" y="' + (T + ph - h) + '" width="' + bw + '" height="' + h + '" rx="3" style="fill:' + a[2] + '"><title>' + m.label + ': ' + esc(money(a[0])) + '</title></rect>'; }
    });
    s += '<text x="' + cx + '" y="' + (H - 8) + '" text-anchor="middle" font-size="11" style="fill:var(--hero-ink-2)">' + m.label + '</text>';
  });
  return s + '</svg>';
}
function collectedMonth() {
  const m = todayISO().slice(0, 7);
  let t = 0;
  DB.billing.forEach((b) => { if (b.dir === 'in') (b.history || []).forEach((h) => { if (String(h.date).slice(0, 7) === m) t += Number(h.amount) || 0; }); });
  return t;
}
const allLogs = () => DB.changelog.slice().sort(byDateDesc);

export function vDash() {
  const admin = isAdmin(), A = attention();
  const live = DB.apps.filter((a) => a.status === 'live' && !a.archived).length;
  const logs = allLogs().slice(0, 6);
  const ren = DB.renewals.slice().sort(renewSort).slice(0, 5);
  const who = ctx.profile && ctx.profile.name ? ', ' + esc(ctx.profile.name.split(' ')[0]) : '';
  const date = new Intl.DateTimeFormat('en-PH', { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date());
  let h = pageHead('Overview', greet() + who + '. Ngayon ay ' + date + '.', '<button class="btn pri" data-act="addApp">' + ic('plus', 16) + ' Add app</button>') + banner(A);
  if (admin) {
    const act = activeBills();
    const mrr = sum(act.filter((b) => b.dir === 'in'), monthlyAmt), cost = sum(act.filter((b) => b.dir === 'out'), monthlyAmt);
    h += '<section class="hero"><div><span class="eyebrow">Monthly recurring revenue</span><div class="hero-num">' + esc(money(Math.round(mrr))) + '</div><div class="hero-sub">Costs ' + esc(money(Math.round(cost))) + '/mo · Net ' + esc(money(Math.round(mrr - cost))) + '/mo</div>' +
      '<div class="hero-stats"><div><b>' + DB.apps.length + '</b><span>Apps tracked</span></div><div><b>' + act.length + '</b><span>Active plans</span></div><div><b>' + esc(money(collectedMonth())) + '</b><span>Collected this month</span></div></div></div>' +
      '<div class="hero-r"><span class="eyebrow">Next 6 months · cash flow</span>' + chart(forecast(DB.billing, 6)) + '<div class="legend"><span><i style="background:var(--hero-in)"></i>Money in</span><span><i style="background:var(--hero-out)"></i>Money out</span></div></div></section>';
  }
  h += '<div class="g-kpi">' +
    '<div class="kpi"><span class="eyebrow">Apps</span><b>' + DB.apps.filter((a) => !a.archived).length + '</b><small>' + live + ' live</small></div>' +
    (admin ? '<div class="kpi ' + (A.over ? 'bad' : '') + '"><span class="eyebrow">Overdue</span><b>' + A.over + '</b><small>' + (A.over ? A.toCollect + ' to collect · ' + A.toPay + ' to pay' : 'Nothing overdue') + '</small></div>' +
      '<div class="kpi ' + (A.soon ? 'warn' : '') + '"><span class="eyebrow">Due soon</span><b>' + A.soon + '</b><small>Within ' + warnD() + ' days</small></div>'
      : '<div class="kpi"><span class="eyebrow">Updates logged</span><b>' + DB.changelog.length + '</b><small>All apps</small></div><div class="kpi"><span class="eyebrow">Logins saved</span><b>' + DB.logins.length + '</b><small>All apps</small></div>') +
    '<div class="kpi ' + (A.rOver ? 'bad' : A.rSoon ? 'warn' : '') + '"><span class="eyebrow">Renewals</span><b>' + (A.rOver + A.rSoon) + '</b><small>' + (A.rOver ? A.rOver + ' expired' : A.rSoon ? 'Within ' + renewD() + ' days' : 'All clear') + '</small></div></div>';
  let left;
  if (admin) {
    const urgent = activeBills().sort(billSort).slice(0, 6);
    left = '<section class="card"><h2><span class="grow">Payments needing attention</span><button class="btn sm" data-act="goPay">All payments</button></h2>' +
      (urgent.length ? '<div class="rows">' + urgent.map((b) => { const st = billStatus(b, warnD()); return '<div class="row"><div class="grow"><b>' + esc(b.title) + '</b><small>' + esc(appName(b.appId)) + ' · ' + (b.dir === 'in' ? 'Collect ' : 'Pay ') + esc(money(periodInfo(b).balance)) + ' · ' + fmtD(b.nextDue) + '</small></div><div class="meta"><span class="pill ' + st.cls + '">' + st.label + '</span><button class="btn sm" data-act="pay" data-id="' + b.id + '">Mark paid</button></div></div>'; }).join('') + '</div>' : empty('No active payment plans', 'Add one to get yellow and red reminders here.', '<button class="btn pri sm" data-act="goPay">Go to payments</button>')) + '</section>';
  } else {
    left = '<section class="card"><h2><span class="grow">Renewals</span><button class="btn sm" data-act="goRenew">All renewals</button></h2>' + renewRows(ren) + '</section>';
  }
  h += '<div class="g-2">' + left + '<section class="card"><h2>Recent updates</h2>' + (logs.length ? '<div class="rows">' + logs.map((l) => '<div class="row"><div class="grow"><b>' + esc(l.title) + '</b><small>' + esc(appName(l.appId)) + ' · ' + fmtD(l.date) + (l.version ? ' · ' + esc(l.version) : '') + '</small></div>' + typePill(l.type) + '</div>').join('') + '</div>' : empty('No updates logged', 'Record every change you ship.', '')) + '</section></div>';
  if (admin) h += '<section class="card" style="margin-bottom:18px"><h2><span class="grow">Domain, SSL and hosting renewals</span><button class="btn sm" data-act="goRenew">All renewals</button></h2>' + renewRows(ren) + '</section>';
  const apps = DB.apps.filter((a) => !a.archived).slice().sort((a, b) => String(a.name).localeCompare(String(b.name)));
  h += '<section><div class="phead" style="margin-bottom:14px"><h2 style="font-size:18px">Your apps</h2></div>' + (apps.length ? '<div class="g-cards">' + apps.map(appCard).join('') + '</div>' : empty('No apps yet', 'Add your first app to start tracking it.', '<button class="btn pri" data-act="addApp">' + ic('plus', 16) + ' Add app</button>')) + '</section>';
  return h;
}
function renewRows(ren) {
  return ren.length ? '<div class="rows">' + ren.map((r) => { const st = renewStatus(r, renewD()); return '<div class="row"><div class="grow"><b>' + esc(r.name) + '</b><small>' + esc(r.kind) + ' · ' + esc(appName(r.appId)) + ' · ' + fmtD(r.expiresAt) + '</small></div><span class="pill ' + st.cls + '">' + st.label + '</span></div>'; }).join('') + '</div>' : empty('No renewals tracked', 'Add your domains, SSL certificates and hosting expiry dates.', '<button class="btn pri sm" data-act="addRenew">' + ic('plus', 14) + ' Add renewal</button>');
}

/* ---------- apps ---------- */
export function vApps() {
  let l = DB.apps.filter((a) => (ui.showArchived ? true : !a.archived));
  if (ui.appFilter !== 'all') l = l.filter((a) => a.status === ui.appFilter);
  if (ui.tagFilter) l = l.filter((a) => (a.tags || []).indexOf(ui.tagFilter) >= 0);
  l.sort((a, b) => String(a.name).localeCompare(String(b.name)));
  const tags = Array.from(new Set(DB.apps.reduce((s, a) => s.concat(a.tags || []), []))).sort();
  const nArch = DB.apps.filter((a) => a.archived).length;
  return pageHead('Apps', DB.apps.length + ' tracked', (isAdmin() ? '<button class="btn" data-act="expApps">' + ic('download', 14) + ' Export CSV</button>' : '') + '<button class="btn pri" data-act="addApp">' + ic('plus', 16) + ' Add app</button>') +
    '<div class="chipbar"><select data-f="appFilter" style="width:auto" aria-label="Filter by status"><option value="all">All statuses</option>' + STATUSES.map((s) => '<option value="' + s[0] + '"' + (ui.appFilter === s[0] ? ' selected' : '') + '>' + s[1] + '</option>').join('') + '</select>' +
    (tags.length ? '<select data-f="tagFilter" style="width:auto" aria-label="Filter by tag"><option value="">All tags</option>' + tags.map((t) => '<option' + (ui.tagFilter === t ? ' selected' : '') + '>' + esc(t) + '</option>').join('') + '</select>' : '') +
    (nArch ? '<button class="fchip ' + (ui.showArchived ? 'on' : '') + '" data-act="toggleArchived">' + (ui.showArchived ? 'Hide' : 'Show') + ' archived (' + nArch + ')</button>' : '') + '</div>' +
    (l.length ? '<div class="g-cards">' + l.map(appCard).join('') + '</div>' : empty('No apps here', 'Add the web apps you built. Keep their hosting, accounts and payments in one place.', '<button class="btn pri" data-act="addApp">' + ic('plus', 16) + ' Add app</button>'));
}
export function vApp() {
  const a = appById(ui.appId);
  if (!a) { ui.appId = null; return vApps(); }
  const admin = isAdmin();
  const mine = (c) => DB[c].filter((x) => x.appId === a.id);
  const bills = admin ? DB.billing.filter((b) => b.appId === a.id) : [];
  const tabs = [['overview', 'Overview', 0], ['hosting', 'Hosting & repo', (a.deploys || []).length], ['accounts', 'Accounts & keys', mine('services').length + mine('envs').length], ['logins', 'Logins', mine('logins').length], ['files', 'Files', mine('files').length], ['renewals', 'Renewals', mine('renewals').length]];
  if (admin) tabs.push(['billing', 'Billing', bills.length]);
  tabs.push(['updates', 'Updates', mine('changelog').length]);
  if (!tabs.some((t) => t[0] === ui.tab)) ui.tab = 'overview';
  let h = '<button class="back" data-act="back">' + ic('back', 16) + ' All apps</button>' +
    '<div class="dhead"><span class="avatar">' + esc(initials(a.name)) + '</span><div class="grow"><h1>' + esc(a.name) + '</h1><p>' + esc(a.tagline || '') + '</p></div><div class="pact">' + statusPill(a.status) + (a.archived ? '<span class="tag plain">Archived</span>' : '') +
    (safeUrl(a.url) ? '<a class="btn" href="' + esc(safeUrl(a.url)) + '" target="_blank" rel="noopener noreferrer">Open app ' + ic('ext', 14) + '</a>' : '') +
    '<button class="btn" data-act="editApp">' + ic('edit', 14) + ' Edit</button><button class="btn" data-act="archiveApp">' + ic('archive', 14) + ' ' + (a.archived ? 'Unarchive' : 'Archive') + '</button>' + (admin ? '<button class="btn ghost" data-act="delApp" title="Delete app">' + ic('trash', 14) + '</button>' : '') + '</div></div>' +
    '<div class="tabs" role="tablist">' + tabs.map((t) => '<button class="tab ' + (ui.tab === t[0] ? 'on' : '') + '" role="tab" data-act="tab" data-v="' + t[0] + '">' + t[1] + (t[2] ? '<em>' + t[2] + '</em>' : '') + '</button>').join('') + '</div>';
  if (ui.tab === 'overview') h += tOverview(a, mine('changelog').sort(byDateDesc));
  else if (ui.tab === 'hosting') h += tHosting(a);
  else if (ui.tab === 'accounts') h += tAccounts(a, mine('services'), mine('envs'));
  else if (ui.tab === 'logins') h += tLogins(mine('logins'));
  else if (ui.tab === 'files') h += tFiles(mine('files'));
  else if (ui.tab === 'renewals') h += tRenewals(mine('renewals'));
  else if (ui.tab === 'billing') h += tBilling(bills);
  else h += tUpdates(mine('changelog').sort(byDateDesc));
  return h;
}
function tOverview(a, logs) {
  const cl = isAdmin() ? clientById(a.clientId) : null;
  const last = logs[0];
  return '<div class="g-eq"><div class="stack"><section class="card"><h2>About</h2><p class="pre">' + esc(a.description || 'No description yet.') + '</p>' + (a.stack && a.stack.length ? '<div class="chips" style="margin-top:14px">' + a.stack.map((s) => '<span class="chip">' + esc(s) + '</span>').join('') + '</div>' : '') + (a.tags && a.tags.length ? '<div style="margin-top:10px">' + tagChips(a) + '</div>' : '') + '</section>' +
    '<section class="card"><h2>Features</h2>' + list(a.features) + '</section><section class="card"><h2>What is included</h2>' + list(a.inclusions) + '</section></div>' +
    '<div class="stack"><section class="card"><h2>Snapshot</h2>' + kv('Live URL', link(a.url)) +
    (isAdmin() ? kv('Client', cl ? '<a href="#" data-act="openClient" data-id="' + cl.id + '">' + esc(cl.name) + '</a>' : '<span class="muted">Not linked</span>') : '') +
    kv('GitHub', a.repo && a.repo.account ? '<span>' + esc(a.repo.account) + (a.repo.name ? ' / ' + esc(a.repo.name) : '') + '</span>' : '<span class="muted">Not set</span>') +
    kv('Deployed on', (a.deploys || []).length ? '<div class="chips">' + a.deploys.map((d) => '<span class="chip">' + esc(d.provider) + (d.account ? ' · ' + esc(d.account) : '') + '</span>').join('') + '</div>' : '<span class="muted">Not set</span>') +
    kv('Accounts & keys', DB.services.filter((x) => x.appId === a.id).length + ' saved') + kv('Logins', DB.logins.filter((x) => x.appId === a.id).length + ' saved') + (isAdmin() ? kv('Billing', appBillPill(a.id)) : '') +
    kv('Last update', last ? esc(last.title) + ' · ' + fmtD(last.date) : '<span class="muted">None logged</span>') + '</section>' +
    (cl ? '<section class="card"><h2>Client contact</h2>' + kv('Name', esc(cl.name)) + kv('Phone', copyv(cl.phone)) + kv('Email', copyv(cl.email)) + '</section>' : '') +
    (a.notes ? '<section class="card"><h2>Notes</h2><p class="pre">' + esc(a.notes) + '</p></section>' : '') + '</div></div>';
}
function tHosting(a) {
  const r = a.repo || {};
  const repo = '<section class="card"><h2><span class="grow">GitHub repository</span><button class="btn sm" data-act="editRepo">' + ic('edit', 14) + ' ' + (r.account || r.name ? 'Edit' : 'Add') + '</button></h2>' +
    (r.account || r.name || r.url ? kv('Account', copyv(r.account)) + kv('Repository', copyv(r.name)) + kv('Link', link(r.url)) + kv('Branch', esc(r.branch || 'main')) + kv('Visibility', esc(r.visibility || '')) + kv('Notes', esc(r.notes || '')) : empty('No repository saved', 'Note which GitHub account this app is uploaded to.', '')) + '</section>';
  const dep = '<section class="card"><h2><span class="grow">Deployments</span><button class="btn sm pri" data-act="addDeploy">' + ic('plus', 14) + ' Add</button></h2>' +
    ((a.deploys || []).length ? a.deploys.map((d) => '<div class="item"><div class="item-h"><span class="prov">' + esc(initials(d.provider)) + '</span><div class="grow"><b>' + esc(d.provider) + '</b><br><small class="muted">' + esc(d.project || '') + '</small></div>' + iconBtns('editDeploy', 'delDeploy', d.id) + '</div>' + kv('Account', copyv(d.account)) + kv('Live URL', link(d.url)) + kv('Domain', link(d.domain)) + kv('Notes', esc(d.notes || '')) + '</div>').join('') : empty('Not deployed anywhere yet', 'Pick Netlify, Vercel, Cloudflare or another host and save the account.', '')) + '</section>';
  return '<div class="g-eq">' + repo + dep + '</div>';
}
function tAccounts(a, services, envs) {
  const sv = '<section class="card"><h2><span class="grow">Accounts, storage, AI and API keys</span><button class="btn sm pri" data-act="addService">' + ic('plus', 14) + ' Add</button></h2>' +
    (services.length ? services.map((s) => '<div class="item"><div class="item-h"><span class="prov">' + esc(initials(s.type)) + '</span><div class="grow"><b>' + esc(s.provider || s.type) + '</b><br><small class="muted">' + esc(s.type) + '</small></div>' + iconBtns('editService', 'delService', s.id) + '</div>' + kv('Account', copyv(s.account)) + kv('Project / ID', copyv(s.project)) + kv('Key / secret', secretCell('services', s.id, 'secret', s.secret)) + kv('Notes', esc(s.notes || '')) + '</div>').join('') : empty('Nothing saved yet', 'Add Firebase, Supabase, AI keys, storage, domain and anything else this app depends on.', '')) + '</section>';
  const ev = '<section class="card"><h2><span class="grow">Environment variables (.env)</span><button class="btn sm pri" data-act="addEnv">' + ic('plus', 14) + ' Add</button></h2>' +
    (envs.length ? envs.map((e) => '<div class="item"><div class="item-h"><span class="prov">' + ic('terminal', 16) + '</span><div class="grow"><b>' + esc(e.name) + '</b></div>' + iconBtns('editEnv', 'delEnv', e.id) + '</div>' + kv('Contents', secretCell('envs', e.id, 'content', e.content, true)) + kv('Notes', esc(e.notes || '')) + '</div>').join('') : empty('No .env files saved', 'Paste the whole .env here. It is encrypted before it leaves your browser.', '')) + '</section>';
  return '<div class="g-eq">' + sv + ev + '</div>';
}
function tLogins(lg) {
  return '<section class="card"><h2><span class="grow">Developer, admin and user logins</span><button class="btn sm pri" data-act="addLogin">' + ic('plus', 14) + ' Add</button></h2>' +
    (lg.length ? lg.map((l) => '<div class="item"><div class="item-h"><span class="prov">' + ic('key', 16) + '</span><div class="grow"><b>' + esc(l.role) + ' login</b></div>' + iconBtns('editLogin', 'delLogin', l.id) + '</div>' + kv('Login page', link(l.url)) + kv('Username', copyv(l.user)) + kv('Password', secretCell('logins', l.id, 'pass', l.pass)) + kv('Notes', esc(l.notes || '')) + '</div>').join('') : empty('No logins saved', 'Save the developer and admin logins so you never lose them.', '<button class="btn pri sm" data-act="addLogin">' + ic('plus', 14) + ' Add login</button>')) + '</section>';
}
function tFiles(files) {
  return '<section class="card"><h2><span class="grow">Files</span><button class="btn sm pri" data-act="addFile">' + ic('upload', 14) + ' Upload</button></h2>' +
    (files.length ? '<div class="rows">' + files.map((f) => '<div class="row"><span class="prov">' + ic('file', 16) + '</span><div class="grow"><b>' + esc(f.name) + '</b><small>' + Math.max(1, Math.round((f.size || 0) / 1024)) + ' KB' + (f.notes ? ' · ' + esc(f.notes) : '') + (f.createdByName ? ' · ' + esc(f.createdByName) : '') + '</small></div><button class="btn sm" data-act="dlFile" data-id="' + f.id + '">' + ic('download', 14) + ' Download</button><button class="icon-btn" data-act="delFile" data-id="' + f.id + '" title="Delete">' + ic('trash', 15) + '</button></div>').join('') + '</div>' : empty('No files yet', 'Contracts, screenshots and documents. Encrypted in your browser. Up to 600 KB each.', '<button class="btn pri sm" data-act="addFile">' + ic('upload', 14) + ' Upload file</button>')) + '</section>';
}
function tRenewals(rs) {
  return '<div class="phead" style="margin-bottom:14px"><h2 style="font-size:18px">Domain, SSL and hosting</h2><div class="pact"><button class="btn pri" data-act="addRenew">' + ic('plus', 16) + ' Add renewal</button></div></div>' +
    (rs.length ? '<div class="g-cards" style="grid-template-columns:repeat(auto-fill,minmax(320px,1fr))">' + rs.slice().sort(renewSort).map((r) => renewCard(r, false)).join('') + '</div>' : empty('Nothing tracked', 'Track when the domain, SSL certificate or hosting expires.', '<button class="btn pri" data-act="addRenew">' + ic('plus', 16) + ' Add renewal</button>'));
}
function tBilling(bills) {
  return '<div class="phead" style="margin-bottom:14px"><h2 style="font-size:18px">Payment plans</h2><div class="pact"><button class="btn pri" data-act="addBill">' + ic('plus', 16) + ' Add payment plan</button></div></div>' +
    (bills.length ? '<div class="g-cards" style="grid-template-columns:repeat(auto-fill,minmax(340px,1fr))">' + bills.slice().sort(billSort).map((b) => billCard(b, false)).join('') + '</div>' : empty('No payment plans', 'Set up a subscription, maintenance fee or one-time payment and get reminded when it is due.', '<button class="btn pri" data-act="addBill">' + ic('plus', 16) + ' Add payment plan</button>'));
}
function tUpdates(logs) {
  return '<div class="phead" style="margin-bottom:14px"><h2 style="font-size:18px">Update history</h2><div class="pact"><button class="btn pri" data-act="addLog">' + ic('plus', 16) + ' Log an update</button></div></div>' +
    (logs.length ? '<div class="tl">' + logs.map((l) => logItem(l, false)).join('') + '</div>' : empty('No updates yet', 'Log every feature, fix and improvement you ship.', '<button class="btn pri" data-act="addLog">' + ic('plus', 16) + ' Log an update</button>'));
}

/* ---------- payments (admin) ---------- */
export function vPay() {
  const A = attention(), act = activeBills();
  const win = (b) => daysBetween(todayISO(), b.nextDue) <= 30;
  const inn = sum(act.filter((b) => b.dir === 'in' && win(b)), (b) => periodInfo(b).balance);
  const out = sum(act.filter((b) => b.dir === 'out' && win(b)), (b) => periodInfo(b).balance);
  let l = DB.billing.slice().sort(billSort);
  if (ui.pf === 'in') l = l.filter((b) => b.dir === 'in'); else if (ui.pf === 'out') l = l.filter((b) => b.dir === 'out'); else if (ui.pf === 'over') l = l.filter((b) => billStatus(b, warnD()).k === 'over');
  const hist = [];
  DB.billing.forEach((b) => (b.history || []).forEach((h) => hist.push({ h, b })));
  hist.sort((x, y) => String(y.h.date).localeCompare(String(x.h.date)));
  const chips = [['all', 'All'], ['in', 'Client pays me'], ['out', 'I pay'], ['over', 'Overdue']];
  return pageHead('Payments', 'Subscriptions, maintenance fees and service costs', '<button class="btn" data-act="expPay">' + ic('download', 14) + ' Export CSV</button><button class="btn pri" data-act="addBill">' + ic('plus', 16) + ' Add payment plan</button>') + banner(A) +
    '<div class="g-kpi"><div class="kpi"><span class="eyebrow">To collect · 30 days</span><b>' + esc(money(inn)) + '</b><small>Includes overdue and late fees</small></div><div class="kpi"><span class="eyebrow">To pay · 30 days</span><b>' + esc(money(out)) + '</b><small>Includes overdue</small></div><div class="kpi ' + (A.over ? 'bad' : '') + '"><span class="eyebrow">Overdue</span><b>' + A.over + '</b><small>' + A.toCollect + ' to collect · ' + A.toPay + ' to pay</small></div><div class="kpi"><span class="eyebrow">Collected this month</span><b>' + esc(money(collectedMonth())) + '</b><small>From logged payments</small></div></div>' +
    '<div class="chipbar">' + chips.map((c) => '<button class="fchip ' + (ui.pf === c[0] ? 'on' : '') + '" data-act="pfilter" data-v="' + c[0] + '">' + c[1] + '</button>').join('') + '</div>' +
    (l.length ? '<div class="g-cards" style="grid-template-columns:repeat(auto-fill,minmax(340px,1fr))">' + l.map((b) => billCard(b, true)).join('') + '</div>' : empty('Nothing here', 'No payment plans match this filter.', '<button class="btn pri" data-act="addBill">' + ic('plus', 16) + ' Add payment plan</button>')) +
    '<section class="card" style="margin-top:22px"><h2>Payment log</h2>' + (hist.length ? '<div class="scroll"><table class="tbl"><thead><tr><th>Date</th><th>App</th><th>Plan</th><th>Type</th><th>Amount</th><th>Receipt</th></tr></thead><tbody>' + hist.slice(0, 30).map((x) => '<tr><td>' + fmtD(x.h.date) + '</td><td>' + esc(appName(x.b.appId)) + '</td><td>' + esc(x.b.title) + '</td><td>' + (x.b.dir === 'in' ? '<span class="pill good">Received</span>' : '<span class="pill">Paid out</span>') + '</td><td>' + esc(money(x.h.amount)) + '</td><td class="mono">' + esc(x.h.receiptNo || x.h.ref || '—') + '</td></tr>').join('') + '</tbody></table></div>' : '<p class="muted">Logged payments will show here.</p>') + '</section>';
}

/* ---------- clients (admin) ---------- */
function clientBalance(c) { return sum(DB.billing.filter((b) => b.clientId === c.id && b.state === 'active' && b.dir === 'in'), (b) => { const s = billStatus(b, warnD()); return s.k === 'over' ? periodInfo(b).balance : 0; }); }
export function vClients() {
  const cs = DB.clients.slice().sort((a, b) => String(a.name).localeCompare(String(b.name)));
  return pageHead('Clients', cs.length + ' saved', '<button class="btn pri" data-act="addClient">' + ic('plus', 16) + ' Add client</button>') +
    (cs.length ? '<div class="g-cards">' + cs.map((c) => {
      const apps = DB.apps.filter((a) => a.clientId === c.id), owed = clientBalance(c);
      return '<div class="acard" role="button" tabindex="0" data-act="openClient" data-id="' + c.id + '"><div class="ahead"><span class="avatar">' + esc(initials(c.name)) + '</span><div class="grow"><h3>' + esc(c.name) + '</h3><p>' + esc(c.company || c.email || c.phone || '') + '</p></div></div><div class="chips">' + apps.slice(0, 4).map((a) => '<span class="chip">' + esc(a.name) + '</span>').join('') + (apps.length ? '' : '<span class="muted small">No apps linked</span>') + '</div><div class="afoot"><span>' + apps.length + ' app' + (apps.length === 1 ? '' : 's') + '</span>' + (owed ? '<span class="pill bad">Owes ' + esc(money(owed)) + '</span>' : '<span class="pill good">Up to date</span>') + '</div></div>';
    }).join('') + '</div>' : empty('No clients yet', 'Save who pays for each app so you can link their plans and message them fast.', '<button class="btn pri" data-act="addClient">' + ic('plus', 16) + ' Add client</button>'));
}
export function vClient() {
  const c = clientById(ui.clientId);
  if (!c) { ui.clientId = null; return vClients(); }
  const apps = DB.apps.filter((a) => a.clientId === c.id), bills = DB.billing.filter((b) => b.clientId === c.id).sort(billSort);
  return '<button class="back" data-act="backClient">' + ic('back', 16) + ' All clients</button><div class="dhead"><span class="avatar">' + esc(initials(c.name)) + '</span><div class="grow"><h1>' + esc(c.name) + '</h1><p>' + esc(c.company || '') + '</p></div><div class="pact"><button class="btn" data-act="editClient" data-id="' + c.id + '">' + ic('edit', 14) + ' Edit</button><button class="btn ghost" data-act="delClient" data-id="' + c.id + '">' + ic('trash', 14) + '</button></div></div>' +
    '<div class="g-eq"><section class="card"><h2>Contact</h2>' + kv('Phone', copyv(c.phone)) + kv('Email', copyv(c.email)) + kv('Notes', esc(c.notes || '')) + (c.phone || c.email ? '' : '<p class="muted">No contact details yet.</p>') + '</section>' +
    '<section class="card"><h2>Apps</h2>' + (apps.length ? '<div class="rows">' + apps.map((a) => '<div class="row" role="button" tabindex="0" data-act="openApp" data-id="' + a.id + '" style="cursor:pointer"><span class="avatar" style="width:36px;height:36px;font-size:13px">' + esc(initials(a.name)) + '</span><div class="grow"><b>' + esc(a.name) + '</b><small>' + esc(a.url || '') + '</small></div>' + statusPill(a.status) + '</div>').join('') + '</div>' : '<p class="muted">No apps linked. Open an app and choose this client.</p>') + '</section></div>' +
    '<div class="phead" style="margin:22px 0 14px"><h2 style="font-size:18px">Payment plans</h2></div>' + (bills.length ? '<div class="g-cards" style="grid-template-columns:repeat(auto-fill,minmax(340px,1fr))">' + bills.map((b) => billCard(b, true)).join('') + '</div>' : empty('No payment plans', 'Create one from the Payments page and pick this client.', ''));
}

/* ---------- renewals / updates / search ---------- */
export function vRenew() {
  const kinds = ['all'].concat(RENEW_KINDS);
  let l = DB.renewals.slice().sort(renewSort);
  if (ui.rf !== 'all') l = l.filter((r) => r.kind === ui.rf);
  return pageHead('Renewals', 'Domains, SSL certificates and hosting expiry dates', '<button class="btn pri" data-act="addRenew">' + ic('plus', 16) + ' Add renewal</button>') + banner(attention()) +
    '<div class="chipbar">' + kinds.map((k) => '<button class="fchip ' + (ui.rf === k ? 'on' : '') + '" data-act="rfilter" data-v="' + k + '">' + (k === 'all' ? 'All' : k) + '</button>').join('') + '</div>' +
    (l.length ? '<div class="g-cards" style="grid-template-columns:repeat(auto-fill,minmax(320px,1fr))">' + l.map((r) => renewCard(r, true)).join('') + '</div>' : empty('Nothing tracked', 'Add the domain, SSL and hosting expiry dates so nothing lapses.', '<button class="btn pri" data-act="addRenew">' + ic('plus', 16) + ' Add renewal</button>'));
}
export function vLog() {
  let l = allLogs();
  if (ui.logApp !== 'all') l = l.filter((x) => x.appId === ui.logApp);
  if (ui.logType !== 'all') l = l.filter((x) => x.type === ui.logType);
  return pageHead('Updates', 'Everything you have shipped, newest first', '<button class="btn pri" data-act="addLog">' + ic('plus', 16) + ' Log an update</button>') +
    '<div class="chipbar"><select data-f="logApp" style="width:auto" aria-label="Filter by app"><option value="all">All apps</option>' + DB.apps.map((a) => '<option value="' + a.id + '"' + (ui.logApp === a.id ? ' selected' : '') + '>' + esc(a.name) + '</option>').join('') + '</select><select data-f="logType" style="width:auto" aria-label="Filter by type"><option value="all">All types</option>' + LOG_TYPES.map((t) => '<option' + (ui.logType === t ? ' selected' : '') + '>' + t + '</option>').join('') + '</select></div>' +
    (l.length ? '<div class="tl">' + l.map((x) => logItem(x, true)).join('') + '</div>' : empty('No updates found', 'Log a feature, fix or improvement to build your history.', '<button class="btn pri" data-act="addLog">' + ic('plus', 16) + ' Log an update</button>'));
}
export function vSearch() {
  return pageHead('Search', 'Apps, logins, accounts, renewals' + (isAdmin() ? ', clients and payments' : ''), '') +
    '<label class="search" for="gq">' + ic('search', 20) + '<input id="gq" type="text" autocomplete="off" placeholder="Type at least 2 letters…" value="' + esc(ui.q) + '"></label><p class="hint" style="margin:8px 4px 16px">Passwords, keys and .env contents are encrypted, so they are not searched.</p><div id="sres">' + searchResults(ui.q) + '</div>';
}
export function searchResults(q) {
  q = String(q || '').trim().toLowerCase();
  if (q.length < 2) return '<p class="muted">Results will show here.</p>';
  const m = (...f) => f.some((x) => String(x || '').toLowerCase().indexOf(q) >= 0);
  const groups = [];
  const row = (icn, title, sub, act, id, tab) => '<div class="row" role="button" tabindex="0" data-act="' + act + '" data-id="' + id + '"' + (tab ? ' data-tab="' + tab + '"' : '') + ' style="cursor:pointer"><span class="prov">' + ic(icn, 16) + '</span><div class="grow"><b>' + esc(title) + '</b><small>' + esc(sub) + '</small></div>' + ic('back', 14).replace('<svg', '<svg style="transform:rotate(180deg)"') + '</div>';
  const add = (name, rows) => { if (rows.length) groups.push('<section class="card" style="margin-bottom:14px"><h2>' + name + ' <span class="tag plain">' + rows.length + '</span></h2><div class="rows">' + rows.join('') + '</div></section>'); };
  add('Apps', DB.apps.filter((a) => m(a.name, a.tagline, a.url, a.description, (a.tags || []).join(' '), (a.stack || []).join(' '), a.repo && a.repo.account, a.repo && a.repo.name, (a.deploys || []).map((d) => [d.provider, d.account, d.domain, d.project].join(' ')).join(' '))).map((a) => row('apps', a.name, a.tagline || a.url || '', 'openApp', a.id)));
  add('Logins', DB.logins.filter((l) => m(l.role, l.user, l.url, l.notes, appName(l.appId))).map((l) => row('key', l.role + ' · ' + (l.user || ''), appName(l.appId), 'openApp', l.appId, 'logins')));
  add('Accounts and keys', DB.services.filter((s) => m(s.type, s.provider, s.account, s.project, s.notes, appName(s.appId))).map((s) => row('shield', (s.provider || s.type) + ' · ' + (s.account || ''), appName(s.appId), 'openApp', s.appId, 'accounts')));
  add('Environment files', DB.envs.filter((e) => m(e.name, e.notes, appName(e.appId))).map((e) => row('terminal', e.name, appName(e.appId), 'openApp', e.appId, 'accounts')));
  add('Files', DB.files.filter((f) => m(f.name, f.notes, appName(f.appId))).map((f) => row('file', f.name, appName(f.appId), 'openApp', f.appId, 'files')));
  add('Renewals', DB.renewals.filter((r) => m(r.name, r.provider, r.kind, appName(r.appId))).map((r) => row('calendar', r.name, r.kind + ' · ' + fmtD(r.expiresAt), 'openApp', r.appId || '', 'renewals')));
  add('Updates', DB.changelog.filter((l) => m(l.title, l.details, l.version, appName(l.appId))).map((l) => row('log', l.title, appName(l.appId) + ' · ' + fmtD(l.date), 'openApp', l.appId, 'updates')));
  if (isAdmin()) {
    add('Clients', DB.clients.filter((c) => m(c.name, c.company, c.email, c.phone)).map((c) => row('users', c.name, c.company || c.email || '', 'openClient', c.id)));
    add('Payment plans', DB.billing.filter((b) => m(b.title, b.plan, b.party, clientName(b.clientId), appName(b.appId))).map((b) => row('pay', b.title, appName(b.appId) + (b.clientId ? ' · ' + clientName(b.clientId) : ''), 'openApp', b.appId, 'billing')));
  }
  return groups.length ? groups.join('') : empty('No results', 'Try a different word.', '');
}

/* ---------- settings ---------- */
export function vSet() {
  const s = cfg(), admin = isAdmin(), p = ctx.profile || {};
  const me = '<section class="card"><h2>Your account</h2>' + kv('Name', esc(p.name || '')) + kv('Email', esc(p.email || '')) + kv('Role', '<span class="pill ' + (admin ? 'info' : '') + '">' + (admin ? 'Admin' : 'Developer') + '</span>') + kv('Two-step login', '<span class="pill good">Google Authenticator on</span>') + kv('App version', esc(VERSION)) +
    '<div class="pact" style="margin-top:14px"><button class="btn" data-act="signout">' + ic('logout', 14) + ' Sign out</button></div></section>';
  const vault = '<section class="card"><h2>Secrets vault</h2><p class="muted small" style="margin-bottom:12px">Passwords, API keys, .env text and files are encrypted in your browser with the team passphrase before they reach Firebase. The passphrase is never stored.</p>' +
    '<div class="setrow"><div><b>Status</b><small>' + (DB.vault ? (ctx.key ? 'Unlocked on this device' : 'Locked on this device') : 'Not created yet') + '</small></div>' + (ctx.key ? '<button class="btn" data-act="lockSecrets">' + ic('lock', 14) + ' Lock now</button>' : DB.vault ? '<button class="btn pri" data-act="unlock">' + ic('unlock', 14) + ' Unlock</button>' : (admin ? '<button class="btn pri" data-act="setupVault">Create passphrase</button>' : '<span class="muted small">Ask the admin</span>')) + '</div>' +
    (admin && DB.vault ? '<div class="setrow"><div><b>Team passphrase</b><small>Change it when someone leaves. Everything saved is re-encrypted.</small></div><button class="btn" data-act="changePass">Change</button></div>' : '') + '</section>';
  const look = '<section class="card"><h2>Appearance</h2><div class="setrow"><div><b>Theme</b><small>Match device, light or dark</small></div><select id="theme-sel"><option value="system">Match device</option><option value="light">Light</option><option value="dark">Dark</option></select></div></section>';
  let h = pageHead('Settings', 'Account, team, reminders and backup', '');
  if (!admin) return h + '<div class="g-eq"><div class="stack">' + me + look + '</div><div class="stack">' + vault + '</div></div>';
  const inp = (k, l, sub, type, extra) => '<div class="setrow"><div><b>' + l + '</b><small>' + sub + '</small></div><input type="' + type + '" data-set="' + k + '" value="' + esc(s[k]) + '" ' + (extra || '') + '></div>';
  const ta = (k, l) => '<div class="fld" style="margin-top:10px"><label for="s_' + k + '">' + l + '</label><textarea id="s_' + k + '" data-set="' + k + '" rows="4">' + esc(s[k]) + '</textarea></div>';
  const auditCard = () => {
    const rows = (DB.audit || []).map((a) => {
      const t = a.createdAt && a.createdAt.toDate ? a.createdAt.toDate().toLocaleString() : 'just now';
      return '<div class="row"><div class="grow"><b>' + esc(a.action) + '</b><small>' + esc((a.createdByName || '') + (a.detail ? ' · ' + a.detail : '')) + '</small></div><small class="muted">' + esc(t) + '</small></div>';
    }).join('');
    return '<section class="card"><h2>Activity log</h2><p class="muted small" style="margin-bottom:12px">Who unlocked, revealed or copied secrets, downloaded files, changed the team or the passphrase, and made backups. Shows the last 100. The app records it in the browser of each person, so it helps accountability but is not tamper-proof. Secret values are never written to it.</p>' + (rows ? '<div class="rows" style="max-height:360px;overflow:auto">' + rows + '</div>' : '<div class="empty">No activity yet.</div>') + '</section>';
  };
  const team = '<section class="card"><h2>Team</h2>' +
    '<div class="rows">' + DB.users.slice().sort((a, b) => String(a.name).localeCompare(String(b.name))).map((u) => '<div class="row"><span class="avatar" style="width:36px;height:36px;font-size:13px">' + esc(initials(u.name || u.email)) + '</span><div class="grow"><b>' + esc(u.name || u.email) + '</b><small>' + esc(u.email) + '</small></div><span class="pill ' + (u.role === 'admin' ? 'info' : '') + '">' + (u.role === 'admin' ? 'Admin' : 'Developer') + '</span>' + (u.id !== (ctx.user && ctx.user.uid) ? '<button class="btn sm" data-act="setRole" data-id="' + u.id + '">' + (u.role === 'admin' ? 'Make developer' : 'Make admin') + '</button><button class="icon-btn" data-act="rmUser" data-id="' + u.id + '" title="Remove access">' + ic('trash', 15) + '</button>' : '') + '</div>').join('') + '</div>' +
    (DB.invites.length ? '<p class="eyebrow" style="margin:16px 0 6px">Invites</p><div class="rows">' + DB.invites.map((i) => { const joined = DB.users.some((u) => u.email === i.id); return '<div class="row"><div class="grow"><b>' + esc(i.email || i.id) + '</b><small>' + (joined ? 'Joined' : 'Waiting for them to join') + '</small></div><button class="icon-btn" data-act="rmInvite" data-id="' + i.id + '" title="Remove invite">' + ic('trash', 15) + '</button></div>'; }).join('') + '</div>' : '') +
    '<div class="fld" style="margin-top:16px"><label for="inv-email">Invite a developer by email</label><div class="pw"><input id="inv-email" type="email" placeholder="dev@example.com" autocomplete="off"><button class="btn pri" data-act="invite">Invite</button></div><small class="hint">They open the site, choose Join, and sign up with this same email.</small></div></section>';
  return h + '<div class="g-eq"><div class="stack">' + me + team + vault + auditCard() + '</div><div class="stack">' +
    '<section class="card"><h2>Business and reminders</h2>' + inp('businessName', 'Business name', 'Shown on receipts and invoices', 'text') + inp('currency', 'Currency symbol', 'Used for all amounts', 'text', 'maxlength="4"') + inp('warnDays', 'Yellow payment reminder', 'Days before a due date', 'number', 'min="1" max="60"') + inp('renewWarnDays', 'Yellow renewal reminder', 'Days before expiry', 'number', 'min="1" max="180"') +
    '<div class="fld" style="margin-top:10px"><label for="s_businessContact">Contact details on receipts</label><textarea id="s_businessContact" data-set="businessContact" rows="3" placeholder="Address, phone, email">' + esc(s.businessContact) + '</textarea></div>' + ta('payInfo', 'How clients should pay (GCash, bank, etc.)') + '</section>' +
    '<section class="card"><h2>Message templates</h2><p class="muted small">Placeholders: {client} {title} {app} {balance} {due_date} {pay_info} {paid} {receipt_no} {business}</p>' + ta('msgDue', 'Payment reminder') + ta('msgOverdue', 'Overdue notice') + ta('msgReceipt', 'Thank-you after payment') + '</section>' + look +
    '<section class="card"><h2>Export</h2><div class="pact"><button class="btn" data-act="expPay">' + ic('download', 14) + ' Payments CSV</button><button class="btn" data-act="expApps">' + ic('download', 14) + ' Apps CSV</button><button class="btn" data-act="backup">' + ic('download', 14) + ' Full backup (JSON)</button><button class="btn" data-act="restore">' + ic('upload', 14) + ' Restore from backup</button></div><p class="muted small" style="margin-top:10px">CSV files are handy copies for your records. The full backup has everything, including saved secrets in encrypted form. Passwords, keys, .env and files stay unreadable without the team passphrase, but client names, payments and dates are plain text, so keep the file private. Restore only adds items that are missing. It never changes or deletes what is already there.</p></section></div></div>';
}

/* ---------- shell ---------- */
function navItems() {
  const a = isAdmin();
  return [['dashboard', 'Dashboard', 'dash'], ['apps', 'Apps', 'apps']].concat(a ? [['payments', 'Payments', 'pay'], ['clients', 'Clients', 'users']] : [], [['renewals', 'Renewals', 'calendar'], ['changelog', 'Updates', 'log'], ['search', 'Search', 'search'], ['settings', 'Settings', 'gear']]);
}
function lockBar() {
  if (ctx.key) return '';
  if (DB.vault) return '<div class="lockbar">' + ic('lock') + '<span class="grow">Secrets are locked on this device. Unlock to view or save passwords and keys.</span><button class="btn sm pri" data-act="unlock">Unlock</button></div>';
  if (isAdmin()) return '<div class="lockbar">' + ic('shield') + '<span class="grow"><b>One more step.</b> Create the team passphrase that encrypts passwords, keys and files.</span><button class="btn sm pri" data-act="setupVault">Create passphrase</button></div>';
  return '<div class="lockbar">' + ic('lock') + '<span class="grow">The admin has not created the team passphrase yet.</span></div>';
}
export function shell() {
  const A = attention();
  const on = (k) => (ui.view === k ? 'on' : '');
  const bdg = (k) => { const n = k === 'payments' ? A.over : k === 'renewals' ? A.rOver : 0; return n ? '<em class="badge">' + n + '</em>' : ''; };
  const items = navItems();
  let body;
  if (ctx.pending.size) body = '<div class="loading"><i></i><span>Loading your data…</span></div>';
  else if (ui.view === 'dashboard') body = vDash();
  else if (ui.view === 'apps') body = ui.appId ? vApp() : vApps();
  else if (ui.view === 'payments' && isAdmin()) body = vPay();
  else if (ui.view === 'clients' && isAdmin()) body = ui.clientId ? vClient() : vClients();
  else if (ui.view === 'renewals') body = vRenew();
  else if (ui.view === 'changelog') body = vLog();
  else if (ui.view === 'search') body = vSearch();
  else if (ui.view === 'settings') body = vSet();
  else body = vDash();
  const p = ctx.profile || {};
  return '<div class="shell"><aside class="side"><div class="brand">' + logo() + '<div><b>App Vault</b><small>Control center</small></div></div><nav class="sidenav" aria-label="Main">' +
    items.map((n) => '<button class="nav ' + on(n[0]) + '" data-act="nav" data-v="' + n[0] + '">' + ic(n[2]) + '<span>' + n[1] + '</span>' + bdg(n[0]) + '</button>').join('') + '</nav>' +
    '<div class="sidefoot"><div class="me"><span class="avatar sm">' + esc(initials(p.name || p.email)) + '</span><div class="grow"><b>' + esc(p.name || '') + '</b><small>' + (isAdmin() ? 'Admin' : 'Developer') + '</small></div><span class="live" title="Realtime sync"><i></i>Live</span></div>' +
    '<button class="ghost-d" data-act="theme">' + ic('theme') + '<span>Theme</span></button><button class="ghost-d" data-act="signout">' + ic('logout') + '<span>Sign out</span></button></div></aside>' +
    '<main class="main"><div class="topbar"><div class="brand">' + logo() + '<div><b>App Vault</b><small>' + (isAdmin() ? 'Admin' : 'Developer') + '</small></div></div><button class="btn sm" data-act="signout">' + ic('logout', 14) + ' Sign out</button></div>' + lockBar() + body + '</main>' +
    '<nav class="tabbar" aria-label="Main">' + items.map((n) => '<button class="' + on(n[0]) + '" data-act="nav" data-v="' + n[0] + '">' + ic(n[2], 20) + '<span>' + n[1] + '</span>' + bdg(n[0]) + '</button>').join('') + '</nav></div>';
}
