> **Dossier synchronization — 31 October 2026 (evening):** narrative is Offline Lesson Pipeline for working adults on flaky networks (OFFLINE-PIPELINE-2026-10-31.md). Live v154, cache mdx-dict-v152. FORM-ANSWERS project description cites shifts/sites/commutes. Main Studio demo and submission assets are tracked in docs/hackathon-submission/README.md. No new release, generation or learner study is implied by this documentation update.

# Hackathon new-work disclosure

## Production release update — v154/v153/v152 (31 October 2026 evening)

LIVE v154 — narrative switch to offline pipeline for working adults; cache `mdx-dict-v152` (shell text only). App banner + Studio hero reworded to workplace-English-where-network-drops (EN/VI); village.js overlay reworded to pipeline; dossier rewritten as OFFLINE-PIPELINE with adult-audience fit; form description cites shifts/sites/commutes. v153 — village path on main app (banner, offline/online badges, EN/VI i18n). v152 — Village Kit provenance overlay + weight audit (learner kit ~612KB). Smoke checks on production; new narrative verified live, old classroom story gone.

## Production release update — v151 (30 October 2026)

LIVE v151 — hero loop to top of main + 3-day reuse protocol; deploy id pending dashboard lookup, source `b152bc9f186cee08f114f04d4755c9ae2bba8c62`; service-worker cache `mdx-dict-v150` (unchanged). Hero loop is the first element of `<main>` on search/reader views; 3-day reuse protocol (`docs/learner-reuse-3day.md`) prepared as a proposed interim measurable signal; participant execution/results are not verified in this repository before the 4 Nov deadline, with the 7-day protocol retained as follow-up research.

## Production release update — v150 (30 October 2026)

LIVE v150 — P0 trust wording + Vietnamese labels + take-off exact-phrase priority; deploy `6ae40ee71d64556cb9adc628`, source `7b2efd655ca4f202cc6558015e6857a3992c061b`, published 30 October 2026 10:29 VN; service-worker cache `mdx-dict-v150`. Production inventory: 20,799 files, zero live-only/SHA/document drift; 39 local-only QA release-input records. Production HTTP smoke 7/7 on attempt 1; `data-i18n` coverage is 223/223 in EN+VI with estimated-coverage wording; Tutor failure stages offer Retry + Open AI settings + Cancel with a key/model preflight. IELTS feedback remains formative, not an official test or calibrated band diagnosis.

## Production release update — v149 (29 October 2026)

LIVE v149 — IELTS wave 10; deploy `6ae3188c4be8b59f21e381ff`, source `949ac4c2f13806a4b0a5b66aefbfbe013092a914`, published 29 October 2026 16:58:05 VN; service-worker cache `mdx-dict-v149`. Production inventory: 20,790 files, zero live-only/SHA/document drift; 39 local-only QA release-input records. Production HTTP smoke 7/7 on attempt 1; Practice exposes 800 formative IELTS items (200 per stage, 50 per skill per stage), and Lesson Studio reports Ready offline. Production browser checks pass. IELTS feedback remains formative, not an official test or calibrated band diagnosis.

Baseline: v143, commit `97767b54a66f7f0732e3923c70f92a9b165319d8`, committed 25 October 2026 at 21:18:38 +07:00. Local annotated tag `hackathon-2026-prekickoff-v143` was created on 27 October to reference that existing commit; tag creation is not evidence that the tag existed before kickoff. Branch `hackathon/offline-lesson-studio` starts from this baseline.

Pre-existing: browser MDX/MDD dictionary, Reader, local Vault, spaced review, live BYOK Tutor, authored no-key demo, exam practice and blog content. These are reused infrastructure, not new hackathon work.

New work started 27 October 2026: the `/lessons/` authoring/review/offline player module, strict versioned lesson packs, sentence grounding, explicit review/export gates, separate studio IndexedDB and request ledger, source/rights consent, usage/error/cancel controls, immutable pack installation, progress by version and the adapter for exact-meaning Vault saves. Reader gains a link; candidate service-worker cache advances v119→v120. Tests are in `tools/lessons/`; implementation and limitations in `docs/LESSON-STUDIO.md`.

Meta's substantive new role: select grounded phrases and generate draft closed exercises, explanations and a changed-situation writing task, before editorial review and offline distribution. The included authored fixture is not a provider result. Real pilot results and failed/ambiguous cases are retained separately; no model output is automatically approved.

The same hackathon work now also includes an offline IELTS Academic pathway: a 5.0 starting stage followed by 5.0→6.0, 6.0→6.5 and 6.5→7.0 practice stages; a 40-question Listening and 40-question Reading diagnostic with timed sections and a combined 90-minute option; and 800 original Meta practice items across Listening, Reading, Writing and Speaking. Each stage has 200 formative items (50 per skill), produced through wave 10. Final item hashes passed cross-model GPT review. Short-form Reading texts are labelled as practice passages, not full IELTS passages. The score guidance uses raw results and reference marks to suggest a next stage; it is not an official IELTS test, calibrated band diagnosis or band guarantee. Linear Thinking is used as a teaching scaffold, not as a taxonomy.

The offline Lesson Studio library has grown to 33 approved packs under the recorded delegated AI-assisted editorial process. Each pack has exact-hash cross-model evidence; the set passed 66 clean/preseeded browser QA contexts and 33 offline catalogue-install checks. These are emulated release checks, not independent human review or learner-outcome evidence. CEFR labels are estimates, source-rights records are declarations, and no learning efficacy is claimed. Evidence, remaining limitations and the current release state are maintained in `docs/lesson-studio-evidence/` and `docs/deploy-state.md`.

The earlier v143 demo is historical baseline evidence. The submission demo must show and identify this new work. No private dictionary data, API keys or learner records belong in the public repository. Preserve prior licences/NOTICE for reused code/data.

## Historical v150 provider-routing implementation (29 October 2026)

Lesson Studio creation requests use Baseten Muse Spark Open; one optional repair
per draft uses a selectable Meta Model API text model. Provider and model are
recorded with request evidence, while keys remain tab-memory only. The CLI batch
route uses Baseten and the repair route uses `DD_META_KEY` / optional
`DD_META_MODEL`; the local budget ledger estimates Baseten only and does not
assign a price to Meta usage. Codex's user-level configuration is set to
Meta Model API / Muse Spark 1.3 by default, with profiles for other supported
Meta text models and GPT review models. This paragraph originated as a local candidate note. The v150/v151 release records above supersede that status; the two-provider routing was observed on production Studio on 31 October.
