# Pilot editorial review — 27 October 2026

Reviewer: coding assistant (AI-assisted review), not an independent English teacher. Three original AI-assisted readings. This was prompt development, not a held-out quality benchmark. No real-generated pack was approved.

| Draft | Finding | Release decision |
|---|---|---|
| Library, v1 | Source/EN/VI meanings grounded; correct keys identifiable, but usage distractors include gibberish and Vietnamese explanation lacks diacritics. | Repair once. |
| Library, v2 repair | Better formed distractors and diacritics; q2 incorrectly treats allocating resources for coffee/leisure as inherently wrong. These can be valid usage in a suitable context. | Critical: block approval. Manual rewrite required; repair budget used. |
| Workplace, v1 | Selection valid; exercise response reached 6,000 tokens and was not valid JSON (consistent with truncation; raw finish_reason was not retained). | Rejected, no partial pack accepted. |
| Workplace, v2 deliberate generation | Meanings/source links and transfer appropriate. q2c and q4c depend on assumed contradictory intentions; reasonable contexts may undermine the one-answer claim. | Uncertain: block approval. Replace these options before publishing. |
| Community, v1 | Correct contextual meanings and new library transfer; usage distractors contain nonsense, and an explanation overstates that a survey requires “about + topic”. | Repair once. |
| Community, v3 repair | Usage distractors now have specific article/preposition/conjunction errors; correct keys preserved. Source grounding, both meanings, all five tasks/explanations and transfer were reviewed. No critical issue identified in this sample. | Still an unapproved draft; eligible for editorial release decision, not human-certified. |

Final prompt v3 explicitly excludes subjective formality, unusual activity and presumed intent as grounds for wrong answers. It requires objective grammar/collocation errors with the specific correction. This is not a guarantee; the review gate remains necessary.

9 calls: three selections, six exercise attempts including two repairs and one deliberate retry after malformed output. All HTTP 200; one unusable JSON and eight valid stage outputs. 7,600 input / 34,977 output tokens reported. Latency per call 4.733–29.578 seconds. Actual dollar cost/remaining credits were not read from Billing and are unknown. Development success must not be presented as an independent quality score or held-out pass rate.
