#!/usr/bin/env node
/* IPA inflection resolver — fixes the lemma-copy bug class in data/ipa-en.json.
 *
 * Bug being fixed: some inflected entries in ipa-en.json carry the LEMMA's IPA
 * instead of their own (bought:"baɪ" from buy, could:"kæn" from can, had:"hæv",
 * is:"bi", watches:"wɑtʃ", knives:"naɪf", feet:"fʊt"…). Verified live on the
 * word pages and the hub before v92. The dataset is NOT wrong across the board
 * (stopped/making/studied/used/needed/men/teeth all have correct per-form
 * entries), so the fix must be surgical, not a blanket rewrite:
 *
 *   1. DETECT a copy-bug: the word's stored IPA equals a plausible lemma's IPA.
 *   2. REPLACE it with, in order: (a) curated IRREGULAR_IPA, (b) a phonological
 *      derivation from the lemma IPA, (c) NOTHING — hide the IPA.
 *   3. Keep the dataset value whenever it differs from every lemma candidate
 *      (those are real per-form entries and are trusted).
 *
 * Notation matches the dataset: General American, no length marks (feel "fil",
 * run "ɹʌn", ɹ/ɚ/ɝ, oʊ, script ɡ). IRREGULAR_IPA values follow the same style.
 *
 * False-positive analysis for the detector: a word whose IPA legitimately
 * equals a lemma candidate's is either (a) an irregular identity verb
 * (cut/cost/put — but those take no suffix, so no lemma candidate exists) or
 * (b) covered by IRREGULAR_IPA above. Homographs with distinct IPA (left the
 * adjective vs left←leave, saw the tool vs saw←see, rose the flower vs
 * rose←rise) never collide because their real IPA differs from the lemma's.
 */

/* Lemma candidates for a (possibly inflected) word, most-likely first.
 * Superset of the app's U2 lemmaCandidates (js/app.js) plus -ves plurals and
 * the extended irregular map below — both needed for copy-bug detection. */
const IRREGULAR_LEMMA = {
  // be / have / do / modals
  is: 'be', am: 'be', are: 'be', was: 'be', were: 'be', been: 'be', being: 'be',
  has: 'have', had: 'have',
  does: 'do', did: 'do', done: 'do',
  could: 'can', would: 'will', should: 'shall', might: 'may', must: 'must',
  // irregular verbs
  went: 'go', gone: 'go',
  bought: 'buy', brought: 'bring', thought: 'think', caught: 'catch',
  taught: 'teach', fought: 'fight', sought: 'seek',
  made: 'make', said: 'say', says: 'say',
  took: 'take', taken: 'take', gave: 'give', given: 'give',
  got: 'get', gotten: 'get',
  came: 'come', saw: 'see', seen: 'see',
  became: 'become', overcame: 'overcome',
  forbade: 'forbid', forbad: 'forbid',
  knew: 'know', known: 'know', grew: 'grow', grown: 'grow', threw: 'throw',
  thrown: 'throw', flew: 'fly', flown: 'fly', drew: 'draw', drawn: 'draw',
  ran: 'run', began: 'begin', begun: 'begin', drank: 'drink', drunk: 'drink',
  sang: 'sing', sung: 'sing', swam: 'swim', swum: 'swim', rang: 'ring',
  rung: 'ring', sprang: 'spring', sprung: 'spring',
  ate: 'eat', eaten: 'eat', fell: 'fall', fallen: 'fall', shook: 'shake',
  shaken: 'shake', spoke: 'speak', spoken: 'speak', broke: 'break',
  broken: 'break', woke: 'wake', woken: 'wake', drove: 'drive',
  driven: 'drive', wrote: 'write', written: 'write', rode: 'ride',
  ridden: 'ride', rose: 'rise', risen: 'rise', froze: 'freeze',
  frozen: 'freeze', stole: 'steal', stolen: 'steal', chose: 'choose',
  chosen: 'choose', wore: 'wear', worn: 'wear', bore: 'bear', born: 'bear',
  swore: 'swear', sworn: 'swear', tore: 'tear', torn: 'tear', forgot: 'forget',
  forgotten: 'forget', forgave: 'forgive', forgiven: 'forgive',
  hid: 'hide', hidden: 'hide', bit: 'bite', bitten: 'bite',
  told: 'tell', sold: 'sell', sent: 'send', spent: 'spend', built: 'build',
  meant: 'mean', lent: 'lend', burnt: 'burn', bent: 'bend',
  felt: 'feel', kept: 'keep', slept: 'sleep', crept: 'creep', swept: 'sweep',
  wept: 'weep', left: 'leave', dealt: 'deal', met: 'meet', paid: 'pay',
  laid: 'lay', heard: 'hear', held: 'hold', led: 'lead',
  lost: 'lose', dug: 'dig', hung: 'hang', stuck: 'stick', struck: 'strike',
  stung: 'sting', swung: 'swing', clung: 'cling', flung: 'fling',
  spun: 'spin', won: 'win', shot: 'shoot', wound: 'wind', found: 'find',
  stood: 'stand', understood: 'understand', withstood: 'withstand',
  fled: 'flee', fed: 'feed', bled: 'bleed', sped: 'speed', lit: 'light',
  hurt: 'hurt', slid: 'slide',
  blew: 'blow', blown: 'blow',
  // irregular plurals
  men: 'man', women: 'woman', children: 'child', feet: 'foot', teeth: 'tooth',
  these: 'this', those: 'that',
  geese: 'goose', mice: 'mouse', lice: 'louse', oxen: 'ox', people: 'person',
  // comparatives / superlatives (better/best/worse/worst have own correct IPA
  // in the dataset — mapped here only so a future copy-bug gets caught)
  better: 'good', best: 'good', worse: 'bad', worst: 'bad', lesser: 'less',
  further: 'far', farther: 'far', furthest: 'far', farthest: 'far',
  elder: 'old', eldest: 'old',
};

