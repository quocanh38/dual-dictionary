# P2: bounded Tutor evaluation — 2026-10-27

The local deterministic fixture suite passed: 6 feedback cases (5 accepted, 1 rejected) and 2 mocked API-failure requests. These fixtures verify product behavior; they do not measure Meta output quality or learning outcomes.

The live Meta sample used synthetic payloads only and made 13 requests total: 1 initial harness request, 5 short-cap harness requests, 6 corrected main-run requests, and 1 deliberate retest. No automatic retries were made. Estimated token-rate cost is **$0.0699605**; this is not a confirmed billing amount. The Meta billing page showed free credits in use, with a notice that activity can lag.

In the corrected six-case run, five responses were valid and one response at the then-configured 2,000 output-token cap was invalid. A single deliberate retest with a 10,000-token cap produced a valid response after 1,736 output tokens. The Tutor Meta adapter now uses `max_tokens: 10000` and `reasoning_effort: medium`, matching the Lesson Studio Muse Spark request settings. The cap is an upper bound; the retest did not consume the full allowance.

After AI-assisted adjudication, all six valid outputs had an exact quote and an appropriate verdict for the actual prompt and answer. The raw expected-key match was 4/5 before review because two authored expected labels were wrong: the “ambiguous reference” prompt explicitly required a project item and method, and the “missing quote” row was actually a quoted grammar-error case. The actual missing-quote case remains covered by local fixtures, not live Meta output. These six synthetic cases are descriptive only and do not support a provider-accuracy claim.

The six explanations received AI-assisted quality scores averaging 4.33/5 (1 = incorrect or unhelpful; 5 = accurate, specific, helpful). One explanation scored 2/5 because it misdiagnosed the grammar issue as using “careful” as a verb; the actual issue was a noun phrase used as a predicate without a verb. Relevance averaged 5/5. This is not an independent human review.

The cache guard passes at `mdx-dict-v128` with 60 precached files. Local tests and `git diff --check` pass. **No deployment was performed.** See `report.json`, `adjudication.json`, and the raw per-run JSON files for denominators and details.
