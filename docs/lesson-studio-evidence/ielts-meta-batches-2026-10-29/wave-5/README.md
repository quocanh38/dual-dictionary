# IELTS Meta practice — wave 5

Completed locally on 29 October 2026. This wave adds 80 original formative
practice items: 20 each for the 5.0, 5.0→6.0, 6.0→6.5, and 6.5→7.0 stages;
each stage contains five items per skill (Listening, Reading, Writing,
Speaking).

Generation and repairs used Baseten Chat Completions at
`https://inference.baseten.co/v1` with the exact hackathon model
`meta-models/muse-spark-open-1026`. Eight original generation requests and six
one-time repair requests returned HTTP 200. The model's final content, per-call
usage, latency, requests, and editorial input are retained in each stage folder.
No account-level usage or Billing lookup was performed.

The four active files are `candidate-final-v2.json`; exact-byte SHA-256 and
normalization metadata are in matching sidecars. All candidates passed full
exact-hash review by gpt-6-luna and gpt-6.1-sol:

| Stage | Candidate SHA-256 | Review |
| --- | --- | --- |
| band-5 | `2427d184c823c547f6a3e65d8cc288c3fc072f8882717eed066a1c53f647b8d8` | PASS · Luna + Sol |
| band-6 | `7c18b72f239cf21cfcbdabcf0eb3658842de0c05757d40f9a3463909c9804a55` | PASS · Luna + Sol |
| band-6-5 | `c5be88754dc7fc822c49f02403cc7530f01e3cff7374cb258b5b44986cf912f3` | PASS · Luna + Sol |
| band-7 | `c2a9fb003ba2e3f098495a6ab54f644d924a22e6846863d07c078cd70b5260e1` | PASS · Luna + Sol |

Initial candidates and reviews remain alongside the repaired versions. GPT
findings led to corrections for a 410-word Listening script, unsupported plant
habitat wording, a comparison stem without a clear subject, an incorrect
Listening answer key and uneven key positions, and inconsistent city-cohort
counts. Meta repairs also clarified survey denominators and data units, and
reduced specialist terminology in later-stage prompts. Two non-blocking
band-7 observations remain recorded: one Writing participation-rate
denominator could be clearer, and one Speaking Part 1 question is relatively
abstract.

These are original short-form practice materials, not official IELTS
questions, complete mock exams, calibrated band assessments, or guarantees.
The integration report and browser/offline validation are recorded in
`integration-report.json` and `validation-2026-10-29.json`.

Integrated locally into the 400-item IELTS practice bank, pack v2.8.0, and
service-worker cache v146. Live v148 remains unchanged; no push or deploy.
