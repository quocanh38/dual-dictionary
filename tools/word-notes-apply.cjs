#!/usr/bin/env node
/* Apply hand-written word notes (data/word-notes/{word}.md) into the static
 * word pages (vi/tu/{word}/index.html), replacing whatever is inside the
 * existing <section class="word-note">…</section> (auto-note or older hand
 * note) — no rebuild, sitemap lastmod and URLs untouched.
 *
 * PC port (2026-10-05) of the Mac DSH/tools/word-notes-apply.js: rendering is
 * delegated to tools/word-notes-lib.cjs (loadHandNote + renderNoteHTML) so
 * bold/`code` and the legacy renderer stay a single source of truth. Byte
 * contract verified against live v105 pages:
 *   <section class="word-note"><h2>Ghi chú sử dụng</h2>{renderNoteHTML}</section>
 * where renderNoteHTML output already ends with "\n".
 *
 * Usage: node tools/word-notes-apply.cjs [--check]   (repo root or anywhere —
 * paths resolve from this file)   --check: verify embedded sections match the
 * rendered ones (exit 1 on drift or missing page) without writing.
 */
const fs = require('fs');
const path = require('path');
const { loadHandNote, renderNoteHTML } = require('./word-notes-lib.cjs');

const ROOT = path.join(__dirname, '..');
const NOTES = path.join(ROOT, 'data', 'word-notes');
const CHECK = process.argv.includes('--check');

const SECTION_RE = /<section class="word-note">[\s\S]*?<\/section>/;
const files = fs.readdirSync(NOTES).filter((f) => f.endsWith('.md')).sort();
let updated = 0, already = 0, missing = 0, drift = 0;

for (const f of files) {
  const word = f.slice(0, -3);
  const page = path.join(ROOT, 'vi', 'tu', word, 'index.html');
  if (!fs.existsSync(page)) { console.log(`NO PAGE  ${word}`); missing++; continue; }
  const html = fs.readFileSync(page, 'utf8');
  const sections = loadHandNote(word, NOTES);
  if (!sections || !sections.length) { console.log(`EMPTY NOTE ${word}`); missing++; continue; }
  const rendered = `<section class="word-note"><h2>Ghi chú sử dụng</h2>${renderNoteHTML(sections)}</section>`;
  const m = html.match(SECTION_RE);
  if (!m) { console.log(`NO SECTION IN PAGE  ${word}`); missing++; continue; }
  if (m[0] === rendered) { already++; continue; }
  if (CHECK) { console.log(`DRIFT   ${word}`); drift++; continue; }
  fs.writeFileSync(page, html.replace(SECTION_RE, () => rendered));
  updated++;
}
console.log(`${CHECK ? 'check' : 'applied'}: ${files.length} notes — updated ${updated}, already-current ${already}, missing ${missing}${CHECK ? `, drift ${drift}` : ''}`);
process.exit(missing ? 1 : 0);
