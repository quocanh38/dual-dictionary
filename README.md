> **20 November 2026:** **HọcTA** (`hocta.app`) is live on `main` (cache `mdx-dict-v230-merged-audit`) with `windows-handoff-2026-11-15` merged, P0/P1/P2 security & reliability fixes applied, and automated GitHub Actions CI/CD (`npm test` + `npm run qa:links` → Netlify production deploy). Historical 1 Nov hackathon record: [main demo](https://youtu.be/6r8nJDiZr5E) · [P0 record](docs/hackathon-submission/P0-PUBLISH-SUBMIT-2026-11-01.md).

# HọcTA — Học tiếng Anh song ngữ

HọcTA helps Vietnamese speakers look up English in context, save and review vocabulary with FSRS spaced repetition, practise for IELTS/TOEIC exams and study downloaded lessons offline. Lesson Studio turns permitted readings into reviewed bilingual lesson packs. Learners can use downloaded packs without an API key.

- [Live dictionary, Reader, Vault & Exam Lab](https://hocta.app/)
- [Live Lesson Studio](https://hocta.app/lessons/)
- [Vietnamese learning hubs & dictionary](https://hocta.app/vi/)
- [Studio architecture and author workflow](docs/LESSON-STUDIO.md)
- [Deploy state & runbook](docs/deploy-state.md)
- [Hackathon dossier](docs/hackathon-submission/README.md) · [Offline pipeline narrative](docs/hackathon-submission/OFFLINE-PIPELINE-2026-10-31.md) · [Pre-event foundation](NEW-WORK.md)
- [Third-party data and code attribution](NOTICE.md)

## Latest status — 20 November 2026

| Item | Status |
|---|---|
| Live production | [hocta.app](https://hocta.app/) — Service Worker cache `mdx-dict-v230-merged-audit` (GitHub Actions run `44669397224`, commit `f31eb71ba3`) |
| CI/CD | Automated via [`.github/workflows/deploy-netlify.yml`](.github/workflows/deploy-netlify.yml): runs `npm test` + `npm run qa:links` before deploying to Netlify production on every push to `main` |
| Static content | **14,822** HTML pages and **627,478** verified internal links (`npm run qa:links` ALL PASS), covering EN–VI dictionary words, phrases, pronunciation, synonyms, collocations, grammar, IELTS/TOEIC guides, and indexable Lesson Studio pages |
| Offline library | **33** approved, versioned AI-assisted packs (workplace 20 + academic 13, B1 20 + B2 13) with canonical SHA-256 verification |
| Validation | **15/15** automated suites PASS via `npm test` (`fuzzy-test`, `review-regression` 13 scenarios, and all 13 `tools/lessons/*check*.mjs` contract suites) |
| AI authoring / Tutor | Optional BYOK via **Gemini API** (explicit per-request payload inspection & consent; keys stay in tab/session memory only; no credentials bundled) |
| Hackathon demo (archive) | [3-minute Studio demo](https://youtu.be/6r8nJDiZr5E) (1080p, English captions) · [30s mobile-emulation clip](https://youtu.be/IIomKgrVzmw) ([record](docs/hackathon-submission/MOBILE-EMULATION-SUPPLEMENT-2026-11-01.md)) |

## Run locally

This is a static browser app. With Python 3 installed, run from the repository root:

```sh
python3 -m http.server 8080
```

Open `http://localhost:8080/` for the main app, or `http://localhost:8080/lessons/` for Lesson Studio. Use `localhost` or HTTPS for service workers; do not open `index.html` directly. Install a reviewed pack and wait for offline readiness before going offline.

Learner practice needs no API key. Creating or repairing drafts and using optional AI Tutor feedback require the user's own Gemini API key, connectivity and explicit per-request consent. No credentials are bundled. Review and approval remain explicit; free writing is self-assessed.

## Validate without provider calls

Requires Node.js 22 or later:

```sh
npm test          # Runs app regression/fuzzy tests + all 13 Lesson Studio contract checks (0 live provider calls)
npm run qa:links  # Verifies all internal links across 14,800+ static pages
npm run qa:titles # Audits page <title> length and duplicates
```

The library contains 33 approved, versioned AI-assisted packs. Automated validation and AI-assisted review do not establish learning gains or independent human language certification.

## Scope & attribution

This repository is the single source of truth for HọcTA (`main` deploys directly to Netlify production via GitHub Actions). It contains the PWA application source, Lesson Studio, static Vietnamese SEO hubs, Netlify Functions (`netlify/functions/`), and build/QA tooling (`tools/`).

Third-party content and libraries retain their own terms in [NOTICE.md](NOTICE.md).
