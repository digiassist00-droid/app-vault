// Pure na logic para sa bayarin at renewals. Walang DOM at walang Firebase.
import { num, round2, todayISO, daysBetween, addCycle, uid } from './util.js';

export const CYCLES = [['monthly', 'Monthly'], ['quarterly', 'Every 3 months'], ['semiannual', 'Every 6 months'], ['yearly', 'Yearly'], ['weekly', 'Weekly'], ['onetime', 'One-time']];
export const CYC_SUF = { monthly: '/month', quarterly: '/quarter', semiannual: '/6 months', yearly: '/year', weekly: '/week', onetime: ' one-time' };
export const CYC_F = { weekly: 52 / 12, monthly: 1, quarterly: 1 / 3, semiannual: 1 / 6, yearly: 1 / 12, onetime: 0 };
export const ORD = { over: 0, soon: 1, ok: 2, paid: 3, paused: 4 };

// Halaga ng kasalukuyang period: base - discount + late fee, bawas ang nabayaran na.
export function periodInfo(b, today) {
  today = today || todayISO();
  const base = num(b.amount);
  const disc = Math.min(num(b.discount), base);
  const od = b.nextDue ? Math.max(0, daysBetween(b.nextDue, today)) : 0;
  let late = 0;
  if (b.state !== 'completed' && od > num(b.graceDays)) {
    if (b.lateType === 'flat') late = round2(num(b.lateValue));
    else if (b.lateType === 'percent') late = round2(((base - disc) * num(b.lateValue)) / 100);
  }
  const total = round2(base - disc + late);
  const paid = round2(num(b.paidThisPeriod));
  return { base, disc, late, total, paid, balance: Math.max(0, round2(total - paid)), overdueDays: od };
}

export function billStatus(b, warn, today) {
  today = today || todayISO();
  warn = num(warn) || 7;
  if (b.state === 'paused') return { k: 'paused', cls: '', label: 'Paused' };
  if (b.state === 'completed') return { k: 'paid', cls: 'good', label: 'Paid in full' };
  const d = daysBetween(today, b.nextDue);
  if (d < 0) return { k: 'over', cls: 'bad', label: 'Overdue ' + (-d) + 'd' };
  if (d <= warn) return { k: 'soon', cls: 'warn', label: d === 0 ? 'Due today' : 'Due in ' + d + 'd' };
  return { k: 'ok', cls: 'good', label: 'Due in ' + d + 'd' };
}

export function renewStatus(r, warn, today) {
  today = today || todayISO();
  warn = num(warn) || 30;
  if (!r.expiresAt) return { k: 'ok', cls: '', label: 'No date' };
  const d = daysBetween(today, r.expiresAt);
  if (d < 0) return { k: 'over', cls: 'bad', label: 'Expired ' + (-d) + 'd ago' };
  if (d <= warn) return { k: 'soon', cls: 'warn', label: d === 0 ? 'Expires today' : 'In ' + d + ' days' };
  return { k: 'ok', cls: 'good', label: 'In ' + d + ' days' };
}

export const monthlyAmt = (b) => Math.max(0, num(b.amount) - num(b.discount)) * (CYC_F[b.cycle] || 0);
export const receiptNo = (date) => 'RCT-' + String(date).replace(/-/g, '') + '-' + Math.random().toString(36).slice(2, 6).toUpperCase();
export const invoiceNo = (b) => 'INV-' + String(b.nextDue || '').replace(/-/g, '') + '-' + String(b.id || '').slice(0, 4).toUpperCase();

// Ang resulta ay patch para sa billing doc, at ang entry para sa history.
export function applyPayment(b, p) {
  const info = periodInfo(b, p.date);
  const amount = round2(num(p.amount));
  const newPaid = round2(info.paid + amount);
  const settled = newPaid >= info.total - 0.005;
  const entry = {
    id: uid(), date: p.date, amount, ref: p.ref || '', note: p.note || '', period: b.nextDue || '',
    due: info.total, discount: info.disc, lateFee: info.late, receiptNo: receiptNo(p.date), settled,
  };
  const patch = { history: [...(b.history || []), entry] };
  if (settled) {
    patch.paidThisPeriod = 0;
    if (b.cycle === 'onetime') patch.state = 'completed';
    else patch.nextDue = addCycle(b.nextDue, b.cycle);
  } else {
    patch.paidThisPeriod = newPaid;
  }
  return { patch, entry, settled, balance: settled ? 0 : round2(info.total - newPaid) };
}

// Hula ng pera sa susunod na n buwan (para sa chart).
export function forecast(bills, n, now) {
  now = now || new Date();
  const base = now.getFullYear() * 12 + now.getMonth();
  const out = Array.from({ length: n }, (_, i) => ({
    label: new Date(now.getFullYear(), now.getMonth() + i, 1).toLocaleString('en-US', { month: 'short' }), inn: 0, out: 0,
  }));
  bills.forEach((b) => {
    if (b.state !== 'active' || !b.nextDue) return;
    const perPeriod = Math.max(0, num(b.amount) - num(b.discount));
    let d = b.nextDue;
    let first = true;
    for (let g = 0; g < 400; g++) {
      const p = d.split('-').map(Number);
      let idx = p[0] * 12 + (p[1] - 1) - base;
      if (idx >= n) break;
      if (idx < 0) idx = first ? 0 : -1;
      const amt = first ? periodInfo(b).balance : perPeriod;
      first = false;
      if (idx >= 0) { if (b.dir === 'in') out[idx].inn += amt; else out[idx].out += amt; }
      if (b.cycle === 'onetime') break;
      d = addCycle(d, b.cycle);
    }
  });
  return out;
}
