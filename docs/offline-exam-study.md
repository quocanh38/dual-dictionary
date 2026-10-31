# Offline IELTS and TOEIC study tools

All answers, explanations, sessions, drafts, recordings and study statistics are processed locally in this browser profile. The optional BYOK Tutor remains a separate online feature.

## Versioned content packs

The pack schema is `STUDY_CONTENT_SCHEMA_VERSION` in `js/study-content.js`. Each pack declares a stable ID, semantic version, author, license/provenance, offline availability, exam skill coverage, exercises, and Writing/Speaking prompts. Each content item uses a stable unique ID and includes its exam, skill/task, prompt, and (for objective exercises) a supported response type plus answer key and explanation.

Supported response types:

- `choice`: options and a zero-based `answer` index.
- `audio-choice`: like `choice`, with one same-origin bundled audio file per option; audio assets are included in the Service Worker shell for offline playback.
- `short-answer`: a list of `acceptedAnswers`, normalized for case and whitespace.
- `gap-fill`: named `gaps`, each with a label and accepted answer variants.
- `matching`: named `pairs`, each with a prompt label and expected answer.

Use original or explicitly licensed material and preserve provenance in the pack metadata. `validateStudyContentPacks()` checks required fields, stable IDs, answer keys, supported response types and schema version at app startup. Keep existing IDs stable once learners have saved progress against them. Update the service-worker cache list/version when pack/module/assets change.

## Included authored starter pack

- IELTS Academic covers objective Listening and Reading samples and Writing Task 1/2 plus Speaking Parts 1–3 prompts.
- Every IELTS exercise and productive prompt is grouped into four practice stages: foundation around 5.0, 5.0 → 6.0, 6.0 → 6.5, and 6.5 → 7.0. These are authored practice targets, not calibrated item bands. The objective-question picker and Writing/Speaking prompts filter by selected stage.
- The pack now includes 800 original Meta Muse Spark practice items generated through Baseten: 200 per stage (50 per skill per stage, five per skill in each of ten waves). Waves 1–3 passed exact-file GPT-6-Luna / GPT-5.6-Terra review; waves 4–10 passed GPT-6-Luna / GPT-6.1-Sol review. Generation, repairs, editorial corrections and final hashes are retained in the IELTS batch evidence directories, including [wave 10](./lesson-studio-evidence/ielts-meta-batches-2026-10-29/wave-10/). The five-question Reading texts are short-form practice passages, not full IELTS passages. These items extend practice coverage but do not establish a learner's band.
- IELTS Academic has a separate 40-question-per-skill objective diagnostic: 40 Reading questions across three passages and 40 Listening questions across four parts. Learners can take Listening and Reading separately with 30/60-minute section timers, or complete both in a combined 90-minute session. The diagnostic ignores the selected pathway stage and suggests a next practice stage separately for each skill.
- The Listening diagnostic uses one browser-generated voice playback per part. Voices and pronunciation vary by device; this is not official IELTS audio or a calibrated mock. The result shows the raw score, compares it with IELTS-published average reference marks, and suggests practice only. It does not calculate an official or overall four-skill band.
- Linear Thinking is used as teaching guidance, not as a classification label. The Reading, Listening, Writing and Speaking scaffolds link to the app author's corresponding method articles. Writing and Speaking self-review uses the four IELTS criteria as reflection prompts only; it does not award a band.
- Academic Writing Task 1 process, line-graph and map prompts include original SVG visuals that are bundled into the Service Worker cache and remain available offline.
- TOEIC Listening & Reading samples cover Parts 1–4 Listening and Parts 5–7 Reading. Part 1 now has four short, locally bundled spoken statements attached to an original illustration; these are generated practice recordings, not official test audio. The other Listening samples use original scripts. TOEIC Speaking & Writing are separate tests and are not part of this L&R pack.
- Objective answers are marked on-device, explanations are shown, and wrong answers are saved to Vault for local FSRS review.
- The IELTS "Bài tiếp theo gợi ý" queue prioritizes due reviews, then unseen tasks, then optional extra review. Recent accuracy and practice volume help balance the four skills; questions sharing a passage/audio are assigned together. Wrong objective answers return after one day, then correct streaks use 3/7/14/30-day intervals. Writing/Speaking self-checks schedule formative review without estimating a band. Recommendations and assignment progress run locally; tie-breaks use a stable daily rotation, and unfinished assignments resume after reload.
- Practice mode gives feedback after each answer and excludes diagnostic questions. Timed pathway practice uses the selected stage. Diagnostic mode runs the authored 40-question skill set (30 minutes Listening, 60 minutes Reading) or both sets together (90 minutes); sessions store answers, section playback state and deadline, and resume after reload. Completed attempts show raw counts, review explanations and skill-specific stage suggestions.
- Writing/Speaking drafts and attempts remain local. The self-review checklist works offline. Optional formative AI feedback reuses the learner's BYOK provider settings and requires explicit per-request consent; only the task and typed response/notes are sent. Speaking recordings are never sent by this feature. The learner pays provider token charges. Feedback is not stored as an official rating and does not assign a band or scaled score.
- A saved user-provided listening file and transcript can be reopened locally. In-pack listening examples use authored transcripts; optional text-to-speech depends on installed browser voices.

