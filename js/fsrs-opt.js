/* fsrs-opt.js — FSRS-4.5 personal weight optimizer (v71).
 *
 * The app schedules reviews with the DEFAULT FSRS-4.5 weights and logs every
 * grade (db.js `reviews` store, since v68). When that log is thick enough, this
 * module re-fits the 17 weights to the OWNER'S OWN history — entirely in this
 * browser (no server, nothing leaves the device), triggered only by the
 * explicit "Optimize" button in ⚙ Advanced.
 *
 * Objective: the official open-spaced-repetition one — binary cross-entropy of
 * predicted retrievability vs the actual know/forgot outcome, plus a small L2
 * pull toward the defaults so a thin or quirky log can never drag weights far.
 * State replay mirrors gradeById exactly (js/app.js): a first contact takes the
 * forgetting-curve branch with R(0)=0.995 (because `!lastReviewedAt` is true
 * then), later same-day re-reviews use the short-term branch.
 *
 * keep in sync with js/store.js (formulas, clamps, FSRS_W defaults) and
 * ui-check/fsrs-optimizer-smoke.js (which enforces exactly that parity).
 */

const FSRS_DECAY = -0.5;
const FSRS_FACTOR = 19 / 81;

export const DEFAULT_W = [0.4872, 1.4003, 3.7145, 13.8206, 5.1618, 1.2298, 0.8975,
  0.031, 1.6474, 0.1367, 1.0461, 2.1072, 0.0793, 0.3246, 1.587, 0.2272, 2.8755];

/* Bounds per parameter: the store.js functions clamp their OUTPUTS, but a
 * candidate weight vector itself must stay sane or the replay can produce
 * NaN (e.g. exp() blow-ups). Scaled to this app's rating set (1..3). */
const BOUNDS = [
  [0.01, 20], [0.01, 20], [0.01, 30], [0.1, 100], // w0-3 init stability
  [0.5, 10], [0.01, 5],                            // w4-5 init difficulty
  [0.01, 4], [0.01, 1],                            // w6-7 difficulty dynamics
  [0.01, 6], [0.01, 1], [0.01, 4],                 // w8-10 recall growth
  [0.01, 8], [0.001, 1], [0.01, 3], [0.01, 5],     // w11-14 forget stability
  [0.01, 2], [0.01, 5],                            // w15-16 short-term
];

const fsrsClamp = (x, lo, hi) => Math.min(Math.max(x, lo), hi);

export function applyClamps(w) {
  return w.map((x, i) => fsrsClamp(Number.isFinite(x) ? x : DEFAULT_W[i], BOUNDS[i][0], BOUNDS[i][1]));
}

/** The scheduler formulas, closed over a weight vector — mirrors store.js. */
export function mkFsrs(w) {
  const initStability = (rating) => Math.max(w[rating - 1] || w[2], 0.1);
  const initDifficulty = (rating) => fsrsClamp(w[4] - Math.exp(w[5] * (rating - 1)) + 1, 1, 10);
  const nextDifficulty = (d, rating) => {
    const linear = d - w[6] * (rating - 3);
    const mean = initDifficulty(3);
    return fsrsClamp(w[7] * linear + (1 - w[7]) * mean, 1, 10);
  };
  const retrievability = (s, elapsedDays) =>
    fsrsClamp(Math.pow(1 + FSRS_FACTOR * Math.max(elapsedDays, 0) / s, FSRS_DECAY), 0.005, 0.995);
  const recallStability = (d, s, r) => {
    const inc = 1 + Math.exp(w[8]) * (11 - d) * Math.pow(s, -w[9]) * (Math.exp((1 - r) * w[10]) - 1);
    return fsrsClamp(s * inc, 0.1, 3650);
  };
  const forgetStability = (d, s, r) => {
    const sf = w[11] * Math.pow(d, -w[12]) * (Math.pow(s + 1, w[13]) - 1) * Math.exp((1 - r) * w[14]);
    return fsrsClamp(Math.min(sf, s), 0.1, 3650);
  };
  const shortTermStability = (s, rating) =>
    fsrsClamp(s * Math.exp(w[15] * (rating - 3 + w[16] * 0.5)), 0.1, 3650);
  return { initStability, initDifficulty, nextDifficulty, retrievability, recallStability, forgetStability, shortTermStability };
}

