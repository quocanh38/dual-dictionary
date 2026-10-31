// IndexedDB persistence for dictionary blobs (store `files`), saved learning
// items (store `items`, Phase 3 Release A — see docs/phase3-spec.md) and the
// review log (store `reviews`, Phase 6 R3 — every grade appends one record so
// the FSRS optimizer can be personal-history-trained later; the log is never
// backfillable, which is why it ships with the scheduler itself) and the
// known-words baseline (store `known`, v117 A2 — one record per level, the
// lemma list the user declares they already know; kept OUT of `items` so the
// Vault UI, stats and practice decks stay untouched by a 1k–10k baseline).
// openDb() is the single owner of the schema: all stores (and the items
// indexes) are created inside ONE versioned upgrade, so no two connections
// can race each other on different versions.
const DB_NAME = 'mdx-dict';
const DB_VERSION = 6;

export function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('files')) db.createObjectStore('files');
      if (!db.objectStoreNames.contains('items')) {
        const items = db.createObjectStore('items', { keyPath: 'id' });
        items.createIndex('normalizedText', 'normalizedText');
        items.createIndex('type', 'type');
        items.createIndex('status', 'userData.status');
        items.createIndex('tags', 'userData.tags', { multiEntry: true });
        items.createIndex('due', 'due');
        items.createIndex('createdAt', 'createdAt');
      }
      // v3: append-only review log (one record per grade). The upgrade only
      // ADDS an empty store — no existing record is touched.
      if (!db.objectStoreNames.contains('reviews')) {
        const reviews = db.createObjectStore('reviews', { keyPath: 'id' });
        reviews.createIndex('itemId', 'itemId');
        reviews.createIndex('at', 'at');
      }
      // v4 (v117 A2): known-words baseline — one record per level, value is
      // {level, words:[...lemma], updatedAt}. Append-only store ADD, no
      // existing record is touched.
      if (!db.objectStoreNames.contains('known')) db.createObjectStore('known');
      if (!db.objectStoreNames.contains('tutor')) db.createObjectStore('tutor', { keyPath: 'id' });
      // v6: offline IELTS/TOEIC exercises, editable drafts, saved listening
      // documents and recordings. Records stay local and can be exported.
      if (!db.objectStoreNames.contains('study')) db.createObjectStore('study', { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function putStudyRecord(record) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('study', 'readwrite');
    tx.objectStore('study').put(record);
    tx.oncomplete = () => resolve(record);
    tx.onerror = () => reject(tx.error);
  });
}

export async function getStudyRecord(id) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const req = db.transaction('study', 'readonly').objectStore('study').get(id);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

export async function allStudyRecords() {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const req = db.transaction('study', 'readonly').objectStore('study').getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

export async function deleteStudyRecord(id) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('study', 'readwrite');
    tx.objectStore('study').delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function putTutorRecord(record) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('tutor', 'readwrite');
    tx.objectStore('tutor').put(record);
    tx.oncomplete = () => resolve(record);
    tx.onerror = () => reject(tx.error);
  });
}

export async function allTutorRecords() {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const req = db.transaction('tutor', 'readonly').objectStore('tutor').getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

export async function deleteTutorRecord(id) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('tutor', 'readwrite');
    tx.objectStore('tutor').delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function clearTutorRecords() {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('tutor', 'readwrite');
    tx.objectStore('tutor').clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getTutorRecord(id) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const req = db.transaction('tutor', 'readonly').objectStore('tutor').get(id);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

/** Append one review-log record (Phase 6 R3). Never throws to the caller's
 *  grading path on its own — failures propagate like putItem's do. */
export async function putReview(rec) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('reviews', 'readwrite');
    tx.objectStore('reviews').put(rec);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function reviewsOfItem(itemId) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('reviews', 'readonly');
    const req = tx.objectStore('reviews').index('itemId').getAll(itemId);
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

/** Full review log (v71 — the on-device FSRS optimizer + the Advanced status
 *  line). Read-only getAll; the log is append-only, so this stays cheap at the
 *  sizes a personal history actually reaches. */
export async function allReviews() {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('reviews', 'readonly');
    const req = tx.objectStore('reviews').getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

/** v117 A2 — known-words baseline, keyed by level ('top1k'|'top2k'|'top5k'|
 *  'top10k'). Value: {level, words:[...lemma], updatedAt}. getKnownRecord
 *  resolves null when the level was never set (missing key, old profile). */
export async function getKnownRecord(level) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('known', 'readonly');
    const req = tx.objectStore('known').get(level);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

export async function putKnownRecord(rec) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('known', 'readwrite');
    tx.objectStore('known').put(rec, rec.level);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** All known-set records (Advanced count line, export). Read-only getAll. */
export async function allKnownRecords() {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('known', 'readonly');
    const req = tx.objectStore('known').getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

/** v117 A2 — wipe the whole known-set (Advanced reset). One clear() on the
 *  store; a level switch up-levels via put (delta), this is the full reset. */
export async function clearKnown() {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('known', 'readwrite');
    tx.objectStore('known').clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function putFile(key, blob) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('files', 'readwrite');
    tx.objectStore('files').put(blob, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getFile(key) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('files', 'readonly');
    const req = tx.objectStore('files').get(key);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

export async function delFile(key) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('files', 'readwrite');
    tx.objectStore('files').delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
