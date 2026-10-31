# IELTS Meta practice — wave 4 (integrated locally)

Completed 29 October 2026. Added 80 original Meta Muse Spark 1.3 practice items: twenty per pathway stage, five per skill (Listening, Reading, Writing and Speaking). These are formative practice stages, not official IELTS items or calibrated learner scores.

Active candidates are `candidate-final-v4.json`; exact byte SHA-256 and canonical checksums are recorded in matching sidecars. All four candidates passed full exact-hash reviews by `gpt-6-luna` and `gpt-6.1-sol`, recorded in `review-gpt-6-luna-final.json` and `review-gpt-6-1-sol-final.json`.

| Stage | Candidate SHA-256 | Cross-review |
| --- | --- | --- |
| band-5 | `b293fbeaaaaf6b42eed1eabc30a7631e61a7f26a5894802874575bb7930562cc` | PASS · Luna + Sol |
| band-6 | `3560af2fe77289392b46e95addadf318a3d4c6288d3b88b1412635876c4d5cef` | PASS · Luna + Sol |
| band-6-5 | `148ea435be99d65a34f93eaf8b0e419b56d0c86235fbe4c89238427e606d577f` | PASS · Luna + Sol |
| band-7 | `a5663e4bb0cc1e3fb18ea6046ec99735ef0de6054766f2db702f62a6f25dd293` | PASS · Luna + Sol |

Preserved original Meta requests/responses, failures, Meta repairs, v2/v3 candidates and reviewer findings. Editorial corrections after cross-review are documented in `editorial-diffs-v3.json` and `editorial-diff-v4.json`: average error versus per-measurement claims; searches versus actual journeys; attribution; schedule consistency; unsupported explanation consequence. Segments had already used their one Meta repair, so remaining changes were explicit AI-assisted editorial edits rather than additional provider calls. No Meta Billing/usage lookup was performed.

`integration-report.json` binds all sixteen batches and generated module checksum. The bank totals 320 Meta items, 80 per stage and twenty per skill per stage; the full content pack has 440 IDs, 244 IELTS objective questions (80 diagnostics + 164 practice), 90 Writing prompts and 90 Speaking prompts. Pack version 2.7.0; cache mdx-dict-v145. Historical wave-3 band-7 Reading keys omit option position 2; this existing reviewed distribution is retained, while all new wave-4 objective sets cover positions 0–3. One non-blocking band-6.5 explanation-precision observation remains recorded in Sol's review.

Local integration only. Browser validation status is recorded in `validation-2026-10-29.json`; deployment requires a new owner instruction.
