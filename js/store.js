/* store.js — Phase 3 Release A: LearningItem persistence (IndexedDB v2).
 * Spec: docs/phase3-spec.md. One record type (word | phrase | sentence) for
 * everything the user saves. localStorage stays untouched as the rollback
 * copy; this module is the single writer/reader of the `items` store. */
import { openDb, putFile, allKnownRecords as dbAllKnownRecords, clearKnown as dbClearKnown, putKnownRecord } from './db.js';

export const SRS_INTERVALS_DAYS = [1, 2, 4, 9, 20, 45]; // Leitner box → days until next review (kept: new-item defaults + the box field that Stats/export still read)
export const STATUS_VALUES = ['new', 'learning', 'known'];
export const TYPE_VALUES = ['word', 'phrase', 'sentence'];
export const MIGRATION_SOURCE_TAG = 'migration-v3';
export const MIGRATION_DUE_FIX_TAG = 'migrated-v3-due-fixed';

/* ---------------- FSRS-4.5 scheduler (Phase 6 R3) ----------------
 * Default weights from the open-spaced-repetition project (py-fsrs v4). The
 * scheduler runs with DEFAULT weights for now — the review log (db.js `reviews`
 * store) accumulates from day one so an optimizer pass can personalize them
 * later; history is not backfillable, which is why the log ships now.
 * Ratings: 1 Again / 2 Hard / 3 Good / 4 Easy. The app's two buttons map
 * forgot→1, know→3. */
export const FSRS_W = [0.4872, 1.4003, 3.7145, 13.8206, 5.1618, 1.2298, 0.8975,
  0.031, 1.6474, 0.1367, 1.0461, 2.1072, 0.0793, 0.3246, 1.587, 0.2272, 2.8755];
const FSRS_DECAY = -0.5;
const FSRS_FACTOR = 19 / 81;
const fsrsClamp = (x, lo, hi) => Math.min(Math.max(x, lo), hi);

export function fsrsInitStability(rating) { return Math.max(FSRS_W[rating - 1] || 3.7, 0.1); }
export function fsrsInitDifficulty(rating) { return fsrsClamp(FSRS_W[4] - Math.exp(FSRS_W[5] * (rating - 1)) + 1, 1, 10); }
export function fsrsNextDifficulty(d, rating) {
  const linear = d - FSRS_W[6] * (rating - 3);
  const mean = fsrsInitDifficulty(3); // pull back toward the "Good" baseline
  return fsrsClamp(FSRS_W[7] * linear + (1 - FSRS_W[7]) * mean, 1, 10);
}
/** Power-law forgetting curve: retrievability after `elapsedDays` with stability `s`. */
export function fsrsRetrievability(s, elapsedDays) {
  return fsrsClamp(Math.pow(1 + FSRS_FACTOR * Math.max(elapsedDays, 0) / s, FSRS_DECAY), 0.005, 0.995);
}
export function fsrsRecallStability(d, s, r) {
  const inc = 1 + Math.exp(FSRS_W[8]) * (11 - d) * Math.pow(s, -FSRS_W[9]) * (Math.exp((1 - r) * FSRS_W[10]) - 1);
  return fsrsClamp(s * inc, 0.1, 3650);
}
export function fsrsForgetStability(d, s, r) {
  const sf = FSRS_W[11] * Math.pow(d, -FSRS_W[12]) * (Math.pow(s + 1, FSRS_W[13]) - 1) * Math.exp((1 - r) * FSRS_W[14]);
  return fsrsClamp(Math.min(sf, s), 0.1, 3650);
}
/** Same-day re-review growth (the app has no sub-day learning steps, so this
 *  covers a quick know-after-forgot within the 10-minute drill window). */
export function fsrsShortTermStability(s, rating) {
  return fsrsClamp(s * Math.exp(FSRS_W[15] * (rating - 3 + FSRS_W[16] * 0.5)), 0.1, 3650);
}

