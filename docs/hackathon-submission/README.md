> **P0 update — 1 November 2026:** main video published Unlisted; form prepared with the actual URL and owner-selected surveys. Final consent/Submit not yet verified. Real-phone airplane-mode proof remains pending. [Execution record](P0-PUBLISH-SUBMIT-2026-11-01.md).

# Dual Dictionary — Offline Lesson Pipeline

**Submission draft synchronized 31 October 2026 (evening). Not submitted.** Track shown in the participant form: Indie Developer; theme: Build for Your World. The owner must still confirm eligibility, team details, the two opinion/intent survey answers and the final rights consent.

## Submission description

Dual Dictionary helps Vietnamese working adults turn a reading into phrases they can use on the job. The new Offline Lesson Studio builds on our existing dictionary, Reader, Vault and spaced-review app. An author supplies an original or permitted text; Meta models draft phrases grounded in exact source sentences, contextual English/Vietnamese meanings, fixed-answer exercises and a changed-situation writing task. Drafts must be reviewed and explicitly approved before distribution as versioned lesson packs.

A learner installs an approved pack once — workplace handovers, deliveries, safety plans, academic readings (33 packs: workplace 20 + academic 13) — then reads, practises, checks explanations, writes a transfer response and saves the selected meaning and source to the existing Vault. Installed packs and progress work offline: prepare where connected, learn where the network drops (shifts, sites, commutes). Live generation needs connectivity and the author's own provider key; learner practice does not require an API key. Free writing uses a model/checklist and self-assessment, not automated grading.

Full narrative: [OFFLINE-PIPELINE-2026-10-31.md](OFFLINE-PIPELINE-2026-10-31.md).

The contribution is a durable author-to-learner workflow: generation, editorial decisions and offline distribution remain distinct and inspectable. The retained Meta outputs, editorial changes and exact-payload reviews document both failures and corrections. These safeguards do not establish general language accuracy or learning gains.

## Existing foundation and hackathon contribution

- **Pre-event baseline:** v143, commit `97767b54a66f7f0732e3923c70f92a9b165319d8`, 25 October. Dictionary, Reader, Vault, spaced review, BYOK Tutor, authored demo and earlier exam/blog features already existed. The reference tag was created on 27 October, not before kickoff.
- **New from 27 October:** `/lessons/` authoring/review/offline player, source references, versioned packs, isolated Studio storage and request ledger, backup/restore, draft import and exact-meaning Vault integration. The new IELTS pathway and generated practice library are supporting scope; not every prior exam feature is new.
- **Later refinements:** v150 provider routing and trust/translation/lookup fixes; v151 flagship loop; v152–v154 offline pipeline (provenance overlay, weight audit, main-app offline/online badges, adult-audience narrative). Details and baseline disclosure: [NEW-WORK](../../NEW-WORK.md).

## Current release and evidence

Live production is v154 (31 October evening), service-worker cache `mdx-dict-v152`: app banner + Studio hero tell the offline-pipeline story for working adults, verified live on `/` and `/lessons/` with the old classroom story gone. Prior records identify v151 source `b152bc9f186cee08f114f04d4755c9ae2bba8c62`, cache `mdx-dict-v150`.

The production Studio was opened on 31 October and showed the two-provider author workflow, a reviewed 33-pack library and Ready offline. The [31 October Studio recording](STUDIO-DEMO-2026-10-31.md) verified one approved pack through Chrome Offline reload, progress restoration, fixed-key practice, self-assessed transfer and an exact-meaning/source Vault save. This is a one-pack desktop flow with browser offline emulation, not new all-pack QA or physical-device coverage.

The library index contains **33 approved packs** with retained AI-assisted editorial evidence. Historical release QA records **66 clean/preseeded emulated contexts** and 33 offline catalogue installs. The IELTS module contains **800 formative items**: 400 fixed exercises, 200 Writing prompts and 200 Speaking prompts. These counts are artifact inventory, not an efficacy measure, full official IELTS bank or calibrated band diagnosis.

[Tutor evaluation](../tutor-live-eval-report-2026-10-30.md) is supporting evidence for reused Tutor infrastructure: the production-cap resweep returned 24/24 verdict matches and 24/24 quote-valid checks on AI-authored cases. Only 13 cases require a quote; 19 outputs contain a non-empty quote. Explanation quality was not scored. The earlier 900-token sweep failed 24/24 and remains published. This is not a Studio content benchmark or evidence of learner outcomes.