/* Curated IPA for irregular forms — only for forms whose IPA CANNOT be
 * derived by rule from the lemma (vowel changes, suppletion). Values use the
 * dataset's GenAm-compact notation. Regular -s/-ed/-ing forms are NOT here. */
const IRREGULAR_IPA = {
  is: 'ɪz', am: 'æm', are: 'ɑɹ', was: 'wʌz', were: 'wɝ', been: 'bɪn',
  has: 'hæz', had: 'hæd',
  does: 'dʌz', did: 'dɪd', done: 'dʌn',
  could: 'kʊd', would: 'wʊd', should: 'ʃʊd', might: 'maɪt',
  went: 'wɛnt', gone: 'ɡɑn',
  bought: 'bɔt', brought: 'brɔt', thought: 'θɔt', caught: 'kɔt',
  taught: 'tɔt', fought: 'fɔt', sought: 'sɔt',
  made: 'meɪd', said: 'sɛd', says: 'sɛz', his: 'hɪz',
  took: 'tʊk', taken: 'ˈteɪkən', gave: 'ɡeɪv', given: 'ˈɡɪvən',
  got: 'ɡɑt', gotten: 'ˈɡɑtən',
  came: 'keɪm', saw: 'sɔ', seen: 'sin',
  became: 'bɪˈkeɪm', overcame: 'ˌoʊvɚˈkeɪm',
  forbade: 'fɚˈbæd', forbad: 'fɚˈbæd',
  knew: 'nu', known: 'noʊn', grew: 'ɡɹu', grown: 'ɡɹoʊn',
  threw: 'θɹu', thrown: 'θɹoʊn', flew: 'flu', flown: 'floʊn',
  drew: 'dɹu', drawn: 'dɹɔn',
  ran: 'ɹæn', began: 'bɪˈɡæn', begun: 'bɪˈɡʌn',
  drank: 'dɹæŋk', drunk: 'dɹʌŋk', sang: 'sæŋ', sung: 'sʌŋ',
  swam: 'swæm', swum: 'swʌm', rang: 'ɹæŋ', rung: 'ɹʌŋ',
  sprang: 'spɹæŋ', sprung: 'spɹʌŋ',
  ate: 'eɪt', eaten: 'ˈitən', fell: 'fɛl', fallen: 'ˈfɔlən',
  shook: 'ʃʊk', shaken: 'ˈʃeɪkən', spoke: 'spoʊk', spoken: 'ˈspoʊkən',
  broke: 'bɹoʊk', broken: 'ˈbɹoʊkən', woke: 'woʊk', woken: 'ˈwoʊkən',
  drove: 'dɹoʊv', driven: 'ˈdɹɪvən', wrote: 'ɹoʊt', written: 'ˈɹɪtən',
  rode: 'ɹoʊd', ridden: 'ˈɹɪdən', rose: 'ɹoʊz', risen: 'ˈɹɪzən',
  froze: 'fɹoʊz', frozen: 'ˈfɹoʊzən', stole: 'stoʊl', stolen: 'ˈstoʊlən',
  chose: 'tʃoʊz', chosen: 'ˈtʃoʊzən', wore: 'wɔɹ', worn: 'wɔɹn',
  bore: 'bɔɹ', born: 'bɔɹn', swore: 'swɔɹ', sworn: 'swɔɹn',
  tore: 'tɔɹ', torn: 'tɔɹn', forgot: 'fɚˈɡɑt', forgotten: 'fɚˈɡɑtən',
  forgave: 'fɚˈɡeɪv', forgiven: 'fɚˈɡɪvən',
  hid: 'hɪd', hidden: 'ˈhɪdən', bit: 'bɪt', bitten: 'ˈbɪtən',
  told: 'toʊld', sold: 'soʊld', sent: 'sɛnt', spent: 'spɛnt',
  built: 'bɪlt', meant: 'mɛnt', lent: 'lɛnt', bent: 'bɛnt',
  felt: 'fɛlt', kept: 'kɛpt', slept: 'slɛpt', crept: 'krɛpt',
  swept: 'swɛpt', wept: 'wɛpt', left: 'lɛft', dealt: 'dɛlt', met: 'mɛt',
  paid: 'peɪd', laid: 'leɪd', heard: 'hɝd', held: 'hɛld', led: 'lɛd',
  lost: 'lɔst', dug: 'dʌɡ', hung: 'hʌŋ', stuck: 'stʌk', struck: 'stɹʌk',
  stung: 'stʌŋ', swung: 'swʌŋ', clung: 'klʌŋ', flung: 'flʌŋ',
  spun: 'spʌn', won: 'wʌn', shot: 'ʃɑt', wound: 'waʊnd', found: 'faʊnd',
  stood: 'stʊd', understood: 'ˌʌndɚˈstʊd', withstood: 'wɪðˈstʊd',
  fled: 'flɛd', fed: 'fɛd', bled: 'blɛd', sped: 'spɛd', lit: 'lɪt',
  blew: 'blu', blown: 'bloʊn',
  // irregular plurals
  men: 'mɛn', women: 'ˈwɪmɪn', children: 'ˈtʃɪldrən', feet: 'fit',
  teeth: 'tiθ', geese: 'ɡis', mice: 'maɪs', lice: 'laɪs', oxen: 'ɑksən',
  people: 'ˈpipəl',
  // comparatives / superlatives
  better: 'ˈbɛtɚ', best: 'bɛst', worse: 'wɝs', worst: 'wɝst',
  lesser: 'lɛsɚ', further: 'ˈfɝðɚ', farther: 'ˈfɑɹðɚ',
  furthest: 'ˈfɝðɪst', farthest: 'ˈfɑɹðɪst', elder: 'ˈɛldɚ', eldest: 'ˈɛldɪst',
};

