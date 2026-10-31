# Meta AI Hackathon — submission draft

**Project:** Dual Dictionary — Offline Lesson Studio for Vietnamese learners.
**Status (29 October 2026):** Draft; nothing submitted. Public repository and final video URLs are not verified. Indie is the proposed track, not confirmed eligibility or acceptance. The product release itself is live as v149; deployment does not mean hackathon submission.

## Baseline, new work and release

The pre-event baseline is v143, commit `97767b54a66f7f0732e3923c70f92a9b165319d8` (25 October 2026, 21:18:38 +07:00). Dictionary, Reader, Vault, spaced Review, BYOK Tutor and its authored demo already existed. The baseline tag was created on 27 October; it does not prove a pre-kickoff tag. See `../../NEW-WORK.md`.

New hackathon work began on 27 October: `/lessons/` source-grounded phrase and exercise generation, explicit editorial review, versioned packs, offline player, separate Studio storage and request ledger, backup/restore, draft import and exact-meaning Vault integration. Meta selects phrases and generates draft exercises and transfer writing tasks; it does not automatically approve lessons.

Production release v149 is live: deploy `6ae3188c4be8b59f21e381ff`, source `949ac4c2f13806a4b0a5b66aefbfbe013092a914`, cache `mdx-dict-v149`, published 29 October 2026 16:58:05 VN. It includes 800 formative IELTS items (200 per stage, 50 per skill per stage) and the 33-pack offline Lesson Studio library. Production smoke was 7/7 and the post-deploy inventory had zero live-only or hash/document drift. See `../deploy-state.md` and `../deployment.md`.

Thirty-three packs are approved under the owner’s delegated cross-model AI editorial process and are included in production v149. Earlier release QA passed all 33 in clean and preseeded Chrome contexts (66 contexts total), with offline catalogue installation checks for all 33; the v149 post-deploy browser check confirmed the live studio reports Ready offline. Batch 10 added a repair-café volunteer shift, school-survey privacy and Riverside class-registration practice. Batch 11 added archive cataloguing (B2), community arts volunteers (B1) and volunteer rota scheduling (B2). Batch 12 added refill-shop stock practice (B1), student-podcast editing (B1) and flexible start times at work (B2); both Luna and Terra passed all 17 criteria on each final hash. Terra caught a critical v1 collocation explanation in the Refill Shop pack; the local v2 correction passed both full reviews. Luna recorded one non-blocking minor wording note, preserved in the review evidence. The raw Meta outputs and local editorial revisions are preserved separately; the repair-café lesson’s three critical v1 issues were corrected before both reviewers passed the final v2 hash. Batch 9 added community-kitchen, urban-heat and station lost-property practice; its rail transfer prompt/checklist mismatch was also corrected before approval. The **Planning Academic Travel** and **Sharing Resources at Work** packs began as Meta drafts; local edits are recorded separately, then the full final hash passed both reviews. The community-garden pack’s short reading and simple B2 practice remain recorded as a limitation. The conference-travel review evidence is in `../lesson-studio-evidence/p1-generation-2026-10-27/batch-2/conference-travel-authorized-repair/result/`; the community-garden review is in `../lesson-studio-evidence/p1-generation-2026-10-27/batch-6-meta/`. The first three packs used Astra/Terra; later batches used cost-conscious cross-model reviews. Earlier runs preserve their actual reviewer labels; the latest batch records routes gpt-6-luna and gpt-5.6-terra. The latest three before conference travel (food bank, lab equipment and station maintenance) have exact-hash reviews in `../lesson-studio-evidence/p1-generation-2026-10-27/batch-5/review-summary.json`; the previous four are recorded in `../lesson-studio-evidence/p1-generation-2026-10-27/review-batch-summary.json`. Two reviewers recorded non-blocking differences about approximate CEFR level for supplier and museum; the evidence retains those notes. The station q3 availability wording was corrected after a blocking review finding and both models rereviewed the final hash. This is AI-assisted review, not independent human certification. The authored bundled no-key sample is not a Meta result. The library now has 13 more packs than the upper end of the original 10–20 target; P1 generation continues under the owner’s instruction, with the quality gates intact.

## Submission copy

Dual Dictionary helps Vietnamese learners move from reading an English phrase to using it in a new situation. Offline Lesson Studio turns an original or licensed reading into a reviewable lesson: two phrases grounded in exact source sentences, contextual English/Vietnamese meanings, fixed-answer exercises, and a changed-situation writing task. Meta drafts the content; the editor checks meanings, every answer option, explanations and transfer before a separate explicit approval action is recorded. Approved versioned packs can be installed for offline practice and saved to the existing Vault with the selected meaning and source intact.

