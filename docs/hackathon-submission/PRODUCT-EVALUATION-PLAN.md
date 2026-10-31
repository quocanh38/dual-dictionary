# Bounded product evaluation — 27 October 2026

Status: authored development fixtures and local validation complete. No provider calls, participant study, approval or deployment. This set tests the existing optional Tutor feedback boundary; it is not the Studio lesson-pack editorial rubric or an assessment of complete product efficacy.

## Existing evidence and purpose

`tools/tutor-live-eval.js` already defines four live tasks (natural use, incorrect grammar, off-topic and missing required phrase). `tools/tutor/quality-contract-check.mjs` covers quote/context guards and save/accept behavior; `tools/tutor/ai-client-check.mjs` covers HTTP/network/cancel handling. Those remain separate evidence. The new small, machine-readable set connects written task rationales to exact expected validation behavior and failure accounting. It adds no claim that a model can reliably identify these cases.

`tools/lessons/fixtures/product-evaluation.json` contains original authored answers and simulated provider outputs, not captured Meta results. The six feedback fixtures exercise the actual `validateTutorFeedback(raw, answer)` API. The two API fixtures exercise `askTutor` with in-process HTTP failures; native fetch is replaced before every call and never invoked.

| Case | Expected product handling | Evaluation distinction |
|---|---|---|
| Correct | Keep `correct`; no error quotation required | A natural answer is authored into the fixture; the validator does not discover correctness |
| Incorrect | Keep quoted subject–verb diagnosis | Exact quotation proves provenance, not diagnosis correctness |
| Off-topic | Preserve quoted task-relevance failure | Off-topic does not mean ungrammatical; relevance remains a provider/editor judgment |
| Ambiguous context | Downgrade context-only pronoun correction to uncertain; remove suggestion | Missing referent alone does not substantiate a language error |
| Missing quote | Downgrade incorrect claim to uncertain; remove correction | A plausible diagnosis still requires evidence before confirmation |
| Fabricated quote | Throw and reject feedback | No fabricated quotation becomes learner evidence |
| API 401 | Reject with credential error | Not a language-quality result |
| API 500 | Reject with provider failure | Not an answer verdict; no automatic retry |

## Reproduce and results

From the repository root, with recent Node:

```sh
node tools/lessons/product-evaluation-check.mjs
```

Executed on 27 October using bundled Node. Result: **PASS**. Denominators are deliberately separate:

- Feedback validator: 6 authored cases, 5 returned normalized feedback as expected (including two uncertain downgrades), 1 deliberately rejected an invented quotation. Normalized outputs are also checked for idempotence. `feedbackAccepted` in JSON means returned by the validator, not accepted by a learner or independently judged correct.
- Transport: 2 simulated failure cases, 2 mocked request attempts, both rejected as expected; zero retry attempts.
- Actual provider requests: **0**. Provider accuracy, real latency/tokens/cost and learning outcomes: **not measured**. Do not report these eight fixtures as eight successful model answers or merge them with historical live results.

This is deterministic local contract verification. It does not run the browser accept handler, Review persistence or offline UI; use their existing browser/quality-contract checks for those behaviors.

## Future bounded live evaluation, only when authorized

Freeze prompt/model/code identity and an independent set of unseen readings/answers first. Keep this authored set in development; once an answer is used to tune prompts it cannot count as unseen evaluation. Include natural valid answers, objective errors, task-relevance failures and ambiguity; keep missing-quote/fabricated-output/API injection as robustness tests reported separately from semantic accuracy.

Before any live call, record a finite call/token budget, consent and billing context. Preserve original request/response, timestamps, usage and failures. No automatic retries; account for deliberate repair calls separately. Do not send private learner writing or keys in evidence. If the required provider access or budget is absent, record not-run rather than substituting fixture output.

Report sources, answers, attempted calls, successful HTTP responses, valid parsed responses, editor-assessed verdict matches, uncertain cases and API failures with their own denominators. Failed calls count as attempts, not semantic verdicts. Record AI-assisted reviewer identity honestly. Measure raw provider verdict and post-validation verdict separately, so a safety downgrade is not presented as the provider having recognized ambiguity.

A broader live evaluation can inform product limits; it cannot replace exact-pack editorial review/owner approval or establish learning gains without an appropriate learner study.
