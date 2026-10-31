#!/usr/bin/env node
/* Wordlist classifier for the 2,000-word pages (P0 groundwork for P1).
 *
 * Labels every built headword so editorial decisions (keep / relabel / remove
 * from the learning set) can be made on a TABLE, not word by word:
 *
 *   irregular-inflection  form is in ipa-inflect's IRREGULAR_LEMMA map
 *   inflection            regular -s/-ed/-ing/-ves form of a dictionary lemma
 *   proper-noun           OVDP entry text marks it as a name (tên riêng/nước…)
 *   vulgar                explicit profanity list (kept on its own page, but
 *                         must not sit inside the learning set unmarked)
 *   fragment              single letters, vowel-less junk, bare interjections
 *   lemma                 everything else (the actual learning targets)
 *
 * Selection mirrors build-word-pages.cjs exactly (freq ∩ dictionary, band
 * order, cap 2000) so the classification always matches what was built.
 *
 * Output: data/wordlist-classification.json (machine) + console summary.
 */

const fs = require('fs');
const path = require('path');
const { MDict } = require('../js/mdict.js');
const { IRREGULAR_LEMMA, lemmaCandidates } = require('./ipa-inflect.cjs');
const { VULGAR, FRAGMENTS, PROPER_RE, ABBREV_RE } = require('./wordlist-lib.cjs');
const { sanitizeRaw } = require('./word-notes-lib.cjs');

const REPO = path.join(__dirname, '..');
const OUT_JSON = path.join(REPO, 'data', 'wordlist-classification.json');


function classifyWord(word, raw) {
  const text = sanitizeRaw(raw);
  // priority: vulgar > fragment > irregular > proper-noun > regular inflection
  if (VULGAR.has(word)) return { label: 'vulgar' };
  // short REAL words (an, at, be, do, go, my…) are lemmas — only listed
  // fragments/letters and vowel-less strings are junk
  if (FRAGMENTS.has(word) || !/[aeiouy]/.test(word)) return { label: 'fragment' };
    if (IRREGULAR_LEMMA[word]) return { label: 'irregular-inflection', lemma: IRREGULAR_LEMMA[word] };
  if (ABBREV_RE.test(text)) return { label: 'abbreviation' };
  if (PROPER_RE.test(text)) return { label: 'proper-noun' };
  // regular-inflection vs lemma is decided in main() against the dict keys
  return { label: null };
}

async function main() {
  const ipa = JSON.parse(fs.readFileSync(path.join(REPO, 'data', 'ipa-en.json'), 'utf8'));
  const freq = JSON.parse(fs.readFileSync(path.join(REPO, 'data', 'freq-en.json'), 'utf8'));
  const buf = fs.readFileSync(path.join(REPO, 'dicts-en-vi', 'star_anhviet.mdx'));
  const dict = new MDict(new Blob([buf]), 'star_anhviet.mdx');
  await dict.init();
  const allKeys = new Set((await dict.loadAllKeys()).map(String));

  const LIMIT = parseInt(process.env.WORD_LIMIT || '2000', 10);
  const candidates = Object.keys(freq)
    .filter((w) => /^[a-z][a-z'’-]{0,24}$/.test(w))
    .filter((w) => allKeys.has(w))
    .sort((a, b) => {
      const ba = parseInt(freq[a], 10) || 99;
      const bb = parseInt(freq[b], 10) || 99;
      return ba - bb || a.localeCompare(b);
    })
    .slice(0, LIMIT);

  const out = {};
  const counts = {};
  for (const word of candidates) {
    let raw = '';
    try {
      const r = await dict.lookup(word);
      if (r && r[0] && r[0].text) raw = r[0].text;
    } catch (e) { /* empty entry */ }

    const res = classifyWord(word, raw);
    let label = res.label;
    if (!label) {
      // regular-inflection iff a rule-derived candidate exists in the dict;
      // note: raw candidate list is filtered against dict keys, not ipa
      const dictLemma = lemmaCandidates(word).find((c) => c !== word && allKeys.has(c));
      if (dictLemma) { label = 'inflection'; res.lemma = dictLemma; }
      else label = 'lemma';
    }
    out[word] = { label, lemma: res.lemma || null, hasIpa: Boolean(ipa[word]) };
    counts[label] = (counts[label] || 0) + 1;
  }

  fs.writeFileSync(OUT_JSON, JSON.stringify({
    generatedAt: new Date().toISOString(),
    total: candidates.length,
    counts,
    words: out,
  }, null, 2));

  console.log(`Classified ${candidates.length} headwords -> data/wordlist-classification.json`);
  for (const [label, n] of Object.entries(counts).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${label.padEnd(20)} ${n}`);
  }
  const list = (l) => Object.keys(out).filter((w) => out[w].label === l);
  console.log('\nvulgar:', list('vulgar').join(', ') || '(none)');
  console.log('fragment:', list('fragment').join(', ') || '(none)');
  console.log('proper-noun (first 40):', list('proper-noun').slice(0, 40).join(', '));
  console.log('irregular-inflection (first 40):', list('irregular-inflection').slice(0, 40).join(', '));
}

main().catch((e) => {
  console.error('FATAL:', e);
  process.exit(1);
});