/* plausible lemma spellings of `word` (the word itself first) — same shape as
 * the app's U2 lemmaCandidates, plus -ves plurals */
function lemmaCandidates(word) {
  const w = String(word || '').toLowerCase().trim();
  const out = [];
  const push = (s) => { if (s && s.length >= 2 && out.indexOf(s) === -1) out.push(s); };
  push(w);
  if (IRREGULAR_LEMMA[w]) push(IRREGULAR_LEMMA[w]);
  if (w.length > 3 && w.endsWith('ied')) push(w.slice(0, -3) + 'y');
  if (w.length > 3 && w.endsWith('ed')) {
    const stem = w.slice(0, -2);
    push(stem); push(stem + 'e');
    if (/([bdfglmnprt])\1$/.test(stem)) push(stem.slice(0, -1));
    push(w.slice(0, -1));
  }
  if (w.length > 4 && w.endsWith('ing')) {
    const stem = w.slice(0, -3);
    push(stem); push(stem + 'e');
    if (/([bdfglmnprt])\1$/.test(stem)) push(stem.slice(0, -1));
  }
  if (w.length > 3 && w.endsWith('es')) push(w.slice(0, -2));
  // base words ending in -ss (boss, cross, press…) must NOT lose one s — no
  // English inflection maps X→Xss, and the stem key exists in the dataset only
  // as a reverse artifact, which produced boss→bɑsɪz live before the guard
  if (w.length > 2 && w.endsWith('s') && !w.endsWith('ss')) push(w.slice(0, -1));
  if (w.length > 4 && w.endsWith('ses')) push(w.slice(0, -2));
  if (w.length > 4 && w.endsWith('ves')) { push(w.slice(0, -3) + 'fe'); push(w.slice(0, -3) + 'f'); }
  return out.filter((c) => c.length >= 2 && c !== w);
}

