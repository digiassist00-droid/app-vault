// Pagpapalit ng team passphrase: dine-decrypt ang lahat gamit ang lumang key at ine-encrypt ulit gamit ang bago.
// Walang Firebase dito, kaya masusubukan ito sa tests. Ang pagsulat sa database ay nasa data.js (commitRotation).
import { encStr, decStr, encBytes, decBytes } from './vcrypto.js';

// Mga field na naka-encrypt: [collection, field]
export const SECRET_FIELDS = [['logins', 'pass'], ['services', 'secret'], ['envs', 'content']];

export async function buildRotation(oldKey, newKey, data, fetchFileData) {
  const ops = [];
  for (const [coll, field] of SECRET_FIELDS) {
    for (const item of data[coll]) {
      if (!item[field]) continue;
      const plain = await decStr(oldKey, item[field]);
      ops.push({ coll, id: item.id, patch: { [field]: await encStr(newKey, plain) } });
    }
  }
  for (const f of data.files) {
    const d = await fetchFileData(f.id);
    const enc = await encBytes(newKey, await decBytes(oldKey, d.iv, d.data));
    ops.push({ coll: 'fileData', id: f.id, patch: { iv: enc.iv, data: enc.data } });
  }
  return ops;
}
