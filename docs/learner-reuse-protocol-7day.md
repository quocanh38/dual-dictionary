# Learner reuse protocol — 7-day phrase-reuse test (plan, no results yet)

Claim under test: a learner can reuse a Tutor-saved phrase correctly in a new
situation 7 days later. No result is reported here; this is the measurement plan.

## Cohort
- n = 8–12 adult learners, A2–B1, Vietnamese L1, each with own device/browser.
- Each saves 5 Tutor phrases in week 0 (with quoted feedback accepted). Total ≈ 50 phrases.

## Task (day 0 and day 7, same 5 prompts per learner, new situations)
- Prompt shows the phrase + one new situation (no source sentence, no answer shown).
- Learner writes 1–2 sentences. Collect: answer text, timestamp, self-reported help used.

## Scoring (English-proficient rater, blind to day)
- Correct reuse: phrase used with the taught sense and grammatical frame (binary).
- Error kept: same error as day 0 repeated (binary). Quote check: rater cites the
  phrase span in the answer.
- Report: reuse rate day7/day0 per learner + aggregate, exact-match denominator,
  dropouts excluded with reason, all answers retained.

## Instrumentation (uses existing local data, no new tracking)
- Saved Tutor cards already carry tags `ai-tutor`, provider/model, and source sentence
  in Vault; FSRS review history stays local. Export Vault JSON for the 5 cards per
  learner; no key or article text leaves the device beyond the consented AI requests.
- Analysis is a local script over exported JSON + rater CSV. No efficacy claim until
  n, instrument, and rater protocol above are all executed and published with failures.
