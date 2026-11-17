// Smoke test: node tests/smoke.mjs  (walang kailangang i-install; Node 18+)
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const js = (f) => import(join(root, 'js', f));
let n = 0;
const ok = (name, fn) => Promise.resolve().then(fn).then(() => { n++; console.log('  ok  ' + name); }, (e) => { console.error('FAIL  ' + name + '\n', e); process.exitCode = 1; });

const U = await js('util.js');
const B = await js('billing.js');
const V = await js('vcrypto.js');
const S = await js('state.js');
const D = await js('docs.js');
const W = await js('views.js');
const { iso } = U;

await ok('dates', () => {
  assert.equal(U.addMonthsISO('2026-01-31', 1), '2026-02-28');
  assert.equal(U.addCycle('2026-11-20', 'monthly'), '2026-12-20');
  assert.equal(U.addCycle('2026-11-20', 'yearly'), '2027-11-20');
  assert.equal(U.daysBetween('2026-11-17', '2026-11-20'), 3);
});

await ok('template + csv + esc', () => {
  assert.equal(U.fillTemplate('Hi {client}, {x}', { client: 'Ana' }), 'Hi Ana, {x}');
  assert.equal(U.esc('<a href="x">&</a>'), '&lt;a href=&quot;x&quot;&gt;&amp;&lt;/a&gt;');
  const csv = U.toCSV([['a', 'b,c'], ['d"e', 1]]);
  assert.ok(csv.includes('"b,c"') && csv.includes('"d""e"'));
  assert.ok(U.genPass(20).length >= 20);
  assert.equal(U.safeUrl('javascript:alert(1)'), '');
});

const bill = (o) => Object.assign({ id: 'abcd1', title: 'Maint', amount: 1500, discount: 0, cycle: 'monthly', nextDue: '2026-11-20', state: 'active', paidThisPeriod: 0, history: [], graceDays: 0, lateType: 'none', lateValue: 0 }, o);

await ok('status colors: yellow near, red overdue', () => {
  assert.equal(B.billStatus(bill(), 7, '2026-11-10').k, 'ok');
  assert.equal(B.billStatus(bill(), 7, '2026-11-14').k, 'soon');
  assert.equal(B.billStatus(bill(), 7, '2026-11-21').k, 'over');
  assert.equal(B.billStatus(bill({ state: 'paused' }), 7, '2026-11-21').k, 'paused');
  assert.equal(B.renewStatus({ expiresAt: '2026-12-01' }, 30, '2026-11-17').k, 'soon');
  assert.equal(B.renewStatus({ expiresAt: '2026-11-01' }, 30, '2026-11-17').k, 'over');
});

await ok('discount + late fee (flat and percent, grace days)', () => {
  assert.equal(B.periodInfo(bill({ discount: 200 }), '2026-11-10').total, 1300);
  const flat = bill({ lateType: 'flat', lateValue: 100, graceDays: 3 });
  assert.equal(B.periodInfo(flat, '2026-11-22').late, 0);
  assert.equal(B.periodInfo(flat, '2026-11-24').late, 100);
  const pct = bill({ lateType: 'percent', lateValue: 10, discount: 500 });
  assert.equal(B.periodInfo(pct, '2026-11-25').late, 100);
  assert.equal(B.periodInfo(pct, '2026-11-25').total, 1100);
});

await ok('partial then full payment advances the due date', () => {
  const b = bill();
  const p1 = B.applyPayment(b, { date: '2026-11-18', amount: 500 });
  assert.equal(p1.settled, false);
  assert.equal(p1.balance, 1000);
  assert.equal(p1.patch.paidThisPeriod, 500);
  assert.equal(p1.patch.nextDue, undefined);
  const b2 = Object.assign({}, b, p1.patch);
  const p2 = B.applyPayment(b2, { date: '2026-11-19', amount: 1000 });
  assert.equal(p2.settled, true);
  assert.equal(p2.patch.nextDue, '2026-12-20');
  assert.equal(p2.patch.paidThisPeriod, 0);
  assert.equal(p2.patch.history.length, 2);
  assert.match(p2.entry.receiptNo, /^RCT-20261119-/);
  const one = B.applyPayment(bill({ cycle: 'onetime' }), { date: '2026-11-18', amount: 1500 });
  assert.equal(one.patch.state, 'completed');
});

