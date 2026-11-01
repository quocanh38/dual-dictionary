> **1 November 2026:** [main demo](https://youtu.be/6r8nJDiZr5E) published Unlisted; contest submission verified at 09:39 Vietnam. v160 critical syntax fix is live; physical-phone proof remains a pending supplement. [P0 record](docs/hackathon-submission/P0-PUBLISH-SUBMIT-2026-11-01.md).

# Dual Dictionary — Offline Lesson Pipeline

Turn a permitted reading into a reviewed bilingual lesson pack, then learn workplace English where the network drops — no API key.

- [Live Studio](https://dualdictionary.netlify.app/lessons/)
- [Live dictionary and Vault](https://dualdictionary.netlify.app/)
- [Hackathon dossier](docs/hackathon-submission/README.md)
- [Offline pipeline narrative](docs/hackathon-submission/OFFLINE-PIPELINE-2026-10-31.md)
- [Pre-event foundation and new hackathon work](NEW-WORK.md)
- [Studio architecture and author workflow](docs/LESSON-STUDIO.md)
- [Third-party data and code attribution](NOTICE.md)

## Latest status — 1 November 2026

| Item | Status |
|---|---|
| Narrative | Offline lesson pipeline for working adults on flaky networks: prepare where connected, learn airplane-mode ([pipeline note](docs/hackathon-submission/OFFLINE-PIPELINE-2026-10-31.md)) |
| Studio source | Published in [5f9d25ac](https://github.com/quocanh38/dual-dictionary/commit/5f9d25ac) (narrative) on top of [8b39df2a](https://github.com/quocanh38/dual-dictionary/commit/8b39df2a) (Village Kit) + [e3fc2dd8](https://github.com/quocanh38/dual-dictionary/commit/e3fc2dd8) (main-app path); prior public history preserved |
| Live production | v160 hotfix live, cache `mdx-dict-v154`; main app/Reader and 7-page browser smoke pass. Photo path from v159 retained. |
| Offline library | 33 approved, versioned AI-assisted packs (workplace 20 + academic 13, B1 20 + B2 13) |
| Validation | 27 schema/generator contract groups, library and quality-gate checks passed; all 33 pack checksums/metadata verified |
| Main demo | Completed locally: 3:00, 1080p, English narration/subtitles; [recording evidence](docs/hackathon-submission/STUDIO-DEMO-2026-10-31.md) |
| Video viewing link | [Watch the 3-minute Studio demo](https://youtu.be/6r8nJDiZr5E) — Unlisted, English captions, 1080p verified |
| mobile-emulation supplement | [Watch the separate 30-second clip](https://youtu.be/IIomKgrVzmw) — Unlisted; browser/device emulation, not physical-phone proof ([record](docs/hackathon-submission/MOBILE-EMULATION-SUPPLEMENT-2026-11-01.md)) |
| Submission | Submitted by owner; verified 1 November at 09:39 Vietnam. Physical-phone proof is a pending supplement. |

The Studio demo shows permitted-source authoring, the explicit review boundary, an approved lesson, Chrome Offline reload with restored progress, fixed-key practice, self-assessed transfer and exact-meaning Vault save. It uses labelled retained Meta material and makes no new provider call. This is a desktop browser demonstration, not a learner-outcome study.

## Run locally

This is a static browser app. With Python 3 installed, run from the repository root:

```sh
python3 -m http.server 8080
```

Open http://localhost:8080/lessons/ for Studio, or http://localhost:8080/ for the main app. Use localhost or HTTPS for service workers; do not open index.html directly. Install a reviewed pack and wait for offline readiness before going offline.

Learner practice needs no key. Creating drafts requires the author's own provider account/key, connectivity and per-request consent. The current creation route uses Baseten-hosted Muse Spark Open; optional repair uses Meta Model API. No credentials are bundled. Review and approval remain explicit; free writing is self-assessed.

## Validate without provider calls

Use a current Node.js release (22 or later):

```sh
node tools/lessons/check.mjs
node tools/lessons/library-check.mjs
node tools/lessons/quality-gate-check.mjs
```

The library contains 33 approved, versioned AI-assisted packs. Automated validation and AI-assisted review do not establish learning gains or independent human language certification.

## Source snapshot and scope

This export contains the current application source, static learning assets, test/build tools and structured generation/review/QA evidence. It includes the 31 October Offline Pipeline narrative (working adults on flaky networks), the Village Kit provenance/weight tooling, the main-app offline/online badges with EN/VI strings, and the separately updated submission documents. The pre-event dictionary, Reader, Vault and Tutor are disclosed in NEW-WORK.md; Studio is the hackathon contribution.

Existing public repository history is preserved. Deployment-repository history, workstation handoffs and browser QA PNG screenshots are not exported; historical evidence references to those screenshots may therefore be unavailable. Structured JSON/text evidence remains included. Local demo video files and private study/browser backups are not in this source repository. The main demo is now [available on YouTube Unlisted](https://youtu.be/6r8nJDiZr5E).

This GitHub synchronization does not push to the separate Netlify deployment repository. The deployed application is not rebuilt by this change.

Third-party content retains its own terms in NOTICE.md. No new blanket license grant for original application code is introduced by this synchronization.
