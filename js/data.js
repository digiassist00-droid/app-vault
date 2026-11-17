// Firestore: realtime listeners at mga sulat. Lahat ng pagbabago ay lumalabas agad sa lahat ng device.
import {
  db, collection, doc, onSnapshot, addDoc, setDoc, updateDoc, deleteDoc, getDoc, writeBatch, serverTimestamp, query, orderBy, limit,
} from './firebase.js';
import { DB, ctx } from './state.js';

const MEMBER = ['apps', 'logins', 'services', 'envs', 'files', 'changelog', 'renewals'];
const ADMIN = ['clients', 'billing', 'users', 'invites'];
let unsubs = [];

export function stopListeners() {
  unsubs.forEach((u) => { try { u(); } catch (e) { /* ignore */ } });
  unsubs = [];
  MEMBER.concat(ADMIN).forEach((n) => { DB[n] = []; });
  DB.settings = null; DB.vault = null; DB.audit = [];
  ctx.pending = new Set();
}

export function startListeners(admin, onChange) {
  stopListeners();
  const colls = MEMBER.concat(admin ? ADMIN : []);
  ctx.pending = new Set(colls.concat(['_settings', '_vault']));
  const fail = (n) => (err) => { console.error('Listener error:', n, err); ctx.pending.delete(n); onChange(err); };
  if (admin) {
    ctx.pending.add('_audit');
    unsubs.push(onSnapshot(query(collection(db, 'audit'), orderBy('createdAt', 'desc'), limit(100)), (snap) => {
      DB.audit = snap.docs.map((d) => Object.assign({ id: d.id }, d.data()));
      ctx.pending.delete('_audit'); onChange();
    }, fail('_audit')));
  }
  colls.forEach((n) => {
    unsubs.push(onSnapshot(collection(db, n), (snap) => {
      DB[n] = snap.docs.map((d) => Object.assign({ id: d.id }, d.data()));
      ctx.pending.delete(n);
      onChange();
    }, fail(n)));
  });
  unsubs.push(onSnapshot(doc(db, 'settings', 'app'), (s) => { DB.settings = s.exists() ? s.data() : null; ctx.pending.delete('_settings'); onChange(); }, fail('_settings')));
  unsubs.push(onSnapshot(doc(db, 'meta', 'vault'), (s) => {
    DB.vault = s.exists() ? s.data() : null;
    // Kapag may nagpalit ng team passphrase (hindi ako), i-lock ang lumang key para hindi masira ang mga bagong save.
    if (ctx.key && !ctx.rotating && DB.vault && ctx.keySalt && DB.vault.salt !== ctx.keySalt) { ctx.key = null; ctx.keySalt = null; ctx.relocked = true; }
    ctx.pending.delete('_vault'); onChange();
  }, fail('_vault')));
}

// Tinatanggal ang undefined (hindi ito tinatanggap ng Firestore). Hindi ginagalaw ang serverTimestamp at iba pang special value.
export function clean(v) {
  if (Array.isArray(v)) return v.map(clean);
  if (v && Object.getPrototypeOf(v) === Object.prototype) {
    const o = {};
    Object.keys(v).forEach((k) => { if (v[k] !== undefined) o[k] = clean(v[k]); });
    return o;
  }
  return v;
}

const who = () => ({ createdBy: ctx.user.uid, createdByName: (ctx.profile && ctx.profile.name) || '' });
export async function add(coll, data) {
  const ref = await addDoc(collection(db, coll), clean(Object.assign({}, data, who(), { createdAt: serverTimestamp() })));
  return ref.id;
}
export const upd = (coll, id, patch) => updateDoc(doc(db, coll, id), clean(Object.assign({}, patch, { updatedBy: ctx.user.uid, updatedAt: serverTimestamp() })));
export const del = (coll, id) => deleteDoc(doc(db, coll, id));
export const setUserRole = (id, role) => updateDoc(doc(db, 'users', id), { role });
export const setSetting = (patch) => setDoc(doc(db, 'settings', 'app'), clean(patch), { merge: true });
export const createVaultDoc = (meta) => setDoc(doc(db, 'meta', 'vault'), clean(Object.assign({}, meta, { createdBy: ctx.user.uid, createdAt: serverTimestamp() })));
export const inviteEmail = (email) => setDoc(doc(db, 'invites', email), { email, role: 'developer', createdBy: ctx.user.uid, createdAt: serverTimestamp() });

