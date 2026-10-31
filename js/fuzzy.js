/* fuzzy.js — "did you mean" suggestion engine (v111, docs/plan-p2-fuzzy-practice.md).
 *
 * Pure functions, no DOM and no I/O: loaded as a plain <script> (window.DSFuzzy,
 * before app.js) and requireable in Node so the algorithm has real unit tests.
 * Runs ONCE per failed lookup (never per keystroke — that is suggest()'s job):
 * cheap prefilter first, then a banded Levenshtein with early exit.
 *
 * Sources, in rank order:
 *   built   — data/built-words.json rows [word, band('1k'..'10k'|'awl'|''), ngslRank, awlSublist]
 *   keyLists — the allKeys arrays of every loaded dictionary (covers words we have
 *              no page for; ranked after built words)
 * A query shorter than 3 characters never gets suggestions; the edit-distance
 * budget is 1 for 3–4 character queries and 2 from 5 characters up — loose
 * enough to catch "aple"/"calld", tight enough to keep the list honest. */
(function (root) {
  'use strict';

  /* Levenshtein distance, pruned: anything above `max` is reported as max+1.
   * Row-minimum early exit keeps the miss path well under a frame budget even
   * against the ~386k OVDP keys. */
  function levBounded(a, b, max) {
    if (a === b) return 0;
    const m = a.length;
    const n = b.length;
    if (Math.abs(m - n) > max) return max + 1;
    if (!m) return n <= max ? n : max + 1;
    if (!n) return m <= max ? m : max + 1;
    let prev = new Array(n + 1);
    let cur = new Array(n + 1);
    for (let j = 0; j <= n; j++) prev[j] = j;
    for (let i = 1; i <= m; i++) {
      cur[0] = i;
      let rowMin = cur[0];
      const ca = a.charCodeAt(i - 1);
      for (let j = 1; j <= n; j++) {
        let v = prev[j] + 1;
        const up = cur[j - 1] + 1;
        if (up < v) v = up;
        const diag = prev[j - 1] + (ca === b.charCodeAt(j - 1) ? 0 : 1);
        if (diag < v) v = diag;
        if (v > max) v = max + 1; // band: past-threshold cells never matter again
        cur[j] = v;
        if (v < rowMin) rowMin = v;
      }
      if (rowMin > max) return max + 1;
      const t = prev; prev = cur; cur = t;
    }
    return prev[n] <= max ? prev[n] : max + 1;
  }

  const BAND_ORDER = { '1k': 1, '2k': 2, '3k': 3, '4k': 4, '5k': 5, '6k': 6, '7k': 7, '8k': 8, '9k': 9, '10k': 10, 'awl': 11, '': 98, 'zzz': 99 };
  function bandRank(b) { return BAND_ORDER[b] || 98; }

  /* Ranked suggestions for a misspelled query (max edit distance by length).
   * opts.limit (default 3), opts.exclude (array of words never to offer — the
   * fallback entry already on screen, phrase-banner close matches, …). */
  function suggestFor(query, built, keyLists, opts) {
    opts = opts || {};
    const limit = opts.limit || 3;
    const exclude = new Set((opts.exclude || []).map((w) => String(w).toLowerCase()));
    const q = String(query || '').toLowerCase().trim();
    if (q.length < 3 || q.includes(' ')) return [];
    const max = q.length >= 5 ? 2 : 1;
    const seen = new Set();
    const scored = [];
    const consider = (word, band) => {
      if (!word) return;
      const k = String(word).toLowerCase();
      if (k === q || seen.has(k) || exclude.has(k)) return;
      if (Math.abs(k.length - q.length) > max) return;
      // cheap prefilter: same first letter, or the query sits inside the key
      if (k.charCodeAt(0) !== q.charCodeAt(0) && k.indexOf(q) === -1) return;
      const d = levBounded(q, k, max);
      if (d > max) return;
      seen.add(k);
      scored.push({ word: String(word), dist: d, band: band });
    };
    if (built && built.length) {
      for (let i = 0; i < built.length; i++) consider(built[i] && built[i][0], built[i] && built[i][1]);
    }
    if (keyLists) {
      for (let li = 0; li < keyLists.length; li++) {
        const keys = keyLists[li];
        if (!keys) continue;
        for (let i = 0; i < keys.length; i++) consider(keys[i], 'zzz');
      }
    }
    scored.sort((x, y) => x.dist - y.dist || bandRank(x.band) - bandRank(y.band) || (x.word < y.word ? -1 : x.word > y.word ? 1 : 0));
    return scored.slice(0, limit).map((s) => s.word);
  }

  const DSFuzzy = { levBounded: levBounded, suggestFor: suggestFor };
  if (typeof module !== 'undefined' && module.exports) module.exports = DSFuzzy;
  else root.DSFuzzy = DSFuzzy;
})(typeof window !== 'undefined' ? window : globalThis);