/* v71 personal-weight hook: the on-device optimizer (⚙ Advanced → js/fsrs-opt.js)
 * fits the 17 weights to the owner's own review log and persists them in the
 * `files` store under 'fsrs-custom-weights'; boot() applies them here. FSRS_W is
 * mutated ELEMENT-WISE on purpose — it is exported, so in-place mutation is the
 * only way already-importing callers see the update. Validation is strict: a
 * garbage blob must fall back to defaults, never half-apply. */
const FSRS_W_DEFAULTS = FSRS_W.slice();

export function applyFsrsWeights(w) {
  if (!Array.isArray(w) || w.length !== 17 ||
      !w.every((x) => Number.isFinite(x) && x >= 0.001 && x <= 3650)) return false;
  for (let i = 0; i < 17; i++) FSRS_W[i] = w[i];
  return true;
}

export function resetFsrsWeights() {
  for (let i = 0; i < 17; i++) FSRS_W[i] = FSRS_W_DEFAULTS[i];
}

/** First FSRS contact for an item scheduled by the old Leitner boxes: a card
 *  that survived `box` steps has demonstrated roughly that box's interval, so
 *  it becomes the starting stability. Difficulty starts at the "Good"
 *  baseline; `due` is left untouched — migration must never reset a schedule. */
export function warmInitFsrs(item) {
  const box = Math.min(Math.max(parseInt(item.box, 10) || 1, 1), SRS_INTERVALS_DAYS.length);
  const s = fsrsClamp(SRS_INTERVALS_DAYS[box - 1], fsrsInitStability(1), 60);
  const d = item.userData && item.userData.status === 'known' ? 4.8 : fsrsInitDifficulty(3);
  return { s, d };
}

/** Duplicate-detection key per spec §1.1: NFKC casefold, collapse whitespace,
 *  strip surrounding punctuation (keep in-word - and '), which also removes a
 *  sentence's trailing punctuation run. */
export function normalizeText(t) {
  let s = String(t || '').normalize('NFKC').toLowerCase().trim().replace(/\s+/g, ' ');
  s = s.replace(/^[^\p{L}\p{N}'’-]+/u, '').replace(/[^\p{L}\p{N}'’-]+$/u, '');
  return s;
}

/** A selected dictionary sense is a separate learning item; legacy items keep
 * the historic (type, text) identity until the learner picks a concrete sense. */
export function itemIdentityKey(item) {
  const type = item?.type || 'word';
  const text = item?.normalizedText || normalizeText(item?.text);
  const sense = String(item?.dictionary?.senseKey || '').trim();
  return `${type}\n${text}${sense ? `\nsense:${sense}` : ''}`;
}

function uuid() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return 'i' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

/** Build a fully-formed LearningItem from partial fields (also the validator
 *  used by import — every external value is coerced or defaulted here). */
export function makeItem(fields) {
  const text = String(fields.text || '').trim();
  if (!text) throw new Error('cannot create an empty learning item');
  const now = Date.now();
  const status = STATUS_VALUES.includes(fields.status) ? fields.status : 'new';
  const box = Math.min(Math.max(parseInt(fields.box, 10) || 1, 1), SRS_INTERVALS_DAYS.length);
  const tags = Array.isArray(fields.tags) ? fields.tags.map(String).filter(Boolean) : [];
  return {
    id: typeof fields.id === 'string' && fields.id ? fields.id : uuid(),
    type: TYPE_VALUES.includes(fields.type) ? fields.type : 'word',
    text,
    normalizedText: normalizeText(text),
    context: fields.context && typeof fields.context === 'object' ? fields.context : {},
    dictionary: fields.dictionary && typeof fields.dictionary === 'object' ? { ...fields.dictionary } : {},
    userData: {
      note: fields.note ? String(fields.note) : '',
      tags,
      status,
    },
    createdAt: Number(fields.createdAt) || now,
    lastReviewedAt: Number(fields.lastReviewedAt) || 0,
    reviewCount: Number(fields.reviewCount) || 0,
    box,
    due: Number(fields.due) || now,
    sourceTag: fields.sourceTag ? String(fields.sourceTag) : '',
    deck: fields.deck ? String(fields.deck).trim() : '',
    // FSRS memory state (R3) — preserved through export/import so a round trip
    // does not silently downgrade a card back to warm-init defaults.
    fsrs: fields.fsrs && typeof fields.fsrs === 'object' && Number(fields.fsrs.s) > 0
      ? { s: Math.min(Number(fields.fsrs.s), 3650), d: fsrsClamp(Number(fields.fsrs.d) || fsrsInitDifficulty(3), 1, 10) }
      : undefined,
  };
}

