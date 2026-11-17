// Resibo at invoice. Pure na HTML, para madaling i-print o i-save bilang PDF.
import { esc, fmtD, money } from './util.js';
import { periodInfo, invoiceNo, CYC_SUF } from './billing.js';

const CSS = `
*{box-sizing:border-box}body{font:14px/1.5 system-ui,-apple-system,'Segoe UI',sans-serif;color:#111;margin:0;padding:32px}
.doc{max-width:720px;margin:0 auto}
h1{font-size:26px;margin:0 0 4px;letter-spacing:-.01em}
.top{display:flex;justify-content:space-between;gap:24px;flex-wrap:wrap;border-bottom:2px solid #111;padding-bottom:16px;margin-bottom:20px}
.muted{color:#555}.small{font-size:12px}
.meta{text-align:right}
table{width:100%;border-collapse:collapse;margin:18px 0}
th{text-align:left;font-size:11px;letter-spacing:.07em;text-transform:uppercase;color:#555;border-bottom:1px solid #bbb;padding:8px 6px}
td{padding:9px 6px;border-bottom:1px solid #e3e3e3}
td.r,th.r{text-align:right;font-variant-numeric:tabular-nums}
.total td{font-weight:700;font-size:16px;border-bottom:0;border-top:2px solid #111}
.box{border:1px solid #ccc;border-radius:8px;padding:12px 14px;margin-top:14px;white-space:pre-wrap}
.stamp{display:inline-block;border:2px solid #0a7;color:#0a7;font-weight:800;letter-spacing:.1em;padding:2px 12px;border-radius:6px;transform:rotate(-4deg);margin-top:6px}
.stamp.part{border-color:#c80;color:#c80}
@page{margin:14mm}`;

const wrap = (title, body) => `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>${CSS}</style></head><body><div class="doc">${body}</div></body></html>`;

function party(biz, client) {
  return `<div class="top"><div><h1>${esc(biz.businessName || 'Your business')}</h1><div class="muted small" style="white-space:pre-wrap">${esc(biz.businessContact || '')}</div></div>`;
}

export function receiptHTML({ b, entry, client, app, biz }) {
  const partial = !entry.settled;
  return wrap('Payment receipt ' + entry.receiptNo, `${party(biz)}<div class="meta"><div class="small muted">PAYMENT RECEIPT</div><b>${esc(entry.receiptNo)}</b><div class="small muted">${fmtD(entry.date)}</div></div></div>
<p class="small muted">Received from</p><p><b>${esc((client && client.name) || b.party || '—')}</b>${client && client.company ? '<br>' + esc(client.company) : ''}${client && client.email ? '<br>' + esc(client.email) : ''}</p>
<table><thead><tr><th>Description</th><th class="r">Amount</th></tr></thead><tbody>
<tr><td>${esc(b.title)}${b.plan ? ' · ' + esc(b.plan) : ''}<br><span class="small muted">${app ? esc(app.name) + ' · ' : ''}Period due ${fmtD(entry.period)}</span></td><td class="r">${money(entry.due + entry.discount - entry.lateFee)}</td></tr>
${entry.discount ? `<tr><td>Discount</td><td class="r">−${money(entry.discount)}</td></tr>` : ''}
${entry.lateFee ? `<tr><td>Late fee</td><td class="r">${money(entry.lateFee)}</td></tr>` : ''}
<tr><td>Amount due for this period</td><td class="r">${money(entry.due)}</td></tr>
<tr class="total"><td>Amount received${b.method ? ' (' + esc(b.method) + ')' : ''}</td><td class="r">${money(entry.amount)}</td></tr></tbody></table>
<div class="stamp ${partial ? 'part' : ''}">${partial ? 'PARTIAL PAYMENT' : 'PAID'}</div>
${entry.ref ? `<p class="small muted">Reference: ${esc(entry.ref)}</p>` : ''}${entry.note ? `<p class="small muted">${esc(entry.note)}</p>` : ''}
<p class="small muted" style="margin-top:28px">This is a payment acknowledgement. It is not an official BIR receipt.</p>`);
}

export function invoiceHTML({ b, client, app, biz }) {
  const info = periodInfo(b);
  return wrap('Invoice ' + invoiceNo(b), `${party(biz)}<div class="meta"><div class="small muted">INVOICE</div><b>${esc(invoiceNo(b))}</b><div class="small muted">Due ${fmtD(b.nextDue)}</div></div></div>
<p class="small muted">Bill to</p><p><b>${esc((client && client.name) || b.party || '—')}</b>${client && client.company ? '<br>' + esc(client.company) : ''}${client && client.email ? '<br>' + esc(client.email) : ''}${client && client.phone ? '<br>' + esc(client.phone) : ''}</p>
<table><thead><tr><th>Description</th><th class="r">Amount</th></tr></thead><tbody>
<tr><td>${esc(b.title)}${b.plan ? ' · ' + esc(b.plan) : ''}<br><span class="small muted">${app ? esc(app.name) : ''}${b.cycle !== 'onetime' ? ' · billed ' + esc((CYC_SUF[b.cycle] || '').replace('/', 'per ')) : ''}</span></td><td class="r">${money(info.base)}</td></tr>
${info.disc ? `<tr><td>Discount</td><td class="r">−${money(info.disc)}</td></tr>` : ''}
${info.late ? `<tr><td>Late fee</td><td class="r">${money(info.late)}</td></tr>` : ''}
${info.paid ? `<tr><td>Already paid</td><td class="r">−${money(info.paid)}</td></tr>` : ''}
<tr class="total"><td>Balance due</td><td class="r">${money(info.balance)}</td></tr></tbody></table>
${(b.inclusions || []).length ? `<div class="box"><b>Included</b>\n${b.inclusions.map((i) => '• ' + esc(i)).join('\n')}</div>` : ''}
${biz.payInfo ? `<div class="box"><b>How to pay</b>\n${esc(biz.payInfo)}</div>` : ''}`);
}

export function receiptText(entry, b) {
  return `PAYMENT RECEIPT ${entry.receiptNo}\n${fmtD(entry.date)}\n${b.title}\nAmount received: ${money(entry.amount)}${entry.settled ? ' (paid)' : ' (partial)'}${entry.ref ? '\nRef: ' + entry.ref : ''}`;
}
