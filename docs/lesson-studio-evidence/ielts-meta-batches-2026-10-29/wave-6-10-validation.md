# IELTS practice waves 6–10 — validation record

Date: 29 October 2026.

Baseten Muse Spark Open (meta-models/muse-spark-open-1026) generated 400 original formative IELTS items across five waves and four pathway stages. Each stage/wave candidate contains 20 items: five each for Listening, Reading, Writing and Speaking. GPT-6-Luna and GPT-6.1-Sol reviewed each final candidate in full, recorded exact SHA-256 values, and passed every selected final hash. Findings led to documented Meta repairs and versioned candidates; only the reviewed versions below were integrated.

The 400 new items bring the practice bank to 800 Meta-authored items across Waves 1–10: 200 per stage and 50 per skill per stage. Listening/Reading objective practice now has 400 questions; Writing and Speaking each have 200 prompts. The separate IELTS diagnostic remains 40 Listening plus 40 Reading questions. Five-question Reading passages are short-form practice, not full-length IELTS passages or calibrated band tests.

## Final candidate hashes

| Wave | Pathway stage | Candidate | SHA-256 | GPT-6-Luna / GPT-6.1-Sol |
|---|---|---|---|---|
| wave-6 | band-5 | candidate-final-v3.json | 956a2dfaed9309163c906ce7cc8511adbead0e8d04a1eed64a7ee8bfc3446a89 | Pass / Pass |
| wave-6 | band-6 | candidate-final-v4.json | 9b15e208692c30b9ff541f855df1c998cb0bdde58bf05bbcbfd17b091f9a685b | Pass / Pass |
| wave-6 | band-6-5 | candidate-final-v2.json | 0aa86ee4abf77d02fec7859769daba5befecda78e10df9a0771311f5ad28f53c | Pass / Pass |
| wave-6 | band-7 | candidate-final-v2.json | e376d93a520d586ebfd4181838cd0af143fa1879d292eee658f446d9fce8de9b | Pass / Pass |
| wave-7 | band-5 | candidate-final-v2.json | 3b8c994df478f419af7f7815dccd3a931a186a75a690f9fbda5738e5246a69ad | Pass / Pass |
| wave-7 | band-6 | candidate-final-v2.json | 416f49e30f5abfe2c6d3fcc31192ddb789caf151d66ddfa9a26ad2bd9b63c6a2 | Pass / Pass |
| wave-7 | band-6-5 | candidate-final-v2.json | 134d30e8ee09ede60d49effa92babd40b77e87f848b97307439250c94fbcbe35 | Pass / Pass |
| wave-7 | band-7 | candidate-final-v2.json | e38b085749af3fff23f4c48fe6807fa04540160855daaa83e6ce8ff53df5e044 | Pass / Pass |
| wave-8 | band-5 | candidate-final-v3.json | e1f96a2b0ba94617965237f40f865c74216757e3ba317d093f78f043000846f1 | Pass / Pass |
| wave-8 | band-6 | candidate-final-v3.json | 26029e8b86d1afd55df40a197788ca886959feaac6afd2dba0315d40c88c51e5 | Pass / Pass |
| wave-8 | band-6-5 | candidate-final-v2.json | 348fbf3cd5425a65f4c4ee2e45b85bfdf262bbe8402303fb40e0d5322b0c2930 | Pass / Pass |
| wave-8 | band-7 | candidate-final-v3.json | d1ee73bd7febf0c152ec31ba325dd5536ca0b066dc65f52314f5f46bb1c4ac8d | Pass / Pass |
| wave-9 | band-5 | candidate-final-v2.json | b4dc5ea4a2aafc43889684f0581857e88da156e9cde75706a8a8f5beb43c1712 | Pass / Pass |
| wave-9 | band-6 | candidate-final-v2.json | 0a642e443c1a75a0cea9ea3fd30215ef87a5ee87f9a0318fdc189362e076168a | Pass / Pass |
| wave-9 | band-6-5 | candidate-final-v2.json | b7893fc59b476ea00c02e6ba3a97001c3f578023571f8ed35ff955e7395ae2aa | Pass / Pass |
| wave-9 | band-7 | candidate-final-v2.json | 1029d7923c7fe78c2d7f4df75b002e141e9de571eb2ea2292f52bbd58972d7ef | Pass / Pass |
| wave-10 | band-5 | candidate-final-v2.json | 07fc1f1483046dacd07084922c4bba99070e70f1958a5d0a9f9ffdbb086f349e | Pass / Pass |
| wave-10 | band-6 | candidate-final-v2.json | 70f3e5ed7e64c815ce3c55ff6c496e275f081223c2e5c398c91cf42f695836fd | Pass / Pass |
| wave-10 | band-6-5 | candidate-final-v4.json | f76a844b7ca74ce5469a3eb75aff9368daab9dede7941951c90f53e149661440 | Pass / Pass |
| wave-10 | band-7 | candidate-final-v2.json | 1d291ef42ecaca212f078d0603fbb5798307977f4a891ab070086d1e51ab751a | Pass / Pass |

Generated integration module: js/ielts-meta-practice.js, SHA-256 3f8911e009db771468be2135bcf3c5b1045f943795d83ca04eff04c509c2f216. The exact hashes, Meta requests/responses and independent GPT reports remain beside each candidate under the corresponding wave/stage evidence directory.

## Validation

- Hash-gated integration: PASS; 40 source batches, 800 globally unique Meta item IDs, 200 per skill and 50 per skill per stage across the complete 10-wave bank.
- tools/tutor/check.mjs: PASS; 920 total stable pack IDs and 800 exact-hash reviewed Meta items.
- tools/tutor/assignment-engine-check.mjs: PASS.
- tools/tutor/offline-study-smoke.cjs: PASS; staged practice, 80-question diagnostics, local drafts/recordings, resume, backup and restore paths; zero page errors.
- tools/tutor/offline-cache-smoke.cjs: PASS at 1280px and 390px after network loss; required modules and illustration available from cache.
- tools/tutor/ai-client-check.mjs, tools/lessons/check.mjs, tools/lessons/budget-check.mjs, syntax checks and CRLF-aware diff check: PASS.
- Supplemental Lesson Studio recovery-check.cjs was attempted but its dedicated localhost QA server at 127.0.0.1:8765 was not running, so that separate suite made no assertions. IELTS-focused browser smoke tests above passed.

Pack version 2.9.0 and service-worker cache v147 are local. No commit, push, or deployment was made.