/* ---- phonological derivation (regular inflections only) ---- */

const SIBILANT = new Set(['s', 'z', 'ʃ', 'ʒ', 'tʃ', 'dʒ']);
const VOICELESS_NONSIB = new Set(['p', 'k', 'f', 't', 'θ']);

// -s/-es allomorph: watches→wɑtʃɪz, bats→bæts, dogs→dɔɡz
function sAllomorph(li) {
  const f = li[li.length - 1];
  if (SIBILANT.has(f)) return li + 'ɪz';
  if (VOICELESS_NONSIB.has(f)) return li + 's';
  return li + 'z';
}

// -ed allomorph: stopped→stɑpt, needed→nidɪd, loved→lʌvd
function edAllomorph(li) {
  const f = li[li.length - 1];
  if (f === 't' || f === 'd') return li + 'ɪd';
  if (VOICELESS_NONSIB.has(f) || f === 's' || f === 'ʃ') return li + 't';
  return li + 'd';
}

/* Derive `word`'s IPA from lemma `lemma`'s IPA, IF the two spellings are in a
 * regular inflection relation. Returns null when the relation is irregular or
 * unknown — callers must hide rather than guess. */
function deriveIpa(word, lemma, lemmaIpa) {
  const W = String(word), L = String(lemma), li = String(lemmaIpa);
  if (!li) return null;
  const last = L[L.length - 1];
  // plural / 3rd person -s: bats, watches, studies, goes, boxes
  if (W === L + 's' || W === L + 'es' || (last === 'y' && W === L.slice(0, -1) + 'ies')) return sAllomorph(li);
  // past / participle -ed: stopped, loved, studied, used, wanted
  if (W === L + 'd' || W === L + 'ed' || (last === 'y' && W === L.slice(0, -1) + 'ied')) return edAllomorph(li);
  // progressive -ing: making, dying, running
  if (W === L + 'ing' || (last === 'e' && W === L.slice(0, -1) + 'ing') ||
      (L.length > 1 && last === 'e' && W === L.slice(0, -2) + 'ying')) return li + 'ɪŋ';
  // doubled final consonant: stopped, running, getting
  if (W === L + last + 'ed') return edAllomorph(li);
  if (W === L + last + 'ing') return li + 'ɪŋ';
  // f→v plural: knives, leaves, wolves, lives, wives — only when the lemma is
  // spelled with f/fe AND its IPA ends in /f/ (keeps regular -s words away).
  // The s-boundary is ambiguous (kniv|es, knive|s) — try both strips.
  const stemsV = [];
  if (W.endsWith('ves')) { stemsV.push(W.slice(0, -2), W.slice(0, -3)); }
  else if (W.endsWith('s')) stemsV.push(W.slice(0, -1));
  if (stemsV.some((s) => (L.endsWith('f') || L.endsWith('fe')) && li.endsWith('f') && s === L.replace(/fe?$/, 'v'))) {
    return li.replace(/f$/, 'v') + 'z';
  }
  return null;
}

