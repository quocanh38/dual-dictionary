#!/usr/bin/env node
/* One-off cleaner for data/ipa-en.json — closes the lemma-copy bug class for
 * the RUNTIME table (the app's pron strip reads this file raw; v93 only fixed
 * the page OUTPUT via tools/ipa-inflect.cjs resolveIpa, leaving the file — and
 * therefore the app — carrying lemma IPA like became:"bɪˈkʌm", went:"ɡoʊ",
 * took:"teɪk", children:"tʃaɪld"). Found by an external review 2026-10-02,
 * verified against Cambridge (/bɪˈkeɪm/ for became).
 *
 * CONSERVATIVE SCOPE (deliberate):
 *   - keys with a curated IRREGULAR_IPA value → always the curated value;
 *   - keys inside the built 2,000-word set (wordlist-classification.json)
 *     → resolveIpa() output (curated / derived / dataset; a detected copy-bug
 *       that cannot be resolved KEEPS its previous value rather than going
 *       blank — the app has no way to express "no IPA" and blank would fall
 *       back to the lemma's IPA anyway, i.e. the same bug);
 *   - everything else (the long tail, ~147k keys incl. ~30k suffix-less
 *     regular forms) → UNCHANGED. Zero regression outside the high-traffic
 *     set; documented as accepted in docs/deployment.md v94.
 *
 * Two-pass: all detection runs against the ORIGINAL values, so cleaning one
 * entry can never cascade into another. Charset gate on every changed value.
 *
 * Usage: node tools/clean-ipa-json.cjs        (rewrites data/ipa-en.json)
 *        node tools/clean-ipa-json.cjs --check  (report only, no write)
 * QA summary lands in docs/ipa-clean-qa.json.
 */

const fs = require('fs');
const path = require('path');
const { resolveIpa, IRREGULAR_IPA, IPA_CHAR_OK } = require('./ipa-inflect.cjs');

const REPO = path.join(__dirname, '..');
const SRC = path.join(REPO, 'data', 'ipa-en.json');
const WL = path.join(REPO, 'data', 'wordlist-classification.json');
const QA = path.join(REPO, 'docs', 'ipa-clean-qa.json');
const CHECK_ONLY = process.argv.includes('--check');

const table = JSON.parse(fs.readFileSync(SRC, 'utf8'));
// v95: derive the built-word set from the actual pages dir (batch 1 + batch 2
// AWL supplement both covered automatically), falling back to the old
// classification file if the pages dir is missing.
let built2000;
try {
  built2000 = new Set(fs.readdirSync(path.join(REPO, 'vi', 'tu'), { withFileTypes: true })
    .filter((d) => d.isDirectory() && fs.existsSync(path.join(REPO, 'vi', 'tu', d.name, 'index.html')))
    .map((d) => d.name));
  if (!built2000.size) throw new Error('empty');
} catch {
  const wl = JSON.parse(fs.readFileSync(WL, 'utf8'));
  built2000 = new Set(Object.keys(wl.words || {}));
}

const out = {};
const stats = { curatedChanged: 0, resolved2000: 0, keptDataset: 0, longTail: 0, copybugKept: 0, charsetReverted: 0 };
const changes = [];

for (const [w, prev] of Object.entries(table)) {
  let next = prev;
  if (IRREGULAR_IPA[w] !== undefined) {
    if (IRREGULAR_IPA[w] !== prev) { next = IRREGULAR_IPA[w]; stats.curatedChanged++; }
  } else if (built2000.has(w)) {
    const r = resolveIpa(w, table);
    if (r.source === 'copybug-hidden' || !r.ipa) { next = prev; if (r.source === 'copybug-hidden') stats.copybugKept++; }
    else { next = r.ipa; if (r.ipa !== prev) stats.resolved2000++; }
  } else {
    stats.longTail++;
  }
  if (next !== prev) {
    if (!IPA_CHAR_OK.test(next)) { stats.charsetReverted++; next = prev; }
    else changes.push({ w, from: prev, to: next });
  }
  out[w] = next;
}

const summary = {
  generatedAt: new Date().toISOString(),
  keys: Object.keys(out).length,
  changed: changes.length,
  ...stats,
  changes,
};

if (CHECK_ONLY) {
  console.log(`--check: ${summary.keys} keys, ${summary.changed} would change, ` +
    `long-tail untouched: ${stats.longTail}, copybug-kept: ${stats.copybugKept}, charset-reverted: ${stats.charsetReverted}`);
  for (const c of changes.slice(0, 40)) console.log(`  ${c.w}: ${c.from} → ${c.to}`);
  process.exit(0);
}

fs.writeFileSync(SRC, JSON.stringify(out));
fs.writeFileSync(QA, JSON.stringify(summary, null, 2) + '\n');
console.log(`data/ipa-en.json rewritten: ${summary.keys} keys, ${summary.changed} changed ` +
  `(curated ${stats.curatedChanged} + resolved-2000 ${stats.resolved2000}); ` +
  `long-tail untouched ${stats.longTail}; copybug-kept ${stats.copybugKept}; charset-reverted ${stats.charsetReverted}`);
console.log(`QA: ${path.relative(REPO, QA)}`);