The new contribution is a durable author-to-learner workflow built on an existing offline dictionary and review app. It keeps provider generation separate from offline learning and preserves raw outputs and editorial changes. Structural checks and review evidence make failures inspectable; they do not establish teaching quality or learning outcomes.

## Architecture and privacy

- Static browser application; no application account, tracking or server proxy added. Direct Meta requests require a user-configured key, network access and explicit per-request payload consent. Provider processing is an external privacy boundary.
- Newly entered Studio keys stay in memory and are excluded from Studio exports/backups. Existing main-app provider settings may be read. Do not claim all credentials are memory-only across the entire product.
- Selection checks source sentence references. Strict schema and reference checks reject malformed packs. SHA-256 checks detect payload changes; they do not authenticate publishers or certify linguistic correctness.
- Studio uses isolated `dd-lesson-studio-v1` IndexedDB for drafts, packs, progress and usage. Pack ID/version payloads are immutable; progress is version-specific. The Vault adapter reuses existing meaning identity and review scheduling.
- The service worker caches the app shell. Wait for **Ready offline**, install the intended pack, then test offline reload. First download and live generation require connectivity. Offline transfer writing uses a model answer/checklist and learner self-assessment, not automated scoring.
- Pack exports contain lesson content. Studio backups additionally contain drafts, progress, usage and potentially learner writing; keep them private. They exclude main-app settings, credentials, Vault and dictionary data, so a Studio backup is not a whole-app backup.
- The request ledger is local evidence, not provider Billing or an account-wide spending cap. Missing usage and interrupted calls remain uncertain. No dollar cost is inferred from tokens.

## Lesson Studio evidence and limits

The 27 October continuation evidence records 14 main browser groups, invalid-output recovery/single-repair guard, 11 backup groups including clean-context restore, and author-draft import checks passing in local Chrome outside the restricted sandbox. The sandbox Chrome attempt was blocked by SIGABRT/EPERM. Headed/CDP adapters have mock unit coverage; that does not establish a real CDP execution. This is historical local QA evidence; the approved library is now live in v149. See `../lesson-studio-evidence/continuation-2026-10-27/`.

Those earlier browser flows use provider fixtures and a separate approval fixture; they do not approve real candidates. A 390px viewport is mobile emulation, not a physical phone. Candidate previews do not replace approved-pack import/offline/Vault release QA. Batches 7–12 added clinic, city-bus, coastal-bird, community-centre, equipment-loan, coastal-temperature, community-kitchen, urban-heat, station lost-property, repair-café, school-survey, Riverside registration, archive cataloguing, community arts, volunteer rota, refill-shop stock, student-podcast editing and flexible-start-time packs after two reviewers passed all 17 criteria for each final hash. The equipment source-reference and transfer-gloss issues, the rail prompt/checklist mismatch and three repair-café v1 issues were corrected in recorded local revisions before their final hashes passed. All 33 approved packs passed 66 clean/preseeded browser contexts and all 33 installed through the offline catalogue; QA made zero external or provider requests. The library now uses candidate cache `mdx-dict-v137` with 48 offline paths. Those batch-level test records predate the v149 production release; the approved library and app changes were deployed in v149.

A later agents session added authoring-stage reload/stale-response/offline refusal coverage, 12 historical/current storage groups, exact synthetic Vault/Review preservation and keyboard focus checks. Real loopback CDP execution and isolated-context cleanup passed. That historical local candidate fixed focus and a blocked-open late-connection leak with cache `mdx-dict-v124`; production was then rechecked at `mdx-dict-v123`. The current production shell is v149. The bounded local product evaluation contains six feedback fixtures and two API-error fixtures, with zero real provider calls; it measures deterministic safeguards, not provider accuracy. See `../lesson-studio-evidence/agents-2026-10-27/summary.json` and [evaluation plan](PRODUCT-EVALUATION-PLAN.md).

The historical development pilot used nine calls; all returned HTTP 200, but one response was unusable JSON. Prompt iterations and edited texts are development evidence, not unseen-source evaluation. Current candidates and exact hashes are in `../lesson-studio-evidence/quality-cycle-2026-10-27/board.json`; follow `../HACKATHON-QUALITY-PROCESS.md` for review and separate approval.

No independent human English review, measured learning gains, real-device validation, full official IELTS/TOEIC question bank or official band scoring is claimed. The old Tutor flow below is historical baseline evidence only.

## Historical Tutor QA evidence (24 October 2026)

The following describes pre-event Tutor work, not new hackathon implementation.

### End-to-end live flow

