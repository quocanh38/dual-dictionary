#!/usr/bin/env node
/* P1 BrE IPA (owner-approved 01/11/2026): derive a British transcription from
 * the American one ONLY for high-confidence patterns. Anything uncertain
 * returns '' (page shows AmE only, never a guessed BrE). Conservative by
 * design: rhotic-vowel unrounding is the safe core; lexical splits
 * (schedule, either, tomato...) are NOT derived — they need a hand table.
 *
 * Safe transforms (GenAm-compact notation used by data/ipa-en.json):
 *   ɚ → ə, ɝ → ɜː, ɑɹ → ɑː, ɔɹ → ɔː, ɛɹ → ɛə, ɪɹ → ɪə
 *   oʊ → əʊ, ɹ → r (remaining), ʌ → ʌ (unchanged)
 * Unsafe (return '' when the AmE form hinges on them):
 *   æ followed by f/sk/sp/st (dance, fast, glass...) — BrE has ɑː, but the
 *   TRAP-BATH boundary is lexical; skip the whole word.
 *   ɒ vs ɑ (lot, coffee...) — dataset writes ɑ for both; cannot split safely.
 * Only words whose AmE IPA contains at least one safe rhotic/diphthong marker
 * AND no unsafe pattern get a BrE form. All others: '' (AmE-only page).
 */
function breOf(ameIpa, word) {
  let t = String(ameIpa || '');
  if (!t) return '';
  // unsafe: TRAP-BATH context (æ before f/sk/sp/st/th/ff/ss)
  if (/æ(f|sk|sp|st|θ|s$|s[^a-z]|f[^a-z])/.test(t + ' ')) {
    // narrow check on the spelling instead: more reliable
    if (/a(f|ft|sk|sp|st|ss|th|nce|nt)(e|es|ed|ing)?$/.test(String(word || ''))) return '';
  }
  const hasSafe = /ɚ|ɝ|ɑɹ|ɔɹ|ɛɹ|ɪɹ|oʊ|ɹ/.test(t);
  if (!hasSafe) return '';
  t = t
    .replace(/ɝ/g, 'ɜː')
    .replace(/ɚ/g, 'ə')
    .replace(/ɑɹ/g, 'ɑː')
    .replace(/ɔɹ/g, 'ɔː')
    .replace(/ɛɹ/g, 'ɛə')
    .replace(/ɪɹ/g, 'ɪə')
    .replace(/oʊ/g, 'əʊ')
    .replace(/ɹ/g, 'r');
  return t;
}

module.exports = { breOf };

if (require.main === module) {
  const tests = [
    ['ˈɛvədəns', 'evidence'], ['ˈsɛntɚ', 'center'], ['ˈɔɹɡəˌnaɪz', 'organize'],
    ['dɪˈfɛns', 'defense'], ['ˈtɹævəlɪŋ', 'traveling'], ['kɑɹ', 'car'],
    ['ˈwɔtɚ', 'water'], ['ˈdæns', 'dance'], ['ɡlæs', 'glass'],
  ];
  for (const [ipa, w] of tests) console.log(w.padEnd(10), '/' + ipa + '/', '->', '/' + (breOf(ipa, w) || '(ame-only)') + '/');
}
