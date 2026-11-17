// Mga pure helper. Walang DOM at walang Firebase dito, kaya madaling i-test.
export const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const uid = () => Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);
export const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
export const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

export const pad = (n) => String(n).padStart(2, '0');
export const iso = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
export const todayISO = () => iso(new Date());
export const pd = (s) => { const p = String(s).split('-').map(Number); return new Date(p[0], p[1] - 1, p[2]); };
export const daysBetween = (a, b) => Math.round((pd(b) - pd(a)) / 864e5);
export const daysUntil = (s) => daysBetween(todayISO(), s);
export const fmtD = (s) => (s ? new Intl.DateTimeFormat('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }).format(pd(s)) : '—');
export const addDays = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return iso(d); };

export function addMonthsISO(s, m) {
  const d = pd(s);
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + m);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, last));
  return iso(d);
}
export function addCycle(s, cycle) {
  if (cycle === 'weekly') { const d = pd(s); d.setDate(d.getDate() + 7); return iso(d); }
  const m = { monthly: 1, quarterly: 3, semiannual: 6, yearly: 12 }[cycle] || 1;
  return addMonthsISO(s, m);
}

let CUR = '₱';
export const setCurrency = (c) => { CUR = c || '₱'; };
export const money = (n) => CUR + num(n).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
export function short(n) {
  n = num(n);
  if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(n >= 1e4 ? 0 : 1).replace(/\.0$/, '') + 'k';
  return String(Math.round(n));
}
export function initials(n) {
  const w = String(n || '?').replace(/[^A-Za-z0-9 ]/g, ' ').trim().split(/\s+/);
  return ((w[0] || '?')[0] + ((w[1] || '')[0] || '')).toUpperCase();
}
export function safeUrl(u) {
  u = String(u || '').trim();
  if (!u) return '';
  if (/^https?:\/\//i.test(u)) return u;
  if (/^[\w-]+(\.[\w-]+)+/.test(u)) return 'https://' + u;
  return '';
}
export function genPass(n) {
  n = n || 18;
  const cs = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^*-_';
  const r = crypto.getRandomValues(new Uint32Array(n));
  return Array.from(r, (x) => cs[x % cs.length]).join('');
}
export function strength(p) {
  let s = 0;
  if (p.length >= 8) s++;
  if (p.length >= 12) s++;
  if (/[a-z]/.test(p) && /[A-Z]/.test(p)) s++;
  if (/\d/.test(p) && /[^A-Za-z0-9]/.test(p)) s++;
  return s;
}
export function toCSV(rows) {
  return rows.map((r) => r.map((c) => {
    const s = c == null ? '' : String(c);
    return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }).join(',')).join('\r\n');
}
export const fillTemplate = (t, map) => String(t || '').replace(/\{(\w+)\}/g, (m, k) => (map[k] !== undefined ? map[k] : m));