/* ---------------- raw CRUD ---------------- */

export async function allItems() {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('items', 'readonly');
    const req = tx.objectStore('items').getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

export async function putItem(item) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('items', 'readwrite');
    tx.objectStore('items').put(item);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** Put many items inside ONE transaction (migration / import batches). */
export async function putItems(items) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('items', 'readwrite');
    const store = tx.objectStore('items');
    for (const item of items) store.put(item);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function deleteItem(id) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('items', 'readwrite');
    tx.objectStore('items').delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** Find one item by (type, text) using the normalizedText index. */
export async function findItem(type, text, senseKey = '') {
  const norm = normalizeText(text);
  if (!norm) return null;
  const db = await openDb();
  const matches = await new Promise((resolve, reject) => {
    const tx = db.transaction('items', 'readonly');
    const req = tx.objectStore('items').index('normalizedText').getAll(norm);
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
  return matches.find((i) => i.type === type && (!senseKey || i.dictionary?.senseKey === senseKey)) || null;
}

/** Save-or-merge: dedupe by (type, normalizedText, selected sense when present).
 *  Returns { item, merged } — merged=true means an older item was kept. */
export async function addItem(fields) {
  const norm = normalizeText(fields.text);
  const senseKey = String(fields.dictionary?.senseKey || '').trim();
  const db = await openDb();
  const existing = norm
    ? await new Promise((resolve, reject) => {
        const tx = db.transaction('items', 'readonly');
        const req = tx.objectStore('items').index('normalizedText').getAll(norm);
        req.onsuccess = () => resolve((req.result || []).find((i) =>
          i.type === (fields.type || 'word') && String(i.dictionary?.senseKey || '').trim() === senseKey) || null);
        req.onerror = () => reject(req.error);
      })
    : null;
  if (existing) return { item: existing, merged: true };
  const item = makeItem(fields);
  await putItem(item);
  return { item, merged: false };
}

/* ---------------- migration (one-way, idempotent) — spec §3 ---------------- */

/** Migrate legacy localStorage vocab/sentences into LearningItems. Idempotent:
 *  skips if a previous run already landed (detected via sourceTag). The
 *  original localStorage keys are NEVER deleted — they are the rollback copy —
 *  and a raw snapshot is stored in the IDB files store as backup #2. */
export async function migrateLegacyData() {
  const existing = await allItems();
  if (existing.some((i) => i.sourceTag === MIGRATION_SOURCE_TAG)) {
    return { ran: false, words: 0, sentences: 0 };
  }
  let vocab = [];
  let sentences = [];
  try { vocab = JSON.parse(localStorage.getItem('vocab') || '[]'); } catch (e) { vocab = []; }
  try { sentences = JSON.parse(localStorage.getItem('sentences') || '[]'); } catch (e) { sentences = []; }
  if (!Array.isArray(vocab)) vocab = [];
  if (!Array.isArray(sentences)) sentences = [];
  if (!vocab.length && !sentences.length) return { ran: false, words: 0, sentences: 0 };

  // backup #2: raw pre-migration snapshot inside IndexedDB
  await putFile('backup-pre-migration-v3', new Blob(
    [JSON.stringify({ vocab, sentences }, null, 2)],
    { type: 'application/json' }
  ));

  const batch = [];
  for (const v of vocab) {
    if (!v || !v.word) continue;
    batch.push(makeItem({
      type: 'word',
      text: v.word,
      createdAt: v.addedAt,
      box: v.box,
      due: v.due,
      status: Number(v.box) >= 2 ? 'learning' : 'new',
      sourceTag: MIGRATION_SOURCE_TAG,
    }));
  }
  for (const s of sentences) {
    if (!s || !s.sentence) continue;
    batch.push(makeItem({
      type: 'sentence',
      text: s.sentence,
      context: { sentence: s.sentence, headword: s.word || '', sourceTitle: s.source || '' },
      createdAt: s.addedAt,
      box: 1,
      due: Date.now() + SRS_INTERVALS_DAYS[0] * 86400000, // context sentence: ~1 day out, so a first migration does not flood the review queue
      sourceTag: MIGRATION_SOURCE_TAG,
    }));
  }
  // dedupe within the batch AND against pre-existing items
  const seen = new Set(existing.map(itemIdentityKey));
  const out = [];
  for (const it of batch) {
    const key = itemIdentityKey(it);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(it);
  }
  if (out.length) await putItems(out);
  localStorage.setItem('migrated-v3', new Date().toISOString());
  return {
    ran: true,
    words: out.filter((i) => i.type === 'word').length,
    sentences: out.filter((i) => i.type === 'sentence').length,
  };
}

/** One-time repair for items created by the ORIGINAL v3 migration, which set a
 *  context sentence's `due` to its creation time (addedAt) — making the whole
 *  saved-sentence history due at once and flooding the Review badge/queue.
 *  Push those never-reviewed migrated sentences ~1 day out. Idempotent via a
 *  localStorage flag; only touches items that still look untouched. */
export async function repairMigratedSentenceSchedule() {
  if (localStorage.getItem(MIGRATION_DUE_FIX_TAG)) return { fixed: 0 };
  const items = await allItems();
  const target = Date.now() + SRS_INTERVALS_DAYS[0] * 86400000;
  const changed = [];
  for (const it of items) {
    if (it.sourceTag === MIGRATION_SOURCE_TAG && it.type === 'sentence' &&
        (it.reviewCount || 0) === 0 && it.due <= it.createdAt) {
      it.due = target;
      it.box = 1;
      changed.push(it);
    }
  }
  if (changed.length) await putItems(changed);
  localStorage.setItem(MIGRATION_DUE_FIX_TAG, new Date().toISOString());
  return { fixed: changed.length };
}

/* ---------------- row import (Anki .txt/.tsv, CSV) — Phase 5-D ---------------- */

/** Quote ONE cell for a delimited export. The mirror image of this function is
 *  `splitDelimitedRecords` below — they MUST stay in agreement, which is why both
 *  live here instead of one on each side of the export/import boundary.
 *  Tab exports cannot carry a tab/newline inside a value (Anki treats them as
 *  field borders), so those are flattened to spaces. */
export function formatDeckCell(v, delim) {
  const s = String(v == null ? '' : v);
  if (delim === '\t') return s.replace(/[\t\r\n]+/g, ' ').trim();
  // Quote when the value would otherwise break the row — a quote, a newline, or
  // the delimiter itself — doubling embedded quotes.
  return /[",\n\r]/.test(s) || (delim !== ',' && s.includes(delim))
    ? '"' + s.replace(/"/g, '""') + '"'
    : s;
}

/** Anki `#separator:` directive → the delimiter it names. Anki writes a keyword
 *  (tab/comma/semicolon/space/pipe); a literal character is also accepted. */
function delimiterFromDirective(v) {
  const k = String(v || '').trim().toLowerCase();
  return { tab: '\t', comma: ',', semicolon: ';', space: ' ', pipe: '|' }[k] || k.slice(0, 1) || '';
}

/** Split delimited text into records of cells, honouring the quoting that
 *  `formatDeckCell` writes: a field that starts with `"` runs to the matching
 *  quote, `""` inside it is one literal quote, and the delimiter/newlines inside
 *  quotes belong to the value — so a note containing a comma or a line break
 *  survives a round trip. A `"` that does not start a field is a literal
 *  character, which keeps un-quoted Anki fields exactly as they were. */
export function splitDelimitedRecords(text, delim) {
  const src = String(text || '').replace(/^\ufeff/, ''); // strip a UTF-8 BOM (Excel writes one)
  const records = [];
  let cells = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') { cell += '"'; i++; } else { quoted = false; }
      } else { cell += ch; }
      continue;
    }
    if (ch === '"' && cell === '') { quoted = true; continue; }
    if (ch === delim) { cells.push(cell); cell = ''; continue; }
    if (ch === '\n') { cells.push(cell); cell = ''; records.push(cells); cells = []; continue; }
    if (ch === '\r') continue; // CRLF / stray CR
    cell += ch;
  }
  if (cell !== '' || cells.length) { cells.push(cell); records.push(cells); }
  return records;
}

/** Occurrences of `ch` in `line` that are NOT inside a quoted field. A comma in
 *  a note is written quoted by formatDeckCell, so it must not be mistaken for
 *  the file's delimiter. */
function countOutsideQuotes(line, ch) {
  let n = 0;
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') { quoted = !quoted; continue; }
    if (!quoted && c === ch) n++;
  }
  return n;
}

/** Pick the delimiter of a file with no `#separator:` directive.
 *  The FIRST data/header line decides, which is what makes this safe:
 *   - an Anki .txt/.tsv starts with its first note, and a tab there means TAB —
 *     exactly the old `s.includes('\t') ? '\t' : ';'` rule, so an Anki tab deck
 *     keeps importing as before no matter how many commas its definitions hold;
 *   - the app's own CSV/TSV export starts with its header row, which carries one
 *     delimiter per column.
 *  Only when that line has no delimiter at all (a single-column list) do the
 *  following lines get a say. */
function detectDelimiter(lines) {
  const first = lines[0] || '';
  if (countOutsideQuotes(first, '\t') > 0) return '\t';
  const commas = countOutsideQuotes(first, ',');
  const semis = countOutsideQuotes(first, ';');
  if (commas || semis) return commas >= semis ? ',' : ';';
  const rest = lines.slice(1, 6).join('\n');
  if (countOutsideQuotes(rest, '\t') > 0) return '\t';
  const commas2 = countOutsideQuotes(rest, ',');
  const semis2 = countOutsideQuotes(rest, ';');
  if (commas2 > semis2) return ',';
  if (semis2 > commas2) return ';';
  return '\t'; // no delimiter anywhere → every line is one cell (the historical behaviour)
}

/** Column names the app's own exporters write (runExport's field list). A first
 *  row made only of these is a HEADER, not data — re-importing an export must
 *  read the columns back instead of turning the header into a junk item. */
const DECK_HEADER_FIELDS = ['text', 'type', 'status', 'tags', 'deck', 'note', 'sentence', 'source', 'created'];

/** Parse a delimited deck file — Anki .txt/.tsv, the app's own .csv, or a
 *  hand-written comma/semicolon list. Each row maps onto LearningItem fields and
 *  is returned WITHOUT writing, so the caller merges through importItems for
 *  consistent dedupe.
 *
 *  Two shapes are understood:
 *  - header-less (real Anki, including a stock export whose `#columns:` names
 *    Front/Back/Tags): front, back, tags? — the historical behaviour, byte for
 *    byte, for tab-delimited input.
 *  - column-mapped (the app's own CSV/TSV/Anki export, or its `#columns:`): a
 *    header row / directive made of THIS app's field names, so type/status/tags/
 *    deck/note/sentence/source/created survive the round trip instead of
 *    collapsing into front/back.
 *
 *  `#separator:` and `#columns:` directives are honoured; other `#` lines are
 *  skipped. Returns {rows, skipped, separator, columns}. */
export function parseDeckRows(text, name) {
  const src = String(name || 'anki-import');
  const clean = String(text || '').replace(/^\ufeff/, '');
  const lines = clean.split(/\r?\n/);
  let separator = '';
  let columnsRaw = '';
  for (const line of lines) {
    if (!line.trim().startsWith('#')) break; // directives live in the leading header block
    const m = line.match(/^#\s*separator\s*:\s*(.+)$/i);
    if (m) separator = delimiterFromDirective(m[1]);
    const c = line.match(/^#\s*columns\s*:\s*(.+)$/i);
    if (c) columnsRaw = c[1].trim(); // split AFTER the loop — #separator may come later
  }
  const sampleLines = lines.filter((l) => l.trim() && !l.trim().startsWith('#'));
  // An export can hold a single column (the user unchecked the rest). Its header
  // row is one bare field name with no delimiter anywhere — splitting it on a
  // guessed delimiter would corrupt any value that happens to contain one.
  const singleColumn = sampleLines.length > 0 && !/[\t,;]/.test(sampleLines[0]) &&
    DECK_HEADER_FIELDS.includes(sampleLines[0].trim().toLowerCase());
  // '\u0000' cannot occur in a text file, so nothing ever splits.
  if (!separator) separator = singleColumn ? '\u0000' : detectDelimiter(sampleLines);

  // `#columns:` lists the column names separated by the FILE's own delimiter, not
  // by commas: a tab-delimited Anki export writes "#columns:Front<TAB>Back<TAB>Tags"
  // (splitting that on commas yielded ONE bogus field name "front\tback\ttags",
  // which mapped nothing and made every row look empty). A tab in the directive is
  // unambiguous, so it wins; otherwise the declared/detected separator; else comma.
  let columns = null;
  if (columnsRaw) {
    const delim = columnsRaw.includes('\t') ? '\t'
      : (separator && separator !== '\u0000' && columnsRaw.includes(separator)) ? separator
        : ',';
    const names = columnsRaw.split(delim).map((x) => x.replace(/^\ufeff/, '').trim().toLowerCase()).filter(Boolean);
    // Adopt the directive as a column mapping ONLY when its names are this app's
    // own export fields. Anki's own names (Front/Back/Tags) are not, and adopting
    // them mapped every row to nothing — so such a directive is ignored and the
    // file falls through to the header-less Anki rule below (front → text,
    // back → translation/context, tags → tags), which is what a stock Anki export
    // needs.
    if (names.includes('text') || names.every((c) => DECK_HEADER_FIELDS.includes(c))) columns = names;
  }

  // Records are parsed over the WHOLE text (not per line) so a quoted value may
  // span lines. Directive/comment rows are then dropped by looking at the parsed
  // first cell — otherwise a newline inside a quoted note would be mistaken for
  // a directive and silently cut out of the value.
  const records = splitDelimitedRecords(clean, separator)
    .map((cells) => cells.map((c) => c.trim()))
    .filter((cells) => cells.some((c) => c !== ''))
    .filter((cells) => !(cells[0] || '').startsWith('#'));

  // A header row is one whose every column is a known export field (and which
  // names the `text` column — the primary key, never absent from our exports).
  // Without one, columns comes from Anki's #columns: directive, which lists the
  // same names; without that either, the file is treated as header-less Anki.
  let fields = columns;
  if (records.length) {
    const first = records[0].map((c) => c.toLowerCase());
    if (first.includes('text') && first.every((c) => DECK_HEADER_FIELDS.includes(c))) {
      fields = first;
      records.shift();
    }
  }

  const out = [];
  let skipped = 0;
  for (const cells of records) {
    const at = (k) => {
      const i = fields ? fields.indexOf(k) : -1;
      return i >= 0 ? (cells[i] || '').trim() : '';
    };
    let row;
    if (fields) {
      // Column-mapped row (the app's own export): every field comes back by name.
      const text = at('text');
      if (!text) { skipped++; continue; }
      const tagsCell = at('tags');
      const sentence = at('sentence');
      const created = at('created');
      const createdMs = created ? Date.parse(created) : NaN;
      row = { type: at('type') || (/\s/.test(text) ? 'phrase' : 'word'), text, sourceTag: src };
      if (at('status')) row.status = at('status');
      if (at('deck')) row.deck = at('deck');
      if (at('note')) row.note = at('note');
      if (tagsCell) row.tags = tagsCell.split(/[ ,]+/).filter(Boolean).map((x) => x.replace(/^#/, ''));
      if (sentence || at('source')) row.context = { sentence: sentence || text, sourceTitle: at('source') || src };
      if (!Number.isNaN(createdMs)) row.createdAt = createdMs;
    } else {
      // Header-less Anki row: front / back / tags (unchanged behaviour).
      const front = cells[0] || '';
      const back = cells[1] || '';
      const tags = cells[2] || '';
      if (!front) { skipped++; continue; }
      row = { type: /\s/.test(front) ? 'phrase' : 'word', text: front, sourceTag: src };
      if (back) {
        // the "back" becomes the meaning: keep it on the item as a translation
        // snapshot + an example when it looks like a sentence
        row.dictionary = { translation: back };
        if (/[.!?]$/.test(back)) row.context = { sentence: back, headword: front, sourceTitle: src };
      }
      if (tags) row.tags = tags.split(/[ ,]+/).filter(Boolean).map((x) => x.replace(/^#/, ''));
    }
    out.push(row);
  }
  return { rows: out, skipped, separator, columns: fields };
}

/* ---------------- import (v2 + v3 files) — spec §3 ---------------- */

/** Merge a previously exported data file. Accepts v3 ({items:[…]}) and v2
 *  ({words:[…], sentences:[…]} — the old export format). Duplicate detection
 *  includes a selected sense when present; local data wins on a matching card. */
export async function importItems(payload) {
  if (!payload || typeof payload !== 'object') throw new Error('not a Dual Dictionary export file');
  const incoming = [];
  if (payload.version === 3 && Array.isArray(payload.items)) {
    for (const raw of payload.items) {
      if (!raw || typeof raw !== 'object') continue;
      if (!raw.text && !raw.normalizedText) continue;
      try {
        incoming.push(makeItem({
          id: raw.id,
          type: raw.type,
          text: raw.text || raw.normalizedText,
          context: raw.context,
          dictionary: raw.dictionary,
          note: raw.userData?.note,
          tags: raw.userData?.tags,
          status: raw.userData?.status,
          createdAt: raw.createdAt,
          lastReviewedAt: raw.lastReviewedAt,
          reviewCount: raw.reviewCount,
          box: raw.box,
          due: raw.due,
          sourceTag: raw.sourceTag || 'import-v3',
          deck: raw.deck,
          fsrs: raw.fsrs,
        }));
      } catch (e) { /* skip this one */ }
    }
  } else if (Array.isArray(payload.words) || Array.isArray(payload.sentences)) {
    for (const w of payload.words || []) {
      if (!w || !w.word) continue;
      try {
        incoming.push(makeItem({
          type: 'word',
          text: w.word,
          createdAt: w.addedAt,
          box: w.box,
          due: w.due,
          status: Number(w.box) >= 2 ? 'learning' : 'new',
          sourceTag: 'import-v2',
        }));
      } catch (e) { /* skip */ }
    }
    for (const s of payload.sentences || []) {
      if (!s || !s.sentence) continue;
      try {
        incoming.push(makeItem({
          type: 'sentence',
          text: s.sentence,
          context: { sentence: s.sentence, headword: s.word || '', sourceTitle: s.source || '' },
          createdAt: s.addedAt,
          box: 1,
          due: Date.now() + SRS_INTERVALS_DAYS[0] * 86400000,
          sourceTag: 'import-v2',
        }));
      } catch (e) { /* skip */ }
    }
  } else {
    throw new Error('no items/words/sentences found in the file');
  }
  // v117 A2 — restore the known-words baseline (additive key `known`; an old
  // app importing this file ignores the key, this app ignores its absence).
  // Local data wins: a level already set locally is left untouched.
  let knownRestored = 0;
  if (payload.version === 3 && Array.isArray(payload.known)) {
    const have = new Set((await dbAllKnownRecords()).map((r) => r.level));
    for (const rec of payload.known) {
      if (!rec || !KNOWN_LEVELS.includes(rec.level) || !Array.isArray(rec.words)) continue;
      if (have.has(rec.level)) continue;
      await setKnownLevel(rec.level, rec.words);
      knownRestored++;
    }
  }
  const existing = await allItems();
  const seen = new Set(existing.map(itemIdentityKey));
  const ids = new Set(existing.map((i) => i.id));
  const fresh = [];
  let added = 0;
  let skipped = 0;
  for (const it of incoming) {
    const key = itemIdentityKey(it);
    if (seen.has(key)) { skipped++; continue; } // local data wins on conflict
    if (ids.has(it.id)) { skipped++; continue; }
    seen.add(key);
    ids.add(it.id);
    fresh.push(it);
    added++;
  }
  if (fresh.length) await putItems(fresh);
  return { added, skipped, knownRestored };
}

/* ---------------- known-words baseline (v117 A2 — plan D1/D2) ----------------
 * The milestone lives in its own IndexedDB store `known` (db v4), NOT in
 * `items`: a 1k–10k baseline must never inflate the Vault, the stats or the
 * practice deck pools. One record per level; each record stores the
 * CUMULATIVE lemma list of that milestone (every band up to its ceiling), so
 * the effective known-set is the union and levelling up is an idempotent
 * delta-add. Down-levelling is not a flow — ⚙ Advanced reset is. */

export const KNOWN_LEVELS = ['top1k', 'top2k', 'top5k', 'top10k'];

/** Effective known-set = union of every stored level's words. Returns
 *  { records, words:Set<string>, highest } — highest is the highest level id
 *  set so far, or null when the baseline is empty. */
export async function knownState() {
  const records = (await dbAllKnownRecords())
    .filter((r) => r && KNOWN_LEVELS.includes(r.level) && Array.isArray(r.words));
  const words = new Set();
  for (const r of records) for (const w of r.words) if (typeof w === 'string') words.add(w);
  const highest = KNOWN_LEVELS.filter((l) => records.some((r) => r.level === l)).pop() || null;
  return { records, words, highest };
}

/** Set (or re-set) one milestone. `words` is the cumulative lemma list the
 *  caller computed from data/freq-en.json. Idempotent for the same level. */
export async function setKnownLevel(level, words) {
  if (!KNOWN_LEVELS.includes(level)) throw new Error('unknown known-level: ' + level);
  const clean = [...new Set((Array.isArray(words) ? words : []).filter((w) => typeof w === 'string' && w))];
  await putKnownRecord({ level, words: clean, updatedAt: Date.now() });
  return clean.length;
}

/** Full wipe (⚙ Advanced reset). The milestone model has no per-level removal
 *  flow — levelling up is delta-add, going down means a full reset. */
export async function resetKnown() {
  await dbClearKnown();
}

/** Records for the export payload (key `known`, additive). */
export async function knownRecordsForExport() {
  return dbAllKnownRecords();
}