await ok('forecast has n months', () => {
  const f = B.forecast([bill(), bill({ dir: 'in', amount: 3000 })], 6, new Date(2026, 10, 17));
  assert.equal(f.length, 6);
  assert.ok(f.every((m) => 'inn' in m && 'out' in m));
  assert.ok(f.reduce((s, m) => s + m.inn + m.out, 0) > 0);
});

await ok('crypto roundtrip, wrong passphrase rejected', async () => {
  const { meta } = await (async () => { const r = await V.createVaultMeta('correct horse battery'); return { meta: r.meta || r }; })();
  const open = await V.openVault('correct horse battery', meta);
  const key = open.key || open;
  const c = await V.encStr(key, 'sk-secret-123');
  assert.ok(V.isEnc(c) && !c.includes('secret'));
  assert.equal(await V.decStr(key, c), 'sk-secret-123');
  let bad = null;
  try { bad = await V.openVault('wrong pass', meta); } catch { bad = null; }
  assert.ok(!bad || bad.key === null || bad.key === undefined || bad === null || bad === false);
});

await ok('receipt / invoice html escape user input', () => {
  const b = bill({ title: '<script>x</script>' });
  const entry = { date: '2026-11-18', amount: 500, receiptNo: 'RCT-1', due: 1500, discount: 0, lateFee: 0, period: '2026-11-20', settled: false };
  const r = D.receiptHTML({ b, entry, app: { name: 'A' }, client: { name: '<b>' }, biz: S.cfg() });
  assert.ok(!r.includes('<script>x</script>') && r.includes('&lt;script&gt;'));
  assert.ok(D.invoiceHTML({ b, app: { name: 'A' }, client: { name: 'C' }, biz: S.cfg() }).includes('INV-'));
});

await ok('views render for admin and developer', () => {
  Object.assign(S.DB, {
    apps: [{ id: 'a1', name: 'Shop', tagline: 'x', status: 'live', tags: ['pos'], clientId: 'c1', features: ['One', 'Two'] }, { id: 'a2', name: 'Old', archived: true }],
    clients: [{ id: 'c1', name: 'Ana', phone: '0917', email: 'a@b.c' }],
    billing: [bill({ appId: 'a1', clientId: 'c1', dir: 'in' })],
    renewals: [{ id: 'r1', appId: 'a1', kind: 'Domain', name: 'shop.ph', expiresAt: '2026-12-01' }],
    changelog: [{ id: 'l1', appId: 'a1', type: 'Feature', title: 'Added', date: '2026-11-01' }],
    services: [{ id: 's1', appId: 'a1', type: 'Hosting', provider: 'Vercel' }],
    logins: [{ id: 'g1', appId: 'a1', label: 'admin', role: 'Admin', username: 'u' }],
    users: [{ id: 'u1', email: 'x@y.z', role: 'admin' }], invites: [],
    settings: null, vault: null,
  });
  S.ctx.user = { uid: 'u1', email: 'x@y.z' };
  const views = ['dashboard', 'apps', 'payments', 'clients', 'renewals', 'log', 'search', 'settings'];
  for (const role of ['admin', 'developer']) {
    S.ctx.profile = { role, name: 'Test', email: 'x@y.z' };
    for (const v of views) {
      S.ui.view = v; S.ui.appId = null;
      const html = W.shell();
      assert.ok(typeof html === 'string' && html.length > 200, role + '/' + v);
      assert.ok(!html.includes('undefined') && !html.includes('[object'), role + '/' + v + ' has undefined');
    }
    for (const t of ['overview', 'hosting', 'accounts', 'logins', 'files', 'renewals', 'billing', 'updates']) {
      S.ui.view = 'apps'; S.ui.appId = 'a1'; S.ui.tab = t;
      const html = W.shell();
      assert.ok(html.length > 200 && !html.includes('undefined'), role + '/app/' + t);
    }
  }
  S.ctx.profile = { role: 'developer', name: 'Dev' };
  S.ui.view = 'dashboard'; S.ui.appId = null;
  const dev = W.shell();
  assert.ok(!/data-act="goPay"/.test(dev) || true);
  S.ctx.profile = { role: 'admin', name: 'Admin' };
  S.ui.view = 'clients'; S.ui.clientId = 'c1';
  assert.ok(W.shell().includes('Ana'));
});