/* ---------------- log parsing ----------------
 * gradeById records: { id, itemId, at (ms), rating (1|3), elapsedDays,
 * sBefore, dBefore, sAfter, dAfter } — s/d are null on an item's very first
 * review, real values on a Leitner-warmed first contact. Grouped by itemId,
 * sorted by `at`; malformed records are dropped. */

export function parseLog(records) {
  const byItem = new Map();
  for (const r of records || []) {
    if (!r || !r.itemId || !Number.isFinite(r.at) || ![1, 2, 3, 4].includes(r.rating)) continue;
    if (!Number.isFinite(r.elapsedDays) || r.elapsedDays < 0) continue;
    if (!byItem.has(r.itemId)) byItem.set(r.itemId, []);
    byItem.get(r.itemId).push(r);
  }
  const sequences = [];
  for (const [itemId, recs] of byItem) {
    recs.sort((a, b) => a.at - b.at);
    sequences.push({ itemId, records: recs });
  }
  return { sequences, items: sequences.length, points: sequences.reduce((n, s) => n + s.records.length, 0) };
}

/* ---------------- replay + loss ---------------- */

export function replay(seq, w) {
  const F = mkFsrs(w);
  const recs = seq.records;
  let s = null, d = null;
  let points = 0, bce = 0;
  for (let i = 0; i < recs.length; i++) {
    const r = recs[i];
    if (s === null) {
      if (Number.isFinite(r.sBefore) && r.sBefore > 0 && Number.isFinite(r.dBefore) && r.dBefore > 0) {
        s = r.sBefore; d = r.dBefore; // warmed first contact — a real loss point below
      } else {
        s = F.initStability(r.rating);
        d = F.initDifficulty(r.rating);
        const r0 = F.retrievability(s, 0);
        s = r.rating === 1 ? F.forgetStability(d, s, r0) : F.recallStability(d, s, r0);
        d = F.nextDifficulty(d, r.rating);
        continue;
      }
    }
    const elapsed = r.elapsedDays;
    // New logs record the exact branch; old logs use the scheduler day boundary.
    const longTerm = typeof r.longTerm === 'boolean' ? r.longTerm : elapsed >= 1;
    if (longTerm) {
      const pred = F.retrievability(s, elapsed);
      const y = r.rating > 1 ? 1 : 0;
      bce += -(y * Math.log(pred) + (1 - y) * Math.log(1 - pred));
      points++;
      s = y === 1 ? F.recallStability(d, s, pred) : F.forgetStability(d, s, pred);
    } else {
      s = F.shortTermStability(s, r.rating);
    }
    d = F.nextDifficulty(d, r.rating);
  }
  return { points, bce, s, d };
}

export function totalLoss(sequences, w, lambda) {
  let points = 0, bce = 0;
  for (const seq of sequences) {
    const r = replay(seq, w);
    points += r.points; bce += r.bce;
  }
  if (!points) return { bce: 0, points: 0, penalty: 0, total: 0 };
  let penalty = 0;
  for (let i = 0; i < w.length; i++) penalty += ((w[i] - DEFAULT_W[i]) / Math.max(1, DEFAULT_W[i])) ** 2;
  return { bce: bce / points, points, penalty: lambda * penalty / w.length, total: bce / points + lambda * penalty / w.length };
}

/* ---------------- training (Adam + central-difference gradient) ----------------
 * A few hundred reviews → a few thousand replay points; the numeric gradient
 * (17 params × 2 evals per step) costs milliseconds per iteration, so the
 * whole fit runs in well under a second even on a phone. */

