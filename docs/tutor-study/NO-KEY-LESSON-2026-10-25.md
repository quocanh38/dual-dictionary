# No-key authored lesson — local candidate, 25 October 2026

v143 release candidate; owner authorized deployment on 25 October. App-shell cache is mdx-dict-v119. Exact deploy ID and post-deploy verification are recorded in docs/deploy-state.md after publication.

The sample at demo/tutor.html now offers read → choose one of two phrases → multiple-choice authored exercise → save an actual Vault card → reveal the persisted meaning in an ungraded recall step → completion. Only completion introduces the optional live Meta Tutor, with BYOK/network/consent/cost disclosure and a Reader passage handoff.

Content and answer keys are explicitly authored. No free-form answer is falsely evaluated and no API request is made. Card definitions combine an English meaning and Vietnamese gloss; context retains the selected source sentence and provenance says not AI. Existing IndexedDB store APIs are reused. Stable lesson IDs and sense identities make duplicate clicks/replays idempotent without resetting a reviewed card. Lesson progress uses a separate localStorage key; restarting does not remove Vault data. The legacy illustrative sample key is untouched.

The recall step reads back the actual persisted card. It does not grade FSRS; the learner can open regular Review and explicitly grade there. A missing/deleted card returns to saving. Storage errors do not advance the lesson and allow retry. Reload preserves the stage and exercise answer; revealing after reload reads the saved card again.

The lesson registers the root service worker for direct first visits; its HTML/module are precached. An initial successful online load remains necessary. Reader links to “Start a free offline lesson”.

## Verification

`tools/tutor/offline-lesson-check.cjs` passed in system Chrome at 1280px and 390px: empty/wrong/correct answers, progress reload, actual service-worker offline reload, saved meaning, double clicks, replay deduplication/preserved schedule, regular Review reveal and explicit grade, both phrase options, deleted-card recovery, Reader handoff, no key configuration, zero AI POST requests and zero page errors. Separate storage-failure/retry test passed.

Tutor validation/content and quality-contract suites passed. Updated UX smoke covers the real lesson instead of the removed illustrative flow. Evidence retained in the task outputs/no-key-lesson directory. These are browser checks, not physical-phone or learner studies.

Release gate: owner authorized deployment in the subsequent turn. Before publishing use the canonical deploy-state runbook and full-snapshot checks. Existing v142 video/submission dossier describe v142; after a new release update their no-key sample description and provenance, and record a new demo if needed. All work dated 25 October is pre-kickoff under the currently published schedule.

## Production verification

v143 — authored no-key lesson; deploy `6ade0fc253dcbda23e357759`, source `97767b54a66f7f0732e3923c70f92a9b165319d8`, published 25 October 2026 21:19:09 VN; cache `mdx-dict-v119`. Production no-key lesson 1280/390, offline Vault/Review, storage failure/retry PASS; zero AI calls. HTTP 7/7 ×3 on production and pinned snapshot; Chrome 7/7 zero page errors. Full post-deploy hash parity PASS: 18,629/18,629 published files match source; .gitignore is intentionally source-only. Initial inventory timeouts were resolved by allowing the slow transfer to finish. Blog retained.

Post-deploy records remain local until a later authorized release; no docs-only redeploy. Existing v142 video and submission archive remain versioned evidence for v142, not a v143 demo.
