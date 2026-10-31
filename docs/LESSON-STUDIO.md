> **Current reference — 31 October 2026:** product release records identify v151, source b152bc9f186cee08f114f04d4755c9ae2bba8c62, cache mdx-dict-v150; its deploy ID is still pending. Production Studio shows 33 reviewed packs, Baseten Muse Spark Open creation and optional Meta Model API repair. The v149 release/pilot paragraphs below retain their historical evidence; they are not a claim that the current library remains unapproved or undeployed. Submission state and demo: [current dossier](hackathon-submission/README.md).

# Offline Lesson Studio — current reference and historical implementation notes

> LIVE v149 — IELTS wave 10; deploy `6ae3188c4be8b59f21e381ff`, source `949ac4c2f13806a4b0a5b66aefbfbe013092a914`, published 29 October 2026 16:58:05 VN; service-worker cache `mdx-dict-v149`. Production inventory: 20,790 files, zero live-only/SHA/document drift; 39 local-only QA release-input records. Production HTTP smoke 7/7 on attempt 1; Practice exposes 800 formative IELTS items (200 per stage, 50 per skill per stage), and Lesson Studio reports Ready offline. Production browser checks pass. IELTS feedback remains formative, not an official test or calibrated band diagnosis.

Historical v149 production deploy: `6ae3188c4be8b59f21e381ff`, source `949ac4c2f13806a4b0a5b66aefbfbe013092a914`, service-worker cache `mdx-dict-v149`. Lesson Studio is live at `/lessons/`; the production page reports Ready offline. The library contains 33 approved packs, verified with the library and offline-shell contract checks. The release QA rechecked six approved-envelope contexts across three release packs; this is browser automation, not independent human certification. Open `/lessons/` over HTTPS or localhost. The Reader toolbar also links to the studio.

## Provider routing introduced in v150

In the current working tree, Baseten Muse Spark Open creates the target-selection
and exercise drafts. A single optional repair uses Meta Model API; the editor can
choose among the listed Muse Spark and Muse Wonder text models. Each consent
screen names the provider, endpoint and model, and the browser ledger records the
provider/model without storing API keys. The CLI uses `BASETEN_API_KEY` for
generation and `DD_META_KEY` plus optional `DD_META_MODEL` for repair. Meta rows
are recorded without assigning Baseten prices or consuming the Baseten local
budget estimate. The v150/v151 releases supersede the original local-candidate status; this two-provider interface was observed on production on 31 October.

## Author workflow

1. Open **Author a pack**. In v149, enter the Baseten key for generation. In the current production interface, enter separate Baseten and Meta keys; choose the Meta model for repair. Keys stay in the current tab's memory. Add an original/licensed English reading, author, rights, topic and B1/B2 estimate.
2. Confirm rights. Inspect the exact selection request and provider destination, then explicitly consent. Selection validates two phrases against sentence IDs and requires contextual EN/VI meanings.
3. Inspect and explicitly consent to the exercise request sent to Baseten. No automatic chaining, retries or approval. An interrupted call stays in the local request ledger even if its billing outcome is unknown. One deliberate repair is available through Meta Model API, using the selected model and the retained source/targets.
4. Inspect/edit JSON and preview. Structural validation does not establish linguistic truth. Check source, meanings, each option and explanation, and the new role/purpose in the transfer task. Record unresolved problems in `review.findings`. Critical/uncertain findings block review and approval. Saving edits resets approval while preserving findings; unresolved blockers cannot be deleted to pass the UI review.
5. Mark reviewed with four checks and a note, then approve as a separate action. The default reviewer is an AI-assisted editor, not an independent human. Export/install only approved packs. One deliberate Meta repair request per draft is allowed; subsequent changes are manual or a separately initiated draft.

## Learner workflow

Load the labelled authored example or import an approved JSON pack. Read → contextual phrases → four fixed-key questions → new-situation writing with a model/checklist → save exact meanings to the existing Vault → Review. Transfer writing is self-assessed, never automatically graded. Meta Tutor is introduced after completion, as optional live personal practice.

Wait for **Ready offline**, install a pack, then disconnect/reload. Progress is stored by pack ID + version + lesson ID. Installing an identical pack preserves it; a different payload with the same ID/version is rejected. New versions have separate progress. The authored fixture is not a live Meta response.

