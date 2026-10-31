# IELTS Meta practice batches · 2026-10-27

This evidence set records 80 original IELTS practice items created with Meta Muse Spark 1.3 in four 20-item batches. Every batch contains five Listening questions, five Reading questions, five Writing prompts and five Speaking prompts for its pathway stage. The final normalized candidate for each stage passed independent cross-review by GPT-6-Luna and GPT-5.6-Terra. Review JSON records the exact candidate byte hash, so a review cannot accidentally approve a later edit.

| Stage | Final candidate SHA-256 | Final GPT reviews |
| --- | --- | --- |
| Around 5.0 | `1f23171ca9b4496783fefcb9bcc443612a95f1f8cabf8461bbc6262ea60680c8` | Luna pass; Terra pass |
| 5.0 → 6.0 | `93101ca1904485c5e3eb2964892ff410b313417841da1be9a64cf4fb8babb5f1` | Luna pass; Terra pass |
| 6.0 → 6.5 | `cf42464c6bc5a2ed1e82ef12d83b19a3bff55704d1a01e3da6f7bd68952edf77` | Luna pass; Terra pass |
| 6.5 → 7.0 | `7c017719f3809883aeb6118942366b0e205ab31e2037727f3068a63c82247e97` | Luna pass; Terra pass |

Each stage directory retains Meta request/response evidence, normalized draft and final candidate files, SHA-256 sidecars, initial and final reviewer results, and any structural or GPT findings. Repair history includes:

- Around 5.0: corrected the Listening Part label to match its two-speaker everyday service conversation.
- 5.0 → 6.0: added visible Part 2 cue-card bullets and clarified mixed-unit Writing Task 1 table headings.
- 6.0 → 6.5: added missing cue-card bullets and narrowed one Task 2 prompt to a single, clear scope.
- 6.5 → 7.0: shortened an overlength Listening script, added cue-card bullets, and corrected a Reading answer key that did not match its explanation.

`candidate.json` is the pre-final candidate where retained; `candidate-meta-repaired.json` is the final reviewed candidate used to build [`js/ielts-meta-practice.js`](../../../js/ielts-meta-practice.js). Run `node tools/tutor/ielts-meta-integrate.mjs` from the repository root to regenerate the browser module. The integration script refuses candidates whose exact bytes do not match both final GPT approvals.

These are original formative exercises. Cross-review checks the supplied content and answer support; it does not validate calibration against official IELTS forms or predict a learner's band. The app presents the pathway stage as a practice target only.
