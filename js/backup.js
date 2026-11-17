// Backup ng lahat ng data sa isang JSON file. Pure function, walang Firebase, kaya masusubukan.
// Ang password, key, .env at file ay naka-encrypt na sa DB, kaya ciphertext ang nasa backup (kailangan pa rin ng team passphrase).
// Ang ibang laman (pangalan ng app, client, bayarin, petsa) ay HINDI naka-encrypt, kaya ingatan ang file.
export const BACKUP_COLLECTIONS = ['apps', 'logins', 'services', 'envs', 'files', 'changelog', 'renewals', 'clients', 'billing'];

export function buildBackup(data, fileData, version, now) {
  const collections = {};
  BACKUP_COLLECTIONS.forEach((c) => { collections[c] = (data[c] || []).map((x) => Object.assign({}, x)); });
  return {
    app: 'app-vault',
    format: 1,
    version,
    exportedAt: (now || new Date()).toISOString(),
    vault: data.vault ? { salt: data.vault.salt, iter: data.vault.iter, verifier: data.vault.verifier } : null,
    settings: data.settings || null,
    collections,
    fileData: fileData || {},
  };
}

// Plano ng restore. Pure function. Idinadagdag lang ang mga item na wala pa (hindi nag-o-overwrite, hindi nagbubura).
// current = { vault, settings, ids: { apps: Set, ... } }
const ID_OK = /^[A-Za-z0-9_-]{1,100}$/;
const MAX_ITEMS = 5000;
export function planRestore(b, current, uid) {
  const fail = (error) => ({ error });
  if (!b || b.app !== 'app-vault' || b.format !== 1 || !b.collections || typeof b.collections !== 'object') return fail('This is not an App Vault backup file.');
  let vaultAction = null, vault = null;
  if (current.vault) {
    if (b.vault && b.vault.salt !== current.vault.salt) return fail('This backup was made with a different team passphrase (before a passphrase change, or from another project). Restoring it would make saved secrets unreadable. Nothing was changed.');
  } else if (b.vault && b.vault.salt && b.vault.iter && b.vault.verifier) { vaultAction = 'create'; vault = b.vault; }
  const ops = [], counts = {}, skipped = {};
  let skippedTotal = 0, filesNoData = 0;
  const base = (x) => {
    const d = Object.assign({}, x); delete d.id; delete d.updatedAt; delete d.updatedBy; delete d.createdAt;
    Object.keys(d).forEach((k) => { if (k.startsWith('__')) delete d[k]; });
    if (x.createdAt && typeof x.createdAt.seconds === 'number') d.originalCreatedAt = new Date(x.createdAt.seconds * 1000).toISOString();
    d.restoredFrom = { by: x.createdBy || '', byName: x.createdByName || '' };
    d.createdBy = uid;
    return d;
  };
  for (const c of BACKUP_COLLECTIONS) {
    const list = b.collections[c];
    if (list === undefined) continue;
    if (!Array.isArray(list)) return fail('The backup file is damaged (' + c + ').');
    for (const x of list) {
      if (!x || !ID_OK.test(String(x.id || ''))) return fail('The backup file is damaged (bad item id in ' + c + ').');
      if (current.ids[c] && current.ids[c].has(x.id)) { skipped[c] = (skipped[c] || 0) + 1; skippedTotal++; continue; }
      if (c === 'files') {
        const fd = b.fileData && b.fileData[x.id];
        if (!fd || typeof fd.iv !== 'string' || typeof fd.data !== 'string') { filesNoData++; continue; }
        ops.push({ coll: 'fileData', id: x.id, data: { iv: fd.iv, data: fd.data, createdBy: uid } });
      }
      ops.push({ coll: c, id: x.id, data: base(x), ts: true });
      counts[c] = (counts[c] || 0) + 1;
    }
  }
  if (!current.settings && b.settings && typeof b.settings === 'object') ops.push({ coll: 'settings', id: 'app', data: b.settings });
  if (ops.length > MAX_ITEMS) return fail('Too many items in one file (' + ops.length + ').');
  return { ops, counts, skipped, skippedTotal, filesNoData, vaultAction, vault };
}