export function train(sequences, opts) {
  const lambda = opts?.lambda ?? 0.1;
  const iters = opts?.iters ?? 250;
  const lr = opts?.lr ?? 0.03;
  let w = applyClamps(opts?.init ? opts.init.slice() : DEFAULT_W.slice());
  const evalLoss = (v) => totalLoss(sequences, v, lambda).total;
  const m = new Array(17).fill(0), v2 = new Array(17).fill(0);
  for (let t = 1; t <= iters; t++) {
    const g = new Array(17).fill(0);
    for (let i = 0; i < 17; i++) {
      const h = 1e-4 * Math.max(1, Math.abs(w[i]));
      const up = w.slice(); up[i] += h;
      const dn = w.slice(); dn[i] -= h;
      g[i] = (evalLoss(up) - evalLoss(dn)) / (2 * h);
    }
    for (let i = 0; i < 17; i++) {
      m[i] = 0.9 * m[i] + 0.1 * g[i];
      v2[i] = 0.999 * v2[i] + 0.001 * g[i] * g[i];
      const mh = m[i] / (1 - Math.pow(0.9, t));
      const vh = v2[i] / (1 - Math.pow(0.999, t));
      w[i] -= lr * mh / (Math.sqrt(vh) + 1e-8);
    }
    w = applyClamps(w);
  }
  const final = totalLoss(sequences, w, lambda);
  const base = totalLoss(sequences, DEFAULT_W, lambda);
  return { weights: w, bce0: base.bce, bce1: final.bce, total1: final.total, iters, lambda, points: final.points };
}

/* ---------------- synthetic log generator (self-test) ----------------
 * Simulates a user whose memory behaves per `trueW`, writing records in the
 * EXACT shape gradeById produces (ratings 1|3 only, s/d chains, null sBefore
 * on first contact, warm sBefore on Leitner-warmed items). Used by the smoke
 * test to prove parse → replay → train recovers known weights. */

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SRS_INTERVALS_DAYS = [1, 2, 4, 9, 20, 45]; // mirrors store.js (warm-start source)

export function generateSynthetic({ trueW = DEFAULT_W, nItems = 200, seed = 42, warmRatio = 0.2, now = Date.now() } = {}) {
  const F = mkFsrs(applyClamps(trueW));
  const rng = mulberry32(seed);
  const records = [];
  const DAY = 86400000;
  const t0 = now - 90 * DAY;
  for (let i = 0; i < nItems; i++) {
    const itemId = 'syn-' + i;
    const warm = rng() < warmRatio;
    const warmBox = 1 + Math.floor(rng() * 3); // Leitner box 1..3 at migration time
    const warmS = SRS_INTERVALS_DAYS[warmBox - 1];
    let at = t0 + rng() * 30 * DAY;
    let s = null, d = null, lastAt = 0, lastReviewedAt = 0;
    if (warm) {
      // a Leitner-era item: it "survived" warmBox steps before the first FSRS grade
      s = warmS; d = 4.8; lastReviewedAt = at - warmS * DAY; lastAt = lastReviewedAt;
    }
    const nReviews = 4 + Math.floor(rng() * 8);
    for (let k = 0; k < nReviews; k++) {
      const elapsedDays = k === 0 ? (warm ? (at - lastReviewedAt) / DAY : 0) : Math.max(0, (at - lastAt) / DAY);
      const rating = k === 0 ? (rng() < 0.7 ? 3 : 1)
        : (rng() < F.retrievability(s, elapsedDays) ? 3 : 1);
      const sBefore = k === 0 ? (warm ? warmS : null) : s;
      const dBefore = k === 0 ? (warm ? d : null) : d;
      // advance state exactly like gradeById (`!lastReviewedAt || elapsed>=1`):
      // a first contact inits from the rating then passes the forgetting-curve
      // branch with R(0)=0.995; later same-day reviews use short-term.
      if (s === null) {
        s = F.initStability(rating);
        d = F.initDifficulty(rating);
        const r0 = F.retrievability(s, 0);
        s = rating === 1 ? F.forgetStability(d, s, r0) : F.recallStability(d, s, r0);
      } else if (elapsedDays >= 1) {
        const r = F.retrievability(s, elapsedDays);
        s = rating === 1 ? F.forgetStability(d, s, r) : F.recallStability(d, s, r);
      } else {
        s = F.shortTermStability(s, rating);
      }
      d = F.nextDifficulty(d, rating);
      records.push({ id: itemId + ':' + Math.round(at), itemId, at: Math.round(at), rating,
        elapsedDays: Math.round(elapsedDays * 1000) / 1000,
        sBefore, dBefore, sAfter: s, dAfter: d });
      lastAt = at; lastReviewedAt = at;
      // schedule: the app's interval ≈ round(s) days; forgot → 10-minute drill
      at += rating === 1 ? 10 * 60000 + rng() * 3600000 : Math.max(1, Math.round(s)) * DAY * (0.8 + rng() * 0.4);
    }
  }
  return records;
}

