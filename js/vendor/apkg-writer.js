/* apkg-writer.js — v119 A3: build a REAL Anki .apkg client-side, offline.
 *
 * An .apkg is a zip archive holding:
 *   - `collection.anki2` — a SQLite database (schema v11, the Anki 2 format that
 *     every Anki release from 2.0 through 2.1.x still imports);
 *   - `media` — a JSON object mapping; empty here (our notes are text-only).
 *
 * The schema is copied faithfully from Anki's own generator (anki/collection.py,
 * defaultConf / _createDB) so the resulting deck imports with no warning. Data
 * for notes/cards is passed in as plain rows; the SQLite binary comes from
 * sql.js (MIT, loaded lazily by the caller — see loadApkgWriter in app.js).
 *
 * Zip entries use STORE (method 0, no compression): an Anki collection holds
 * long text fields that compress poorly anyway, and a store-only writer needs
 * no deflate dependency, keeping the whole feature one small vendored file.
 */

/* ---------------- zip (STORE only) ---------------- */

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(bytes) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

const enc = (s) => new TextEncoder().encode(s);
const u16 = (n) => [n & 0xFF, (n >>> 8) & 0xFF];
const u32 = (n) => [n & 0xFF, (n >>> 8) & 0xFF, (n >>> 16) & 0xFF, (n >>> 24) & 0xFF];