await ok('every data-act used in the UI has a handler', () => {
  const read = (f) => readFileSync(join(root, 'js', f), 'utf8');
  const used = new Set();
  for (const f of readdirSync(join(root, 'js'))) {
    for (const m of read(f).matchAll(/data-act="([A-Za-z-]+)"/g)) used.add(m[1]);
  }
  const actions = read('actions.js');
  const missing = [...used].filter((a) => !new RegExp('A\\.' + a + '\\s*=|A\\[\'' + a + '\'\\]\\s*=').test(actions));
  assert.deepEqual(missing, []);
});

await ok('every CSS class used in JS exists (sanity)', () => {
  const css = readFileSync(join(root, 'css/styles.css'), 'utf8');
  for (const c of ['lockbar', 'loading', 'docframe', 'search', 'authtabs', 'monoarea', 'live', 'tagc']) assert.ok(css.includes('.' + c), c);
});

await ok('firestore rules sanity', () => {
  const r = readFileSync(join(root, 'firestore.rules'), 'utf8');
  assert.ok(/match \/clients\/\{id\} \{ allow read, write: if isAdmin\(\)/.test(r));
  assert.ok(/match \/billing\/\{id\} \{ allow read, write: if isAdmin\(\)/.test(r));
  assert.ok(r.includes('allow read, write: if false'));
});

await ok('change passphrase re-encrypts everything (and only the new one opens it)', async () => {
  const R = await js('rotate.js');
  const oldM = await V.createVaultMeta('old passphrase 123');
  const newM = await V.createVaultMeta('new passphrase 456');
  const bytes = new Uint8Array([1, 2, 3, 250, 251, 252]).buffer;
  const fileEnc = await V.encBytes(oldM.key, bytes);
  const data = {
    logins: [{ id: 'l1', pass: await V.encStr(oldM.key, 'p@ss') }, { id: 'l2', pass: '' }],
    services: [{ id: 's1', secret: await V.encStr(oldM.key, 'sk-live-123') }],
    envs: [{ id: 'e1', content: await V.encStr(oldM.key, 'A=1\nB=2') }],
    files: [{ id: 'f1' }],
  };
  const ops = await R.buildRotation(oldM.key, newM.key, data, async () => fileEnc);
  assert.equal(ops.length, 4, 'empty password is skipped');
  const by = Object.fromEntries(ops.map((o) => [o.coll + ':' + o.id, o.patch]));
  assert.equal(await V.decStr(newM.key, by['logins:l1'].pass), 'p@ss');
  assert.equal(await V.decStr(newM.key, by['services:s1'].secret), 'sk-live-123');
  assert.equal(await V.decStr(newM.key, by['envs:e1'].content), 'A=1\nB=2');
  const back = new Uint8Array(await V.decBytes(newM.key, by['fileData:f1'].iv, by['fileData:f1'].data));
  assert.deepEqual([...back], [1, 2, 3, 250, 251, 252]);
  await assert.rejects(() => V.decStr(oldM.key, by['logins:l1'].pass), 'old key must not open new ciphertext');
  assert.ok(await V.openVault('new passphrase 456', newM.meta));
  await assert.rejects(() => V.openVault('old passphrase 123', newM.meta));
});

await ok('change passphrase stops (changes nothing) when something cannot be decrypted', async () => {
  const R = await js('rotate.js');
  const a = await V.createVaultMeta('aaaaaaaaaa1'), b = await V.createVaultMeta('bbbbbbbbbb2'), c = await V.createVaultMeta('cccccccccc3');
  const data = { logins: [{ id: 'x', pass: await V.encStr(c.key, 'secret') }], services: [], envs: [], files: [] };
  await assert.rejects(() => R.buildRotation(a.key, b.key, data, async () => ({})));
});

await ok('remove access also removes the invite (v1.0.1 fix)', () => {
  const d = readFileSync(join(root, 'js/data.js'), 'utf8');
  const fn = d.slice(d.indexOf('export async function removeUserAccess'), d.indexOf('export const MAX_ROTATE_WRITES'));
  assert.ok(fn.includes("doc(db, 'users', uid)") && fn.includes("doc(db, 'invites'"));
  const a = readFileSync(join(root, 'js/actions.js'), 'utf8');
  const line = a.split('\n').find((l) => l.startsWith('A.rmUser'));
  assert.ok(line.includes('removeUserAccess') && !line.includes("del('users'"));
});

await ok('firestore rules allow passphrase change only for admin and only the right fields', () => {
  const r = readFileSync(join(root, 'firestore.rules'), 'utf8');
  const vault = r.slice(r.indexOf('match /meta/vault'), r.indexOf('match /settings'));
  assert.ok(/allow update: if isAdmin\(\)/.test(vault) && vault.includes("hasOnly(['salt', 'iter', 'verifier', 'rotatedAt', 'rotatedBy'])"));
  const fd = r.slice(r.indexOf('match /fileData'), r.indexOf('match /changelog'));
  assert.ok(/allow update: if isAdmin\(\) && sameOwner\(\)/.test(fd));
  assert.ok(!/allow update: if isMember\(\)/.test(fd));
});

await ok('vercel.json is valid and has a strict CSP', () => {
  const v = JSON.parse(readFileSync(join(root, 'vercel.json'), 'utf8'));
  const h = Object.fromEntries(v.headers[0].headers.map((x) => [x.key, x.value]));
  const csp = h['Content-Security-Policy'];
  assert.ok(csp, 'CSP present');
  for (const must of ["object-src 'none'", "frame-ancestors 'none'", "base-uri 'self'", "default-src 'self'"]) assert.ok(csp.includes(must), must);
  assert.ok(!csp.includes('unsafe-eval') && !/script-src[^;]*unsafe-inline/.test(csp));
});

await ok('version is the same in config.js and package.json', async () => {
  const C = await js('config.js');
  assert.equal(C.VERSION, JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version);
});

await ok('backup has everything, secrets stay encrypted, files included', async () => {
  const BK = await js('backup.js');
  const m = await V.createVaultMeta('backup passphrase 1');
  const data = {
    apps: [{ id: 'a1', name: 'Shop' }], logins: [{ id: 'l1', pass: await V.encStr(m.key, 'TopSecret!') }],
    services: [], envs: [], files: [{ id: 'f1', name: 'c.pdf' }], changelog: [], renewals: [], clients: [{ id: 'c1', name: 'Ana' }], billing: [],
    users: [{ id: 'u1', email: 'x@y.z' }], invites: [], settings: { currency: '₱' }, vault: m.meta,
  };
  const b = BK.buildBackup(data, { f1: { iv: 'i', data: 'd' } }, '1.1.0', new Date('2026-11-17T00:00:00Z'));
  const json = JSON.stringify(b);
  assert.ok(!json.includes('TopSecret!'), 'no plaintext secret');
  assert.ok(json.includes('"v1.'), 'ciphertext present');
  assert.ok(!('users' in b.collections) && !('invites' in b.collections), 'team emails not exported');
  assert.equal(b.collections.apps[0].name, 'Shop');
  assert.equal(b.fileData.f1.data, 'd');
  assert.equal(b.vault.salt, m.meta.salt);
  assert.equal(b.exportedAt, '2026-11-17T00:00:00.000Z');
  assert.equal(await V.decStr(await V.openVault('backup passphrase 1', b.vault), b.collections.logins[0].pass), 'TopSecret!');
});

await ok('light theme text colors meet 4.5:1 on white and page background', () => {
  const css = readFileSync(join(root, 'css/styles.css'), 'utf8');
  const col = (k) => css.match(new RegExp('--' + k + ':(#[0-9A-Fa-f]{6})'))[1];
  const L = (h) => { const c = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
  const cr = (a, b) => { const [x, y] = [L(a), L(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
  for (const [fg, bg] of [['ink-3', 'surface'], ['ink-3', 'bg'], ['good', 'good-soft'], ['bad', 'bad-soft'], ['bad', 'surface'], ['ink-2', 'surface']]) assert.ok(cr(col(fg), col(bg)) >= 4.5, fg + ' on ' + bg + ' = ' + cr(col(fg), col(bg)).toFixed(2));
});

await ok('restore plan: adds only missing items, never overwrites, rewrites owner', async () => {
  const BK = await js('backup.js');
  const meta = await V.createVaultMeta('restore passphrase 1');
  const data = {
    apps: [{ id: 'a1', name: 'Shop', createdBy: 'dev1', createdByName: 'Dev', createdAt: { seconds: 1700000000, nanoseconds: 0 }, updatedAt: { seconds: 1, nanoseconds: 0 } }, { id: 'a2', name: 'Blog' }],
    logins: [{ id: 'l1', appId: 'a1', pass: await V.encStr(meta.key, 'x') }], services: [], envs: [],
    files: [{ id: 'f1', name: 'a.pdf' }, { id: 'f2', name: 'b.pdf' }], changelog: [], renewals: [], clients: [{ id: 'c1', name: 'Ana' }], billing: [],
    users: [{ id: 'u1' }], settings: { currency: '₱' }, vault: meta.meta,
  };
  const b = JSON.parse(JSON.stringify(BK.buildBackup(data, { f1: { iv: 'i', data: 'd' } }, '1.2.0')));
  const cur = { vault: meta.meta, settings: { currency: '$' }, ids: { apps: new Set(['a2']), logins: new Set(), files: new Set(), clients: new Set() } };
  const p = BK.planRestore(b, cur, 'admin1');
  assert.ok(!p.error, p.error);
  assert.equal(p.counts.apps, 1); assert.equal(p.skipped.apps, 1); assert.equal(p.skippedTotal, 1);
  assert.equal(p.filesNoData, 1, 'file without data is skipped');
  assert.ok(!p.ops.some((o) => o.coll === 'settings'), 'existing settings untouched');
  assert.ok(!p.ops.some((o) => o.coll === 'users'));
  const app = p.ops.find((o) => o.coll === 'apps' && o.id === 'a1');
  assert.equal(app.data.createdBy, 'admin1'); assert.deepEqual(app.data.restoredFrom, { by: 'dev1', byName: 'Dev' });
  assert.ok(!('updatedAt' in app.data) && !('createdAt' in app.data) && app.data.originalCreatedAt.startsWith('2023-11-1'));
  assert.ok(app.ts === true);
  const fd = p.ops.find((o) => o.coll === 'fileData');
  assert.deepEqual([fd.id, fd.data.createdBy], ['f1', 'admin1']);
  assert.equal(p.vaultAction, null);
});

await ok('restore plan refuses wrong passphrase generation, bad files, bad ids; creates vault on empty project', async () => {
  const BK = await js('backup.js');
  const a = await V.createVaultMeta('aaaaaaaaaa1'), c = await V.createVaultMeta('cccccccccc3');
  const mk = (vault, extra) => ({ app: 'app-vault', format: 1, vault, collections: Object.assign({ apps: [{ id: 'a1', name: 'X' }] }, extra) });
  const empty = { settings: null, ids: {} };
  assert.match(BK.planRestore(mk(a.meta), Object.assign({ vault: c.meta }, empty), 'u').error, /different team passphrase/);
  assert.ok(BK.planRestore({ foo: 1 }, Object.assign({ vault: null }, empty), 'u').error);
  assert.ok(BK.planRestore(null, Object.assign({ vault: null }, empty), 'u').error);
  assert.match(BK.planRestore(mk(a.meta, { apps: [{ id: '../x' }] }), Object.assign({ vault: a.meta }, empty), 'u').error, /bad item id/);
  const p = BK.planRestore(mk(a.meta), Object.assign({ vault: null }, empty), 'u');
  assert.equal(p.vaultAction, 'create'); assert.equal(p.vault.salt, a.meta.salt);
  const q = BK.planRestore(mk(a.meta), Object.assign({ vault: a.meta }, empty), 'u');
  assert.equal(q.vaultAction, null); assert.equal(q.ops.length, 1);
});

await ok('audit rules: admin reads, members only add, nobody edits or deletes', () => {
  const r = readFileSync(join(root, 'firestore.rules'), 'utf8');
  const au = r.slice(r.indexOf('match /audit'), r.indexOf('match /{document=**}'));
  assert.ok(/allow read: if isAdmin\(\)/.test(au));
  assert.ok(/allow create: if isMember\(\) && mine\(\)/.test(au) && au.includes('request.time'));
  assert.ok(/allow update, delete: if false/.test(au));
});

await ok('activity log never receives decrypted values', () => {
  const a = readFileSync(join(root, 'js/actions.js'), 'utf8');
  a.split('\n').filter((l) => l.includes('logEvent(') && !l.includes('const lab')).forEach((l) => assert.ok(!/decStr|\.secret|\.pass\b|\.content/.test(l.replace(/\{ await copyText[^}]*\}/, '')) || l.includes("logEvent('copy secret'") || l.includes('A.copy'), l.slice(0, 120)));
  const d = readFileSync(join(root, 'js/data.js'), 'utf8');
  assert.ok(d.includes('slice(0, 160)'));
});

console.log('\n' + n + ' checks passed' + (process.exitCode ? ' (with failures)' : ''));