/* ---------------- self-test ----------------
 * Throws on failure; returns a summary the smoke test prints. */

function assert(cond, msg) { if (!cond) throw new Error('SELF-TEST FAIL: ' + msg); }

export function validate() {
  // 1. parseLog shapes + determinism
  const recs = generateSynthetic({ nItems: 60, seed: 7, now: 1780000000000 });
  const { sequences, items, points } = parseLog(recs);
  assert(items === 60, `parseLog grouped ${items}/60 items`);
  assert(points === recs.length, `parseLog kept ${points}/${recs.length} records`);
  assert(sequences.every((s) => s.records.every((r) => r.rating === 1 || r.rating === 3)), 'synthetic ratings ∈ {1,3}');
  const warmed = sequences.filter((s) => Number.isFinite(s.records[0].sBefore));
  assert(warmed.length > 0, 'generator produced warm-start items');
  const recs2 = generateSynthetic({ nItems: 60, seed: 7, now: 1780000000000 });
  assert(JSON.stringify(recs) === JSON.stringify(recs2), 'generator deterministic per seed');

  // 2. a "fast forgetter" persona (memory weaker than default → smaller growth)
  const trueW = DEFAULT_W.slice();
  trueW[8] = 1.15; trueW[9] = 0.06; trueW[10] = 0.6; trueW[11] = 1.7; trueW[14] = 1.1;
  const log = parseLog(generateSynthetic({ trueW, nItems: 220, seed: 11, now: 1780000000000 }));
  const defDist = Math.hypot(...DEFAULT_W.map((x, i) => x - trueW[i]));

  const run1 = train(log.sequences, { lambda: 0.1, iters: 120 });
  assert(Number.isFinite(run1.bce1) && run1.bce1 > 0, 'finite positive BCE');
  const dist = Math.hypot(...run1.weights.map((x, i) => x - trueW[i]));
  assert(run1.bce1 <= run1.bce0, `training did not reduce BCE (${run1.bce0} → ${run1.bce1})`);
  assert(dist < defDist, `trained weights not closer to truth than defaults (${dist} vs ${defDist})`);

  // 3. same inputs → same result
  const run2 = train(log.sequences, { lambda: 0.1, iters: 120 });
  assert(Math.abs(run2.bce1 - run1.bce1) < 1e-12, 'training deterministic');

  // 4. more data → BCE keeps dropping (sanity, loose)
  const big = parseLog(generateSynthetic({ trueW, nItems: 500, seed: 13, now: 1780000000000 }));
  const run3 = train(big.sequences, { lambda: 0.05, iters: 120 });
  assert(run3.bce1 < run3.bce0, 'big-log run reduces BCE');

  return { bce0: run1.bce0, bce1: run1.bce1, dist, defDist, bigBce0: run3.bce0, bigBce1: run3.bce1, items: log.items, points: log.points, warmed: warmed.length };
}