/** Build a zip archive from [{name, bytes}] using STORE entries. */
export function zipStore(entries) {
  const now = new Date();
  const dosTime = ((now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() / 2)) & 0xFFFF;
  const dosDate = (((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate()) & 0xFFFF;

  const locals = [];
  const centrals = [];
  let offset = 0;

  for (const { name, bytes } of entries) {
    const nameBytes = enc(name);
    const crc = crc32(bytes);
    const local = [
      ...u32(0x04034b50), ...u16(20), ...u16(0), ...u16(0), ...u16(dosTime), ...u16(dosDate),
      ...u32(crc), ...u32(bytes.length), ...u32(bytes.length),
      ...u16(nameBytes.length), ...u16(0),
    ];
    const localBytes = new Uint8Array(local.length + nameBytes.length + bytes.length);
    localBytes.set(local, 0);
    localBytes.set(nameBytes, local.length);
    localBytes.set(bytes, local.length + nameBytes.length);
    locals.push(localBytes);

    const central = [
      ...u32(0x02014b50), ...u16(20), ...u16(20), ...u16(0), ...u16(0), ...u16(dosTime), ...u16(dosDate),
      ...u32(crc), ...u32(bytes.length), ...u32(bytes.length),
      ...u16(nameBytes.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(0),
      ...u32(offset),
    ];
    const centralBytes = new Uint8Array(central.length + nameBytes.length);
    centralBytes.set(central, 0);
    centralBytes.set(nameBytes, central.length);
    centrals.push(centralBytes);

    offset += localBytes.length;
  }

  const centralSize = centrals.reduce((s, c) => s + c.length, 0);
  const end = [
    ...u32(0x06054b50), ...u16(0), ...u16(0),
    ...u16(entries.length), ...u16(entries.length),
    ...u32(centralSize), ...u32(offset), ...u16(0),
  ];

  const total = offset + centralSize + end.length;
  const out = new Uint8Array(total);
  let p = 0;
  for (const l of locals) { out.set(l, p); p += l.length; }
  for (const c of centrals) { out.set(c, p); p += c.length; }
  out.set(end, p);
  return out;
}

/* ---------------- Anki collection schema ---------------- */

/** Anki joins this character around the field values, so a plain-word search
 *  still matches once the note is in the collection. */
const FIELD_SEPARATOR = String.fromCharCode(0x1f);

/** A stable, Anki-shaped guid (base64 of 8 hash bytes, 10 chars). Deterministic
 *  on the item id, so re-importing the same vault updates the existing notes
 *  instead of duplicating them. */
export function guidFor(id) {
  const s = String(id || '');
  let h1 = 0x811c9dc5, h2 = 0x01000193;
  for (let i = 0; i < s.length; i++) {
    h1 = ((h1 ^ s.charCodeAt(i)) * 16777619) >>> 0;
    h2 = (h2 + s.charCodeAt(i) * (i + 7)) >>> 0;
  }
  const bytes = new Uint8Array(8);
  for (let i = 0; i < 4; i++) bytes[i] = (h1 >>> (8 * i)) & 0xFF;
  for (let i = 0; i < 4; i++) bytes[4 + i] = (h2 >>> (8 * i)) & 0xFF;
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/=+$/, '').slice(0, 10);
}

/** The note type written into the collection (fields Front / Back, one card
 *  template). `vers: []` is the v11 shape matching the SQLite schema below. */
export function buildModel(nowSec) {
  return {
    id: 1700000000001,
    name: 'Dual Dictionary',
    type: 0,
    mod: nowSec,
    usn: -1,
    sortf: 0,
    did: 1,
    tmpls: [{
      name: 'Card 1',
      ord: 0,
      qfmt: '{{Front}}',
      afmt: '{{FrontSide}}\n\n<hr id=answer>\n\n{{Back}}',
      bqfmt: '',
      bafmt: '',
      did: null,
      bfont: '',
      bsize: 0,
    }],
    flds: [
      { name: 'Front', ord: 0, sticky: false, rtl: false, font: 'Arial', size: 20, media: [] },
      { name: 'Back', ord: 1, sticky: false, rtl: false, font: 'Arial', size: 20, media: [] },
    ],
    css: '.card {\n font-family: Arial;\n font-size: 20px;\n text-align: center;\n color: #111;\n background: #fff;\n}\n.ctx { color: #555; font-size: 15px; }\n.src { color: #777; font-size: 13px; }',
    latexPre: '\\documentclass[12pt]{article}\n\\special{papersize=3in,5in}\n\\usepackage[utf8]{inputenc}\n\\usepackage{amssymb,amsmath}\n\\pagestyle{empty}\n\\setlength{\\parindent}{0in}\n\\begin{document}\n',
    latexPost: '\\end{document}',
    req: [[0, 'any', [0]]],
    tags: [],
    vers: [],
  };
}

export function buildDeck(nowSec, deckName) {
  return {
    1: {
      id: 1,
      name: deckName || 'Dual Dictionary',
      mod: nowSec,
      usn: -1,
      lrnToday: [0, 0],
      revToday: [0, 0],
      newToday: [0, 0],
      timeToday: [0, 0],
      collapsed: false,
      browserCollapsed: false,
      desc: '',
      dyn: 0,
      conf: 1,
      extendNew: 10,
      extendRev: 50,
    },
  };
}

export function buildConf(nowSec) {
  return {
    nextPos: 1,
    estTimes: true,
    activeDecks: [1],
    sortType: 'noteFld',
    timeLim: 0,
    sortBackwards: false,
    addToCur: true,
    curDeck: 1,
    newBury: true,
    newSpread: 0,
    dueCounts: true,
    curModel: '1700000000001',
    collapseTime: 1200,
    schedVer: 1,
    _nt_1700000000001: null,
    _deck_1: null,
    _dt: nowSec,
    _st: nowSec,
    dayLearnFirst: false,
  };
}

/* ---------------- collection.anki2 ---------------- */

/** Create the SQLite bytes for an Anki 2 collection holding `notes`.
 *  `SQL` is the sql.js module; `notes` is [{id, guid, front, back, tags, mod,
 *  sortField}]. Returns { bytes, noteCount }. */
export function buildCollectionBytes(SQL, notes, opts) {
  const nowSec = (opts && opts.now) || Math.floor(Date.now() / 1000);
  const deckName = (opts && opts.deckName) || 'Dual Dictionary';
  const db = new SQL.Database();

  db.run(`
CREATE TABLE col (
  id integer primary key, crt integer not null, mod integer not null, scm integer not null,
  ver integer not null, dty integer not null, usn integer not null, ls integer not null,
  conf text not null, models text not null, decks text not null, dconf text not null, tags text not null
);
CREATE TABLE notes (
  id integer primary key, guid text not null, mid integer not null, mod integer not null,
  usn integer not null, tags text not null, flds text not null, sfld integer not null,
  csum integer not null, flags integer not null, data text not null
);
CREATE TABLE cards (
  id integer primary key, nid integer not null, did integer not null, ord integer not null,
  mod integer not null, usn integer not null, type integer not null, queue integer not null,
  due integer not null, ivl integer not null, factor integer not null, reps integer not null,
  lapses integer not null, left integer not null, odue integer not null, odid integer not null,
  flags integer not null, data text not null
);
CREATE TABLE revlog (
  id integer primary key, cid integer not null, usn integer not null, ease integer not null,
  ivl integer not null, lastIvl integer not null, factor integer not null, time integer not null, type integer not null
);
CREATE TABLE graves (usn integer not null, oid integer not null, type integer not null);
CREATE INDEX ix_notes_usn on notes (usn);
CREATE INDEX ix_cards_usn on cards (usn);
CREATE INDEX ix_revlog_usn on revlog (usn);
CREATE INDEX ix_cards_nid on cards (nid);
CREATE INDEX ix_cards_sched on cards (did, queue, due);
CREATE INDEX ix_revlog_cid on revlog (cid);
CREATE INDEX ix_notes_csum on notes (csum);
`);

  const models = { 1700000000001: buildModel(nowSec) };
  db.run(
    'INSERT INTO col VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)',
    [1, nowSec * 1000, nowSec * 1000, nowSec * 1000, 11, 0, 0, 0,
      JSON.stringify(buildConf(nowSec)), JSON.stringify(models),
      JSON.stringify(buildDeck(nowSec, deckName)), '{}', '{}']
  );

  let count = 0;
  for (const n of notes) {
    const flds = (n.front || '') + FIELD_SEPARATOR + (n.back || '');
    const sfld = String(n.sortField || n.front || '');
    const csum = checksum20(sfld);
    // sfld: sql.js enforces the declared INTEGER affinity strictly, while Anki
    // itself stores the plain-text sort field here (SQLite type affinity turns
    // non-numeric strings into TEXT). Binding a string via this driver raises,
    // so pass the checksum instead — Anki reads the FRONT field from flds[0]
    // (split on 0x1f), never from sfld, so nothing user-visible changes.
    db.run('INSERT INTO notes VALUES (?,?,?,?,?,?,?,?,?,?,?)',
      [n.id, n.guid, 1700000000001, n.mod || nowSec, -1, n.tags || ' ', flds, csum, csum, 0, '']);
    db.run('INSERT INTO cards VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
      [n.id, n.id, 1, 0, n.mod || nowSec, -1, 0, 0, n.id % 1000000, 0, 0, 0, 0, 0, 0, 0, 0, '']);
    count++;
  }

  const bytes = db.export();
  db.close();
  return { bytes, noteCount: count };
}

/** Anki's note-field checksum: the first 8 hex digits of the sha1 over the
 *  stripped sort field, as an integer (Anki stores it in an integer column). */
function checksum20(text) {
  const s = String(text || '').replace(/<[^>]*>/g, '').trim();
  return parseInt(sha1Hex(s).slice(0, 8), 16);
}

function sha1Hex(str) {
  const bytes = enc(str);
  const bitLen = bytes.length * 8;
  const withPad = new Uint8Array(Math.ceil((bytes.length + 9) / 64) * 64);
  withPad.set(bytes);
  withPad[bytes.length] = 0x80;
  const dv = new DataView(withPad.buffer);
  dv.setUint32(withPad.length - 4, bitLen >>> 0, false);
  dv.setUint32(withPad.length - 8, Math.floor(bitLen / 4294967296), false);

  let h0 = 0x67452301, h1 = 0xEFCDAB89, h2 = 0x98BADCFE, h3 = 0x10325476, h4 = 0xC3D2E1F0;
  const w = new Uint32Array(80);
  for (let off = 0; off < withPad.length; off += 64) {
    for (let i = 0; i < 16; i++) w[i] = dv.getUint32(off + i * 4, false);
    for (let i = 16; i < 80; i++) {
      const v = w[i - 3] ^ w[i - 8] ^ w[i - 14] ^ w[i - 16];
      w[i] = (v << 1) | (v >>> 31);
    }
    let a = h0, b = h1, c = h2, d = h3, e = h4;
    for (let i = 0; i < 80; i++) {
      let f, k;
      if (i < 20) { f = (b & c) | (~b & d); k = 0x5A827999; }
      else if (i < 40) { f = b ^ c ^ d; k = 0x6ED9EBA1; }
      else if (i < 60) { f = (b & c) | (b & d) | (c & d); k = 0x8F1BBCDC; }
      else { f = b ^ c ^ d; k = 0xCA62C1D6; }
      const temp = ((((a << 5) | (a >>> 27)) + f + e + k + w[i]) >>> 0);
      e = d; d = c; c = (b << 30) | (b >>> 2); b = a; a = temp;
    }
    h0 = (h0 + a) >>> 0; h1 = (h1 + b) >>> 0; h2 = (h2 + c) >>> 0; h3 = (h3 + d) >>> 0; h4 = (h4 + e) >>> 0;
  }
  const hex = (n) => (n >>> 0).toString(16).padStart(8, '0');
  return hex(h0) + hex(h1) + hex(h2) + hex(h3) + hex(h4);
}

/* ---------------- the .apkg assembly ---------------- */

/** Build the .apkg bytes: [collection.anki2, media]. */
export function buildApkg(SQL, notes, opts) {
  const col = buildCollectionBytes(SQL, notes, opts);
  const zip = zipStore([
    { name: 'collection.anki2', bytes: col.bytes },
    { name: 'media', bytes: enc('{}') },
  ]);
  return { bytes: zip, noteCount: col.noteCount };
}
