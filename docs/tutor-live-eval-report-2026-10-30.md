# Tutor evaluation — current results and historical runs, 30 October 2026

**Current summary, reconciled 31 October:** the production-cap live resweep scored 24/24 verdict matches and 24/24 quote-valid checks, with 24 successful responses. Thirteen authored cases require a quote; nineteen feedback outputs contain non-empty quotations. Explanation-quality scored: 0. Cases are AI-authored, not independently human-certified; no learner-outcome claim follows. The 900-token failed sweep and its probe remain below. This evaluates reused Tutor feedback, not Studio lesson-pack quality.

## Historical offline preparation snapshot

The inventory and no-live-call statements in the next sections describe the original offline preparation, before the later live runs; they are not the current aggregate status.

## What exists
- Authored cases: **24** in `tools/tutor-live-eval-cases.js` — the original 6 plus
  18 added 30 Oct (`wrong-sense`, `wrong-register`, `third-person-s`,
  `wrong-preposition`, `empty-answer`, `too-short`, `off-topic-redirect`,
  `wrong-tense`, `correct-formal`, `subject-verb`, `pronoun-placement`,
  `correct-separable`, `missing-detail-2`, `correct-detail`, `confused-phrase`,
  `correct-part`, `spelling-slip`, `correct-informal`). All 24 pass
  `tutor-live-eval-check.mjs` (unique ids, required P2 cases, quote flags,
  denominator contract).
- Runner UI: `tools/tutor-live-eval.html` (consent-gated, key never exported in report).
- Offline checks PASS in this session:
  - `tools/tutor-live-eval-check.mjs` — case coverage + separate
    case/call/response/verdict/quote/explanation/latency/error denominators.
  - `tools/tutor/ai-client-check.mjs` — provider error mapping (401/403 key-or-access,
    400 request/model, 402 billing, 429 rate-limit, timeout/CORS/JSON).

## What was NOT done (do not claim)
- No live Tutor feedback was requested; verdict-match rate, quote-valid rate,
  false-correction rate, and hallucinated-quote rate are all unmeasured.
- The 6 cases are AI-authored fixtures, not human-certified English judgments.
- No learner-outcome or retention claim follows from this report.

## How to run the live part (owner-authorized, own key, small paid requests)
1. Open `tools/tutor-live-eval.html`, paste your own provider key (stays in browser).
2. Run each of the 6 cases with separate consent; export the JSON report.
3. Score per case: expected verdict matched? quote present and exact when required?
   explanation specific to the answer (1–5)? elapsed ms? error category if failed?
4. Publish results as `docs/lesson-studio-evidence/tutor-live-eval-YYYY-MM-DD/report.json`
   with model/provider IDs and the exact denominators above — including failures.

## Live sweep B — 30 Oct 2026 ~11:57 VN (24/24 attempted, 0 scored)
- Runner: `tools/tutor-live-eval-run-24case-sweep.mjs` (continue-past-error, no
  per-case retry, caps $0.05/call + $0.30 total, same model `muse-spark-1.3` and
  prompt). Raw: `docs/lesson-studio-evidence/p2-evaluation-2026-10-27/meta-live-run-24case-sweep-2026-10-30.json`.
- Denominators: authored 24 / attempted 24 / calls 24 / success 0 / verdict 0 /
  quote 0 / latency samples 24 (~3.5–6.5s each) / errors 24 × `invalid-format`.
  Spend ≈ $0.104 estimated (unbilled), no key or learner data in the artifact.
- Failure signature (all 24 identical): `outputTokens` exactly 900 (= the
  `max_tokens` cap) with empty/non-string message content, so validation fails
  before verdict/quote scoring. Contrast: the earlier same-model run
  (`meta-live-run-corrected.json`) scored 5/6 with 1434 output tokens on case 0.
  Root cause PROVEN by probe (`tools/tutor-probe-maxtokens.mjs`,
  `probe-maxtokens-2000-2026-10-30.json`, ~$0.01): same case with max_tokens=2000
  returns HTTP 200, finish_reason `stop`, and valid feedback JSON
  (`verdict: correct`, 214 chars) — while billing 1753 completion tokens for it.
  The model spends ~1700 hidden reasoning tokens per feedback, so the 900-token
  eval cap starved it on all 24 calls. Runner artifact, NOT a model failure.
- Production is NOT affected: `js/ai-client.js` sends `max_tokens: 32768` for the
  Meta provider. The 0/24 sweep measures the eval harness's too-tight cap, and
  must be re-run with production-identical bounds before any verdict/quote rate
  is quoted. Re-sweep cost ≈ $0.15 (billing follows actual tokens, not the cap).
- Honest reading: format-compliance of this model+prompt+cap combo is 0/24.
  No verdict-match, quote-valid, or learning claim follows. The Tutor production
  path shares this prompt; a response-shape log + repair/retry step is now a
  known product gap, not a silent pass.

## Expansion status (authored 30 Oct; live runs executed with the above result)
- Inventory is now 24 cases as planned above. Remaining before any Impact claim:
  independent English-proficient review of all 24 cases, then owner-authorized live
  runs with separate denominators (verdict-match, quote-valid, false-correction,
  hallucinated-quote rates) — including failures.
- Each new case carries: phrase, source sentence, prompt, answer, expected verdict
  set, quoteRequired flag.

## Live resweep — 30 Oct 2026 ~14:03 VN (24/24 scored, production-identical cap)
- Runner: `tools/tutor-live-eval-run-24case-resweep.mjs` (same harness as sweep B,
  only change: `max_tokens` 900 → 32768, matching `js/ai-client.js` Meta path).
  Raw: `docs/lesson-studio-evidence/p2-evaluation-2026-10-27/meta-live-run-24case-resweep-32768-2026-10-30.json`.
- Denominators: authored 24 / attempted 24 / calls 24 / success 24 / verdict
  scored 24 / verdict matched 24 / quote scored 24 / quote valid 24 /
  explanation-quality scored 0 / latency samples 24 (5.9–13.9s each) / errors 0.
  Spend ≈ $0.205 estimated (unbilled, under the $0.30 cap), no key or learner
  data in the artifact.
- Honest reading: verdict-match 24/24 and quote-valid 24/24 on AI-authored
  fixtures with the production token bound. This confirms the sweep-B 0/24 was a
  harness cap artifact, not a model failure. Still NOT claimed: explanation
  quality (unscored, needs rubric + human review), false-correction and
  hallucinated-quote rates on adversarial cases, or any learner-outcome effect.
  Next: independent English-proficient review of the 24 fixtures, then adversarial
  expansion before any Impact claim.
