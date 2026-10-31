# Expanded Meta evaluation — 2026-10-25

Baseline v141 frozen at 2dfaa2314bf886fc3c07c42961a3fc2e3326e345 remains immutable. The originally ambient key returned 24 HTTP 402 responses; the owner then supplied the designated working key (not stored in source/artifacts).

Real muse-spark-1.3 baseline: 24 dev then 16 holdout, unchanged prompts. 39/40 valid responses, one HTTP 502 (F10), 30/31 accepted verdicts, 31/31 quote checks, 13/13 received natural correct cases recognized. F27 overcorrects a valid pronoun phrasal-verb sentence; F14 offers an awkward do careful practice construction. The original falseCorrection metric only covered singleton correct gold; a separate audit explicitly counts F27.

Candidate feedback instructions avoid declaring missing context an English error, accept valid pronouns/phrasal verbs or ask for clarification, and request complete idiomatic corrected sentences. All 40 fixtures and validator unchanged. Re-run is exposed regression, NOT fresh holdout. 40/40 valid; 32/32 verdict/evidence checks; 14/14 natural correct recognized; F27 now uncertain, F14 a natural full sentence. Agent reviewed all outputs; no independent human reviewer, no fabricated human scores. Four meaning cases and four contexts are appropriate in agent review, with minor phrasing/usefulness notes recorded. Candidate median 8.6715s; p95 nearest-rank 15.421s. No general accuracy or learning-outcome claim.

35 extended Chrome reliability checks, related race/API-flow/offline regressions and updated quality contracts PASS. Focus recovery after stage replacement implemented. Real UI baseline 3 calls PASS. Candidate UI first harness used an off-topic fixed answer for a dynamically generated prompt; correct rejection retained as a harness FAIL. Resume/revise with an on-topic authored answer (one new call) then correct/save/reload PASS. No page errors.

Outstanding: independent English reviewer, physical phone test, new unseen cases if a fresh benchmark is needed after tuning. Source is an uncommitted local candidate; no deploy/push. The original v141 baseline and tag are unchanged.

Full artifacts: /Users/nguyenquocanh/Documents/Codex/2026-10-24/n-u-m-c-ti-u/outputs/TUTOR-DANH-GIA-VA-QA-2026-10-25.md
