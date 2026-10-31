# Dual Dictionary — Offline Lesson Studio

Turn a permitted reading into a reviewed bilingual lesson pack, then learn offline without an API key.

- [Live Studio](https://dualdictionary.netlify.app/lessons/)
- [Live dictionary and Vault](https://dualdictionary.netlify.app/)
- [Hackathon dossier](docs/hackathon-submission/README.md)
- [Pre-event foundation and new hackathon work](NEW-WORK.md)
- [Studio architecture and author workflow](docs/LESSON-STUDIO.md)
- [Third-party data and code attribution](NOTICE.md)

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

This export contains the current application source, static learning assets, test/build tools and structured generation/review/QA evidence. It is based on private deployment-source commit `dddf30818`, including the v151 Studio UI and the separately updated submission documents of 31 October 2026. The pre-event dictionary, Reader, Vault and Tutor are disclosed in NEW-WORK.md; Studio is the hackathon contribution.

Existing public repository history is preserved. Deployment-repository history, workstation handoffs and browser QA PNG screenshots are not exported; historical evidence references to those screenshots may therefore be unavailable. Structured JSON/text evidence remains included. Local demo video files and private study/browser backups are not in this source repository. A hosted three-minute video URL is still pending.

This GitHub synchronization does not push to the separate Netlify deployment repository. The deployed application is not rebuilt by this change.

Third-party content retains its own terms in NOTICE.md. No new blanket license grant for original application code is introduced by this synchronization.