## Scope and limits

This pack has a complete 40-question diagnostic for each IELTS objective skill, plus 400 additional objective practice questions and 210 formative prompts per productive skill. The extra Reading passages are short, five-question practice texts; together with the formative Writing/Speaking prompts, they do not make a complete four-skill mock. The Listening voice is synthesized by the browser, and original items have not been calibrated against official forms. GPT cross-review checks content and answer support; it does not award or predict a learner's band. The diagnostic recommendation is a practice-stage heuristic, not a predicted band. IELTS publishes average raw-score references and notes that exact boundaries vary by test version; the app displays those reference intervals rather than claiming an exact half-band conversion. TOEIC L&R remains a short starter bank (8 Listening and 8 Reading examples), with no scaled score. TOEIC Speaking/Writing are separate tests and are not included. Browser speech recognition may contact a browser vendor and is not guaranteed offline. No official questions, protected audio, or commercial dictionary material are bundled.

The curriculum route is IELTS Academic 5.0 → 6.0 → 6.5 → 7.0. Its design notes, method-source crosswalk to the app author's blog, and diagnostic limitations are documented in [the IELTS Academic roadmap](./ielts-academic-roadmap-5-0-to-6-5.md). The stages do not imply a predicted band or admissions guarantee.

## Optional AI feedback for Writing and Speaking

1. Configure a provider, model, endpoint and API key under Advanced → Learning. The app does not ship a key; token charges go directly to the selected provider.
2. Write an answer or enter a Speaking transcript/notes. Recording playback stays local; the AI feature does not upload the recording.
3. Expand Optional AI feedback, read the exact data-sharing note, check consent, then request feedback. Without consent the request does not run. The request is limited to the prompt and up to 6,000 characters of typed response.
4. The result gives formative strengths and suggested edits. It is not an official IELTS assessment and contains no predicted band. Verify quoted excerpts against your own writing.
5. With no network or key, prompts, drafts, recording, self-review and objective exercises continue to work offline.

## Storage and backups

- A session stores its current item, response, mode, ordered item IDs, assignment ID, results, Listening part playback state and (for timed/diagnostic mode) deadline in IndexedDB. Writing and Speaking drafts are keyed by prompt so changing tasks does not attach an old response to a new prompt.
- Complete JSON and encrypted study backups include attempts, results, drafts and user-recorded/saved audio. Audio is base64 encoded and can make the backup large. Import merges records.
- Saved media is limited to 25 MB per recording/file. Browser or device clearing can still erase local data; retain an exported backup.

## Verification checklist

Repeatable checks: `tools/tutor/assignment-engine-check.mjs` (scheduling rules), `tools/tutor/assignment-ui-smoke.cjs` (assignment and reload), `tools/tutor/offline-study-smoke.cjs`, and `tools/tutor/offline-cache-smoke.cjs`. Browser checks run from the repository root with system Chrome and `playwright-core` available on `NODE_PATH`.

- Validate every bundled pack; check unique IDs, key types and all required skill/part coverage.
- Answer each supported response type, reload and resume an unfinished session, and verify incorrect answers enter Vault review.
- Run a full 40-question Listening and Reading diagnostic, verify section counts/order/timing, reload and resume, and confirm stage recommendations are separate by skill and do not claim an overall or official score.
- Type Writing and Journal drafts, reload and verify restoration; record Speaking locally, reload and play/delete it.
- Save and reopen a listening file/transcript; round-trip complete JSON and encrypted backups in a clean browser profile.
- With network disabled after the first app load, answer a cached question at desktop and mobile widths.
