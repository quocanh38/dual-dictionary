#!/usr/bin/env node
/* Shared word-list labeling for the 2,000-word pages (P1).
 *
 * Groups (from the P1 plan — "học chính" is framed by NGSL, NOT by the
 * OpenSubtitles frequency list; frequency bands and learning membership are
 * labeled distinctly and never conflated):
 *
 *   core        lemma word present in NGSL core/supplementary → learning set
 *   inflection  inflected form whose lemma exists in the dictionary; the page
 *               shows which lemma it belongs to (learning value follows the
 *               lemma's NGSL membership)
 *   off-list    fragments, abbreviations, proper nouns, and lemma words that
 *               NGSL does not cover — page stays live (2,003 URLs in GSC) but
 *               is labeled outside the learning set
 *   vulgar      profanity/sexual register — own warning label
 *
 * learning: 'active' (NGSL rank ≤ 1000 — nên chủ động sử dụng) or
 *           'recognition' (nên nhận biết) or null (no learning claim).
 */

const { IRREGULAR_LEMMA, lemmaCandidates } = require('./ipa-inflect.cjs');

/* explicit profanity/sexual-register list — keep in sync with editorial policy */
const VULGAR = new Set(['fuck', 'fucking', 'fucker', 'shit', 'bullshit', 'bitch',
  'bastard', 'ass', 'arse', 'asshole', 'crap', 'damn', 'dick', 'cunt', 'piss',
  'prick', 'whore', 'slut', 'pussy', 'wank', 'bollocks', 'motherfucker', 'goddamn',
  'dumbass', 'jackass', 'badass']);

/* bare interjections / letter fragments — 'a' (article) and 'i' (pronoun) are
 * real learning words and deliberately NOT here */
const FRAGMENTS = new Set(['b', 'c', 'd', 'e', 'f', 'g', 'h', 'j', 'k',
  'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z',
  'er', 'ow', 'oy', 'oh', 'ah', 'uh', 'mm', 'hmm', 'ha', 'da', 'em', 'um',
  'eh', 'psst', 'tsk', 'huh', 'duh', 'ew', 'eek', 'oops', 'blah', 'mr', 'mrs',
  'tv']);

/* OVDP entry phrasing that really says "this headword is a NAME" (see
 * classify-wordlist.cjs for the false-positive analysis) */
const PROPER_RE = /\(tên riêng\)|^\s*-\s*chỉ tên/m;

/* abbreviation entries: "(viết tắt)" — fbi, dna, tv… */
const ABBREV_RE = /\(viết tắt\)/;

/* NGSL rank of a word (core first, supplementary → recognition tier) */
function ngslRank(word, ngsl) {
  const w = String(word || '').toLowerCase();
  if (ngsl.core[w]) return ngsl.core[w];
  if (ngsl.supplementary.includes(w)) return 10000; // sup: no rank, recognition
  return null;
}

/* Group + learning label for a headword.
 * ctx: { allKeys:Set<string>, ngsl:{core,supplementary}, entryText?:string } */
function wordGroup(word, ctx) {
  const w = String(word || '').toLowerCase();
  const lemmaRank = (l) => (l ? ngslRank(l, ctx.ngsl) : null);

  if (VULGAR.has(w)) return { group: 'vulgar', learning: null, lemma: null };
  if (FRAGMENTS.has(w) || !/[aeiouy]/.test(w)) return { group: 'off-list', learning: null, lemma: null };

  // irregular inflection → page is a form of a lemma (learning follows lemma)
  const irregular = IRREGULAR_LEMMA[w];
  const lr = lemmaRank(irregular);
  if (irregular) {
    return {
      group: lr ? 'inflection' : 'off-list',
      learning: lr ? (lr <= 1000 ? 'active' : 'recognition') : null,
      lemma: irregular,
    };
  }

  // regular inflection: a rule candidate that is a dictionary key
  const dictLemma = lemmaCandidates(w).find((c) => ctx.allKeys && ctx.allKeys.has(c));
  const dlRank = lemmaRank(dictLemma);
  if (dictLemma) {
    return {
      group: 'inflection',
      learning: dlRank ? (dlRank <= 1000 ? 'active' : 'recognition') : null,
      lemma: dictLemma,
    };
  }

  // lemma word: NGSL membership decides the learning set
  const rank = ngslRank(w, ctx.ngsl);
  if (rank) {
    return {
      group: 'core',
      learning: rank === 10000 ? 'recognition' : (rank <= 1000 ? 'active' : 'recognition'),
      lemma: null,
    };
  }
  // v95: AWL headwords that NGSL does not cover are their own learning group
  // (NOT 'off-list' — they are precisely the academic learning targets)
  if (ctx.awl && ctx.awl.has(w)) return { group: 'academic', learning: null, lemma: null };
  return { group: 'off-list', learning: null, lemma: null };
}

module.exports = { VULGAR, FRAGMENTS, PROPER_RE, ABBREV_RE, ngslRank, wordGroup };