The three-day learner protocol is prepared. Participant execution and results have not been verified in this repository. Do not claim a study is running or complete without its logs/data.

## Meta products used

Retained library artifacts identify the actual model/provider used for each pack; for example Library Hours and Student Deadlines records Meta Model API / `muse-spark-1.3`, generated 27 October and subsequently edited/reviewed. The current production author interface routes new creation to Baseten-hosted Muse Spark Open (`meta-models/muse-spark-open-1026`) and offers one explicit Meta Model API repair. Do not relabel historical direct-Meta generation as Baseten output.

Meta's substantive role is to propose contextual phrases, draft exercise alternatives/explanations and create transfer tasks. The application supplies the source references and validates structure; the editor reviews language content and records approval. Other configured GPT models assisted cross-review; that is not independent human certification and is not presented as Meta output.

Why Meta matters: it performs the language-generation step that turns a permitted reading into a reusable bilingual lesson draft. The engineering contribution preserves provenance, separates editing from generation and packages the reviewed result for repeated no-key offline use. No comparative model-superiority claim is made.

## Architecture, privacy and limitations

- Static browser application; direct consented provider requests, no application server proxy, account or tracking added.
- Studio keys entered in its settings are tab-memory only and excluded from exports. Main-app Tutor settings have separate persistence; do not generalize Studio's key policy to every credential in the app.
- Source/phrase checks and strict schema reject malformed data. SHA-256 detects payload changes; it is not a publisher signature or language-quality certificate.
- Separate Studio IndexedDB stores drafts, installed versions, progress and local usage. Progress is pack/version-specific. Vault integration preserves selected meaning and source.
- Pack exports are lesson content. Studio backups additionally include local drafts/progress/writing/usage; keep them private. A Studio backup is not a whole-app/Vault backup.
- Offline practice requires prior installation and a ready cache. Live generation/repair and optional personal Tutor need network, a key and individual request consent.
- Review is AI-assisted; device tests are emulated unless identified otherwise. No measured learning gains, independent human English review, official exam material or band guarantee is claimed. Usage estimates are not provider billing.

## Required submission assets and remaining owner decisions

| Item | Current state |
|---|---|
| Public GitHub URL | [quocanh38/dual-dictionary](https://github.com/quocanh38/dual-dictionary) — this source snapshot contains the Studio application, 33-pack library, tools and current dossier. The earlier public main snapshot `2c43d65feb5f48c67568396898fc9d1ba4c2a77c` is retained in Git history. See [source synchronization record](GITHUB-SYNC-2026-10-31.md) for scope and checks. |
| Main three-minute video | Completed local `DualDictionary-Studio-demo-3min.mp4`, 180 seconds, with labelled retained Meta material and observed Chrome Offline reload. Hash/provenance: [recording evidence](STUDIO-DEMO-2026-10-31.md). Published Unlisted on 1 November: [https://youtu.be/6r8nJDiZr5E](https://youtu.be/6r8nJDiZr5E); English SRT uploaded; signed-out playback and 1080p verified. [Publishing record](VIDEO-PUBLISHING.md). |
| Tutor video | Local `DualDictionary-demo-3min.mp4` from the previous chat step is a supporting demonstration of existing infrastructure, not the new-work narrative. |
| Description / use of Meta / why Meta | Draft text above; copy into the corresponding form fields after final review. |
| Partner feedback | Optional form field; answer from actual retained Baseten experience. |
| Two mandatory Meta surveys | Owner explicitly chose Very likely / Very favorable on 1 November; entered into the form. Additional optional survey questions remain unanswered. |
| Rights consent / final Submit | Not performed. Owner review remains necessary. |

[Official event schedule](https://dev.meta.ai/events/global-hackathon): 4 November 2026, 21:00 ET = **5 November, 09:00 Vietnam**. Dates may change; recheck before submitting. The authenticated [submission form](https://cerebralvalley.ai/e/meta-ai-developer-hackathon/hackathon/submit) was inspected on 30 October and explicitly asks for a public GitHub repository and a three-minute demo video URL. [Official Rules](https://cerebralvalley.ai/e/meta-ai-developer-hackathon/waiver) were read in full. No explicit ban on pre-event code was found there; disclose the foundation and new work accurately, and check any additional participant communications.

Historical detail is preserved in [the prior README](ARCHIVE-README-2026-10-29.md), dated addendum, verification record and raw evidence. The historical offline-only evaluation plan is separate from the later live resweep.
