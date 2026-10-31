# Tutor implementation status — 2026-10-23

## LIVE v143 — authored no-key lesson; deploy `6ade0fc253dcbda23e357759`, source `97767b54a66f7f0732e3923c70f92a9b165319d8`, published 25 October 2026 21:19:09 VN; cache `mdx-dict-v119`. Production no-key lesson 1280/390, offline Vault/Review, storage failure/retry PASS; zero AI calls. HTTP 7/7 ×3 on production and pinned snapshot; Chrome 7/7 zero page errors. Full post-deploy hash parity PASS: 18,629/18,629 published files match source; .gitignore is intentionally source-only. Initial inventory timeouts were resolved by allowing the slow transfer to finish. Blog retained.


Implemented in local branch: due-date ranking alongside confirmed errors; save drafts while typing; correct cache read/write key mismatch; precache authored guided sample and new modules; link sample from Reader. Existing core supports source checks, optional BYOK, feedback decisions, retry, Vault and tutor backup/import/delete.

Verification: tools/tutor/check.mjs PASS for grounding, feedback quote rejection, uncertain verdict, cache round-trip/article/model isolation and due/error ranking. app.js module syntax and sw.js syntax PASS.

Prepared: authored no-key offline walkthrough, anonymous study protocol, manual reliability checklist and video storyboard. The authored sample is not represented as a real cached model output and does not grade arbitrary user input.

Not completed: live Meta browser E2E/CORS/model validation (requires owner-configured current key), full reliability browser matrix including migration/mobile/backup and reload, captured real model demo/cache, actual recorded video, recruitment and completed 5–8-person study with 24-hour follow-up. No participant results, model outputs or video footage fabricated. No outreach, commit, push or production deployment performed.

Run checks from repo root: node tools/tutor/check.mjs. Use a Node runtime in PATH or the bundled Codex Node path.

## Reliability follow-up — 2026-10-24

Local reliability fixes and automated regression suites completed. See RELIABILITY-2026-10-24.md for the current evidence and limits; the 2026-10-23 paragraph above is historical. Current run passes API-client checks, request/storage race checks, sense identity checks, Tutor/Writing/Speaking mock-provider browser E2E, actual offline cache/reload at desktop/mobile widths, and JSON/encrypted backup round trips. No deployment or real-provider AI quality assessment was performed in this follow-up.

## Live Meta quality review — 2026-10-24, after v140

Executed 4 diagnostic feedback cases and 6 production Tutor feedback cases with muse-spark-1.3 using authored data and the existing browser configuration. Diagnostic verdicts 4/4 match; quote requirement 3/4; API errors 0/4; latency 7.614–10.685s, median 9.3585s. Production cases cover grammar, corrected answer, off-topic/incomplete answer, embedded instructions, and passive-form acceptance. Three findings: selection rationale mislabeled as meaning; missing-quote handling needs a unified policy; retry often repeats the same context. This is an exploratory small set, not a benchmark or proof of learning impact. Full review: LIVE-EVALUATION-2026-10-24.md. Raw JSON and screenshots are saved in the current Codex task outputs, not copied to the production bundle. No code change or deploy in this evaluation.

## Quality fixes after live evaluation — 2026-10-24

Implemented separate meaningVi/selectionReason and legacy no-meaning save guard; shared production/evaluator feedback prompt with missing-quote downgrade and no confirmed-error logging; separate same-answer revision from consent-gated fresh-context generation, with old prompt/answer preserved on cancel or invalid response. New contract tests, reliability/core regressions, mock-provider browser flow and real offline-cache browser checks PASS. Cache candidate v117 includes tutor-prompts.js. Not deployed and not retested against real Meta with these new prompts. Details: QUALITY-FIXES-2026-10-24.md.

## v141 deployed and reevaluated with real Meta — 2026-10-24

v141 source 2dfaa2314bf886fc3c07c42961a3fc2e3326e345, deploy 6adcb8b6e0d1eb6090ca3699, cache v117: production HTTP 7/7 ×3, Chrome 7/7 no errors, parity 18,617/18,617. Real muse-spark-1.3 diagnostic: 4/4 verdict matches and 4/4 quote requirements (previous run 3/4 quotes); no API errors, 6.368–8.188s, median 7.488s. Live app verified three semantic glosses, separate selection rationale, study→workplace→community scenarios, three appropriate feedback responses including passive-form acceptance, and correct Vietnamese meaning in Vault after reload. 11 authored-data provider calls in total; no general accuracy or learning-impact claim. One suggested correction still uses awkward do careful practice wording. Missing-quote downgrade did not trigger on new live outputs; its evidence remains automated tests. Details: V141-LIVE-REEVALUATION-2026-10-24.md. Raw results/screenshots are in this Codex task outputs.