The local QA candidate completed this flow with a user-configured Meta key: article → phrase extraction → generated prompt → learner answer → live feedback → accept → save to Vault → open Review → reload → Review the saved meaning and source → start a new situation from that saved phrase. The live responses were labelled as live. The key is deliberately omitted from this dossier.

Four additional live evaluation cases were run from the candidate’s consent-gated evaluation page:

| Case | Model verdict | Exact quote | Expected | Result |
|---|---|---|---|---|
| Natural phrase use | correct | Not required; empty | correct | Match |
| Grammar error | incorrect | `I careful practice` | incorrect | Match |
| Off-topic answer | incorrect | Full supplied answer | incorrect or uncertain | Match |
| Answer omits the required phrase | incorrect | Full supplied answer | incorrect | Match after fixture correction |

At execution time, the fixture incorrectly expected “uncertain” for the last answer even though it omitted the explicitly required phrase. The test fixture now expects “incorrect”; applying that corrected criterion to the recorded live response gives 4/4 verdicts matching the task and all four quote checks valid (the correct answer may have an empty quote). No fifth model request was needed because only the fixture expectation changed. Observed response times: 7.9s, 15.9s, 17.5s, and 15.7s. This is a four-case manual check, not a benchmark or a claim about general accuracy.

### Other checks

- Semantic identity checks passed: different meanings of one headword remain separate; a repeat of the same sense deduplicates; selected definition and source sentence persist.
- Tutor validation checks passed: source grounding, exact feedback quotes, uncertainty handling, cache isolation/round-trip, and due-card ranking.
- Offline content-pack check passed for 39 stable IDs, productive IELTS prompts, and TOEIC Parts 1–7.
- AI client checks passed: Meta defaults, HTTPS validation, request format, auth handling, provider errors, CORS/network errors, malformed JSON, cancellation, and timeout handling.
- Browser check at 390px found no horizontal overflow. Browser console had no errors after the live flow.
- In the historical 24 October environment, Playwright CLI could not bind its local server (`listen EPERM`); that run used Chrome UI. The 27 October Studio browser results above are a separate run.
- Historical evidence does not establish full IELTS/TOEIC official-length content; the catalogue remains a starter set. Studio offline evidence is recorded separately above.

## Studio demo walkthrough (draft, approximately 3 minutes)

1. **0:00–0:20 — Scope:** identify the reused v143 dictionary/Reader/Vault infrastructure and open the new `/lessons/` module. State the exact candidate/release being recorded.
2. **0:20–0:55 — Author boundary:** show an original/licensed passage, rights confirmation, source IDs and inspectable request payload. Show a live call only when separately authorized and actually performed; otherwise explicitly identify retained provider evidence or the authored sample. Hide credentials.
3. **0:55–1:30 — Grounding and review:** compare phrases with exact source sentences; inspect EN/VI meaning, all options and explanations, and changed-situation writing. Explain that schema success is not editorial approval. Use an exact approved pack from the v149 production library for the practice flow.
4. **1:30–2:20 — Offline learning:** use the clearly labelled authored example, or the exact approved pack only after approval and release QA. Read, answer an incorrect/correct option, and write a transfer response using self-assessment.
5. **2:20–2:50 — Durability:** save the exact meaning/source to Vault, open Review, wait for Ready offline, disconnect and reload the installed pack. Show actual state; do not use narration as evidence of a reload that was not recorded.
6. **2:50–3:00 — Limits:** generation needs network/key; ordinary installed-pack learning is offline. State sample provenance and remaining evaluation limits.

This timing is an internal recording plan, not a verified event duration requirement. Final MP4/MOV and public video URL remain missing. The earlier macOS capture failed with `dispatch_source_create returned NULL`; no usable video was produced by that attempt.

## Before submitting

Read [the dated verification record](VERIFICATION-2026-10-27.md). The public event page was checked on 27 October, but full official rules and the actual project-submission form fields were not accessible in that check. Do not infer that links or fields in this draft are required by the event, or that this project/person is eligible.

- Confirm accepted-participant status, full rules, chosen track and any baseline/code provenance requirements with the actual organizer materials.
- The 33-pack v149 library has passed exact-pack QA and is 13 packs above the upper end of the original 10–20 target following the owner’s continue-generation instruction. It is deployed; freeze the source/hash manifest and align any recording with the live build. Any later release follows the owner's instruction and existing full-snapshot runbook.
- Add the actual public repository URL, video URL/file and team/member details if required by the submission form. Public repository status remains unknown; do not publish private data or credentials.
- Verify the final form and deadline again before submitting. No hackathon submission or public-repository publication has occurred; product v149 deployment is recorded above. This verification did not approve content or call Meta.