/* Charset gate for IPA strings — dataset uses Unicode IPA letters + stress
 * marks only; anything else (digits, CMU leftovers, mojibake) fails. */
const IPA_CHAR_OK = /^[\p{L}\p{M}ᵻˈˌːʰ.\s-]+$/u;

/* Resolve the IPA to publish for `word` against the raw ipa map.
 * Returns { ipa, source, lemma, prev }:
 *   source: 'table' | 'derived' | 'dataset' | 'absent' | 'copybug-hidden'
 *   prev:   the raw dataset value (for the QA report), when it differed. */
function resolveIpa(word, ipaMap) {
  const w = String(word || '').toLowerCase().trim();
  const self = ipaMap[w] || '';
  const prev = self;
  const cands = lemmaCandidates(w).filter((c) => ipaMap[c]);

  // 1. copy-bug: stored IPA equals a plausible lemma's IPA
  if (w.length >= 3) {
    const lemma = cands.find((c) => self && self === ipaMap[c]);
    if (lemma) {
      if (IRREGULAR_IPA[w]) return { ipa: IRREGULAR_IPA[w], source: 'table', lemma, prev };
      const derived = deriveIpa(w, lemma, ipaMap[lemma]);
      if (derived) return { ipa: derived, source: 'derived', lemma, prev };
      return { ipa: '', source: 'copybug-hidden', lemma, prev };
    }
  }
  // 2. no copy-bug but the word has a curated irregular IPA — trust the table
  //    (covers short forms like is/am/are where detection is disabled)
  if (IRREGULAR_IPA[w] && IRREGULAR_IPA[w] !== self) {
    return { ipa: IRREGULAR_IPA[w], source: 'table', lemma: IRREGULAR_LEMMA[w] || null, prev };
  }
  return { ipa: self, source: self ? 'dataset' : 'absent', lemma: null, prev };
}

module.exports = { IRREGULAR_LEMMA, IRREGULAR_IPA, lemmaCandidates, deriveIpa, resolveIpa, IPA_CHAR_OK, sAllomorph, edAllomorph };

/* CLI: node ipa-inflect.cjs word1 word2 … — print resolutions for spot-checks */
if (require.main === module) {
  const fs = require('fs');
  const path = require('path');
  const ipa = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'ipa-en.json'), 'utf8'));
  const words = process.argv.slice(2).length
    ? process.argv.slice(2)
    : ['bought', 'could', 'had', 'is', 'was', 'were', 'been', 'least',
       'watches', 'knives', 'leaves', 'wolves', 'wives', 'goes', 'feet',
       'children', 'women', 'got', 'gotten', 'his', 'says', 'says',
       'stopped', 'making', 'studied', 'used', 'needed', 'wanted', 'men',
       'teeth', 'bats', 'boxes', 'colleagues', 'running', 'dying', 'gas',
       'bus', 'as', 'cut', 'thing', 'king'];
  for (const w of words) {
    const r = resolveIpa(w, ipa);
    console.log(w.padEnd(12), ('/' + (r.ipa || '—') + '/').padEnd(14),
      r.source.padEnd(15), r.lemma ? '(lemma: ' + r.lemma + (r.prev ? ', prev: ' + r.prev + ')' : ')') : '');
  }
}