# Tutor reliability — 2026-10-24

Scope: local source changes and deterministic automated checks. No production deployment, real provider key, paid API call or user data used. Browser tests run in isolated temporary Chrome profiles with authored inputs and a localhost fake provider.

## Fixes

- Protect prompt/feedback persistence inside the request try/finally. A failed IndexedDB write no longer leaves the Tutor busy or contacts the provider before the draft is saved.
- Hold each request's controller locally and check the request generation after asynchronous storage/history operations. Cancellation during a save prevents a late provider call; cancellation during ranking or final persistence prevents stale rendering/session mutation.
- Keep the existing target until a new prompt has actually arrived. Cancelling a new prompt cannot pair previous feedback/answers with another phrase.
- Publish the resume pointer only after a successful IndexedDB write, and only while that same session remains current.
- Catch rejected async Tutor UI actions and quick-setup continuations so storage failures surface as actionable status messages.
- Validate phrase output before caching. Rejected older cache entries no longer block a fresh, explicitly approved provider request.
- Classify null API envelopes as unexpected responses instead of throwing a property-access exception.

## Verification

All commands run from the candidate repository root using the bundled Node runtime. Browser checks use system Chrome through playwright-core, resolved via NODE_PATH=/Users/nguyenquocanh/Documents/DSH/ui-check/node_modules.

| Check | Result | Evidence covered |
| --- | --- | --- |
| node tools/tutor/check.mjs | PASS | Source grounding, quote checks, uncertainty, cache isolation, local ranking, content schema |
| node tools/tutor/ai-client-check.mjs | PASS | Request/auth shape, HTTPS, 400/401/402/403/429/500, network/CORS, malformed/non-JSON/null envelopes, cancellation including pre-aborted signals, timeout |
| node tools/tutor/reliability-check.mjs | PASS | Storage-full recovery, cancel during initial/final saves, cancel during ranking, old/new invalid cache, previous-target retention, resume-pointer ordering/discard race |
| node tools/tutor/sense-identity-check.mjs | PASS | Sense separation, deduplication, legacy cards and meaning/context persistence |
| node tools/tutor/ai-flow-smoke.cjs | PASS | Per-request payload consent, draft/prompt reload without automatic API call, connection loss, 429, wrong quote, retry, cancellation, accept/save into Vault, Writing/Speaking feedback; zero page errors |
| node tools/tutor/offline-cache-smoke.cjs | PASS | Real service-worker cache, network cut followed by reload and answering a question at 1280px and 390px; zero page errors |
| node tools/tutor/offline-study-smoke.cjs | PASS | Journal/draft recovery; all current IELTS/TOEIC objective question workflows; timed-mode reload; Writing history; fake microphone recording; listening library reload; clean-profile JSON and encrypted audio backup round trips; zero page errors |

The new reliability check was also run against the original source and failed on the unhandled storage-full error before these fixes. It passes against the corrected source.

The existing browser suites needed maintenance: open the current nested settings/AI disclosure controls, use current labels, synchronize question navigation, and derive pack version/question totals from current content metadata. The offline test retains explicit answer fixtures for the original format checks; added questions test workflow completion, not AI or exam-content quality. Removing Playwright's serviceWorkers:block avoids its injected service-worker getter failing inside opaque dictionary frames; this test server returns 404 for sw.js, and service-worker behavior has a separate real-cache test.

## Limits / follow-up

These tests establish local error handling and workflow behavior with simulated provider responses. They do not establish real-model answer quality or production deployment health. Browser reload evidence specifically covers an active Tutor answer/draft and timed exam session, not every Tutor stage or every browser/device. Legacy database migration and actual device-specific behavior remain outside this run. The service worker cache version is unchanged because this is not a release.