export async function putFile(meta, enc) {
  const ref = doc(collection(db, 'files'));
  const b = writeBatch(db);
  b.set(ref, clean(Object.assign({}, meta, who(), { createdAt: serverTimestamp() })));
  b.set(doc(db, 'fileData', ref.id), { iv: enc.iv, data: enc.data, createdBy: ctx.user.uid });
  await b.commit();
  return ref.id;
}
export async function getFileData(id) {
  const s = await getDoc(doc(db, 'fileData', id));
  if (!s.exists()) throw new Error('File data not found');
  return s.data();
}
export async function delFile(id) {
  const b = writeBatch(db);
  b.delete(doc(db, 'files', id));
  b.delete(doc(db, 'fileData', id));
  await b.commit();
}

async function runBatches(ops) {
  for (let i = 0; i < ops.length; i += 400) {
    const b = writeBatch(db);
    ops.slice(i, i + 400).forEach((f) => f(b));
    await b.commit();
  }
}
export async function delAppCascade(appId, admin) {
  const ops = [];
  ['logins', 'services', 'envs', 'changelog', 'renewals'].forEach((c) => DB[c].filter((x) => x.appId === appId).forEach((x) => ops.push((b) => b.delete(doc(db, c, x.id)))));
  DB.files.filter((x) => x.appId === appId).forEach((x) => { ops.push((b) => b.delete(doc(db, 'files', x.id))); ops.push((b) => b.delete(doc(db, 'fileData', x.id))); });
  if (admin) DB.billing.filter((x) => x.appId === appId).forEach((x) => ops.push((b) => b.delete(doc(db, 'billing', x.id))));
  ops.push((b) => b.delete(doc(db, 'apps', appId)));
  await runBatches(ops);
}
// Activity log. Hindi ito humaharang sa gumagamit kapag pumalya. Hindi kailanman nilalagay dito ang laman ng secret.
export function logEvent(action, detail) {
  try {
    if (!ctx.user) return;
    addDoc(collection(db, 'audit'), clean({
      action: String(action).slice(0, 40), detail: String(detail || '').slice(0, 160),
      createdBy: ctx.user.uid, createdByName: (ctx.profile && ctx.profile.name) || '', createdAt: serverTimestamp(),
    })).catch((e) => console.error('audit', e));
  } catch (e) { console.error('audit', e); }
}

// Idinadagdag lang ang kulang. Hindi nito binubura o pinapalitan ang nandoon na. Maaaring ulitin kung naputol (400 bawat batch).
export async function commitRestore(plan) {
  const ops = [];
  if (plan.vaultAction === 'create') {
    const v = plan.vault;
    ops.push((b) => b.set(doc(db, 'meta', 'vault'), clean({ salt: v.salt, iter: v.iter, verifier: v.verifier, createdBy: ctx.user.uid, createdAt: serverTimestamp() })));
  }
  plan.ops.forEach((o) => ops.push((b) => b.set(doc(db, o.coll, o.id), clean(Object.assign({}, o.data, o.ts ? { createdAt: serverTimestamp(), restoredAt: serverTimestamp() } : {})))));
  await runBatches(ops);
}

// Tinatanggal ang profile AT ang invite. Kapag invite lang ang naiwan, makakabalik ang tao sa pag-sign in.
export async function removeUserAccess(uid, email) {
  const b = writeBatch(db);
  b.delete(doc(db, 'users', uid));
  if (email) b.delete(doc(db, 'invites', String(email).toLowerCase()));
  await b.commit();
}

// Isang atomic na batch: lahat ng re-encrypted na data at ang bagong passphrase meta, sabay-sabay o wala.
export const MAX_ROTATE_WRITES = 499;
export async function commitRotation(ops, meta) {
  if (ops.length + 1 > MAX_ROTATE_WRITES + 1) throw new Error('Too many items to change at once (' + ops.length + ').');
  const b = writeBatch(db);
  ops.forEach((o) => b.update(doc(db, o.coll, o.id), o.patch));
  b.update(doc(db, 'meta', 'vault'), { salt: meta.salt, iter: meta.iter, verifier: meta.verifier, rotatedAt: serverTimestamp(), rotatedBy: ctx.user.uid });
  await b.commit();
}

export async function unlinkClient(clientId) {
  const ops = [];
  DB.apps.filter((a) => a.clientId === clientId).forEach((a) => ops.push((b) => b.update(doc(db, 'apps', a.id), { clientId: '' })));
  DB.billing.filter((x) => x.clientId === clientId).forEach((x) => ops.push((b) => b.update(doc(db, 'billing', x.id), { clientId: '' })));
  ops.push((b) => b.delete(doc(db, 'clients', clientId)));
  await runBatches(ops);
}