## Pre-kickoff baseline and expanded fixtures — 2026-10-25

Local tag hackathon-2026-prekickoff-v141 pins 2dfaa2314bf886fc3c07c42961a3fc2e3326e345. Source archive and per-file SHA-256 manifest verified. Expanded v1 has 40 authored cases (24 dev / 16 holdout), all NOT_RUN, frozen baseline prompts/validators and explicit reviewer rubric. Mechanical runner validation passed with zero real API calls. See BASELINE-EVAL-PLAN-2026-10-25.md and current chat outputs. No push or deployment.

## Expanded QA and dev attempt — 2026-10-25

35 additional Chrome checks PASS at 1280/390: schema v1–v5→v6 preserving data/due/backups, legacy migration idempotence, reload across Tutor stages and in-flight requests without replay, double actions and keyboard. Fixed focus falling to BODY after stage replacement; candidate only, not deployed. Relevant reliability, AI-flow and real-service-worker offline regressions PASS. Initial 24 dev calls received HTTP 402; 16 holdout untouched and no model quality scored. User supplied designated key for a fresh attempt; see current outputs for that result. Independent English reviewer and physical device remain unavailable. Full evidence: EXTENDED-QA-2026-10-25.md.

## Expanded Meta follow-up with designated working key — 2026-10-25

Supersedes the 402-only interim status above. Baseline 40 real calls: 39 valid, one 502, 30/31 verdict matches and 31/31 quotes; overcorrection on F27 and awkward F14. Candidate prompt fixes both; exposed regression 40/40 valid, 32/32 verdict and evidence, 14/14 natural correct recognized; no false definite corrections detected. Four gloss/context cases each reviewed by agent. Original fixtures, source baseline and raw failure history preserved. Updated evaluator fails fast on access/billing/rate limits. Local code now contains focus and feedback-prompt fixes; no commit/push/deploy. English reviewer and real phone remain unavailable. See EXPANDED-META-EVALUATION-2026-10-25.md and EXTENDED-QA-2026-10-25.md.

## Cross-model review and mobile emulation alternative — 2026-10-25

Completed user-selected alternative with GPT-6 Astra two-phase blinded/partly blinded AI review (40 cases, 31/32 verdict agreement; 5 minor revision cases, no major issue flagged) and 39 system-Chromium emulation checks across three phone profiles. Candidate app/prompt hashes unchanged, no further Meta calls or deploy. One minor viewport/sticky-close UX observation retained. Human review, native keyboards/iOS Safari and physical devices remain untested; do not rename AI review or emulation as those checks. See CROSS-MODEL-AND-MOBILE-2026-10-25.md.

## v142 release candidate — 2026-10-25

Owner authorized deployment and demo recording. Reserved Tutor header fixes sticky-close overlap; prompt instructions address five cross-model revision items. Raw Meta F27 overcorrection remains possible, so final validator adds a conservative context-only uncertainty guard; browser test verifies no confirmed error after accept. 10 targeted real Meta requests returned valid output; do not call all raw verdicts correct. Mobile 39 checks, AI-flow guard, core contracts/reliability and release gates PASS. SW v118. Post-deploy identity and demo evidence follow. See V142-RELEASE-2026-10-25.md.

## v142 production verified — 2026-10-25

Published 16:42:20 VN, deploy 6addcee0782eba4729379051, source 396bb7895018d6f77f62bca5f1051bbda138b02c, SW v118. Full committed snapshot parity 18,626/18,626, no drift/live-only/local-only. Production and unique snapshot HTTP 7/7 ×3 PASS; production Chrome 7/7 zero page errors. Demo recording and media verification are in the current task outputs. These post-deploy records are intentionally not another production push.

## v142 demo complete — 2026-10-25

Final 2:23 narrated MP4 and English SRT saved to current task outputs. Real production Meta flow (five responses) plus labeled saved-session pickup for local save/offline. Full video/audio decode and Chrome end-to-end playback PASS; per-chapter app-frame/audio checks and visual review complete. Source code remains deployed commit 396bb7895; only documentation changed after deploy. No external video publication.


## v143 demo supplement complete (25 October 2026)
New no-key production recording + explicitly labelled historical real Meta footage, 3:17, final decode/playback verified. See V143-DEMO-2026-10-25.md. No new API calls, no redeploy, no external video publication.