## Architecture and data

- `schema.js`: strict versioned JSON whitelist, source/target/exercise references, answer IDs, review gates, 2 MB limit, SHA-256 envelope. A checksum detects changes but does not authenticate a publisher or verify their review claim.
- `generator.js`: three inspectable request types; direct Baseten creation and Meta repair calls with timeout/cancel/error handling and safe provider/model metadata. Muse requests set `reasoning_effort: medium`; `max_tokens` is capped at 65,536 and explicit provider truncation is rejected.
- `storage.js`, `backup.js`, `draft-file.js`: isolated `dd-lesson-studio-v1` IndexedDB stores for drafts, packs, progress, usage. Draft revisions reject stale writes. Immutable pack-version installation is atomic. The Studio backup validates all four stores, checks a checksum, rejects credential-like fields and merges atomically with local records winning. Importing an author draft requires rights confirmation and clears review/approval state. Neither feature changes the core dictionary/Vault database schema.
- `budget.mjs`, `batch.mjs`, `repair.mjs`: CLI generation uses Baseten and one deliberate repair uses Meta. The local ledger prices Baseten usage only; Meta calls retain provider/model/token metadata with no inferred price or Baseten reservation. Provider errors and unknown outcomes remain recorded, with no automatic retries.
- `app.js`: author review and learner UI; all imported/model text uses textContent, not executable HTML. Vault adapter reuses `addItem`, stable meaning identity and existing spaced-review scheduling.
- `sw.js`: current cache v150 precaches Studio modules and supports its offline backup/import flows. No server proxy, accounts or tracking added.

Keys entered on this page are not persisted or exported. A key is sent as Authorization only to the consented provider endpoint. Send only original/permitted text without personal learner data. The Studio UI ledger counts requests but does not impose a dollar cap. The CLI's Baseten estimates cannot see other keys or account activity; the owner handles credit monitoring. No account usage or Billing lookup is performed. Token counts can be missing for interruptions.

Pack export includes only lesson content. Studio backup separately includes drafts, packs, progress and local usage, but excludes the main app database, Vault, app settings and credentials. Keep the backup private because it can include drafts and learner writing. No 24-hour retention, independent English reviewer or real-phone validation is claimed.

## Reproduce checks

With a recent Node and system Chrome, run from the repo root:

```
node tools/lessons/check.mjs
node tools/lessons/network.mjs
node tools/lessons/provider-routing-check.mjs
node tools/tutor/check.mjs
```

Browser tests require `playwright-core`, a static root server at `http://127.0.0.1:8765`, `DD_LESSON_ROOT` (absolute repo path), `DD_QA_OUTPUT` (existing output directory) and Node module resolution for playwright-core. Run `node tools/lessons/browser.cjs`. The browser suite creates a fresh isolated context and intercepts its fake provider. It makes no paid Meta calls. Viewports are emulations, not physical devices.

Real Meta development pilot: 9 deliberate calls (three selections, six exercise generation/repair attempts), 7,600 input + 34,977 output provider-reported tokens; all HTTP 200, one unusable JSON at the token cap (consistent with truncation), eight valid stage outputs. No dollar charge inferred. Sources are original AI-assisted texts, not held-out production cases. Final editorial results: one critical, one uncertain, one with no critical finding in this small sample. None of the real-generated packs was approved or bundled as production content. See the task's pilot evidence and quality review. Prompt iterations are development evidence, not a general quality pass.

## Remaining before submission

The published library now contains 33 approved packs. Before submission, align the dossier and Studio-centered three-minute recording, prepare public GitHub/video URLs, identify the exact source and preserve evaluation limits. Held-out-source evaluation remains separate work if performed; do not describe development sources as unseen evaluation. Keep the v143 baseline and old Tutor demo labelled.


## Ongoing quality process
Read HACKATHON-QUALITY-PROCESS.md before each lesson/generator/release session. Exact-payload editorial checklists and explicit approval are supported by tools/lessons/quality-gate.mjs. The historical pilot above is unchanged; corrected candidates and current readiness are recorded in docs/lesson-studio-evidence/quality-cycle-2026-10-27/board.json. The board retains historical pre-release candidate states; consult current release records and the approved library manifest for published status.
