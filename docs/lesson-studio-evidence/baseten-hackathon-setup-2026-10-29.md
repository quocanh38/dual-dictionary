# Baseten hackathon provider setup — 29 October 2026

Owner-provided hackathon email authorizes $100 in Baseten credits and up to 2M
tokens/minute for Muse Spark Open. Configure all new Lesson Studio generation
and IELTS batch requests to the OpenAI-compatible Baseten Chat Completions API:

- Base URL: `https://inference.baseten.co/v1`
- Hackathon model: `meta-models/muse-spark-open-1026` (use this exact ID)
- Maximum output: 65,536 tokens, preserving the owner's earlier request to
  remove the former 10,000-token ceiling.
- Muse Spark Open reasoning is always on. The generator reads the final
  `message.content`, stores the exact final JSON text, and does not record
  `reasoning_content`.
- Baseten's public pricing page currently lists $1.25/M input tokens,
  $0.15/M cached input tokens and $4.25/M output tokens. The local estimator
  conservatively prices all input at the uncached rate. Reasoning tokens count
  as output tokens. This is pricing metadata, not a check of the user's credit
  balance or account usage.

Credentials use the dedicated macOS Keychain item service
`BASETEN_API_KEY`, account `DD-lesson-studio`, or an ephemeral environment
variable of the same name. The previous `DD_META_KEY` item is kept separate
and is never sent to Baseten.

The owner stored the credential in macOS Keychain under the service and account
above. `tools/lessons/meta-run.mjs --status` confirmed it is available to this
worktree; the key value was not displayed or written into the repository. Do
not ask the owner to post the key in chat.

On 29 October 2026, wave 5 IELTS generation completed eight Baseten requests
(five Listening/Reading passages and questions plus five Writing and five
Speaking prompts for each of four stages). Six GPT-reviewed Muse Spark repair
calls then completed successfully. All 14 calls returned HTTP 200; per-request
usage and final responses are retained in `ielts-meta-batches-2026-10-29/wave-5/`.
Both gpt-6-luna and gpt-6.1-sol passed all four final exact-hash candidates.
The 80 items are integrated locally, bringing the practice bank to 400 items;
no account usage/Billing lookup, push, or deploy occurred.

The changes in this worktree configure the Lesson Studio browser defaults and
the CLI batch/generation wrappers. They are local and uncommitted; no deploy,
push, account usage lookup, or Billing lookup was performed.

References: [Baseten Chat Completions](https://docs.baseten.co/reference/inference-api/chat-completions),
[Baseten reasoning behavior](https://docs.baseten.co/inference/model-apis/reasoning),
[Baseten pricing](https://www.baseten.co/pricing/).


## IELTS waves 6–10 integrated — 29 October 2026 (before v149 deploy)

Five additional Baseten Muse Spark waves generated 400 original practice items across the four pathway stages. Each of the 20 stage/wave candidates contains five items per skill and passed exact-hash GPT-6-Luna and GPT-6.1-Sol review after any required Meta repairs. Wave 10 band-6.5 needed a third objective repair because changed totals made an old Listening distractor true; the final v4 candidate changed that option and both reviewers passed the new hash. The bank now contains 800 reviewed practice items (200 per stage; 50 per skill per stage) and 400 objective items, plus the separate IELTS diagnostic bank. The batch pipeline supports up to 65,536 output tokens. The generated module hash is 3f8911e009db771468be2135bcf3c5b1045f943795d83ca04eff04c509c2f216; pack v2.9.0 and cache v147 described the pre-release candidate. That candidate was deployed as v149 below; no account usage/Billing lookup occurred. Full candidate hashes and review reports are in the per-wave evidence folders.


## Release outcome — 29 October 2026

The wave 10 release is live as v149: Netlify deploy `6ae3188c4be8b59f21e381ff`, source commit `949ac4c2f13806a4b0a5b66aefbfbe013092a914`, published 16:58:05 Asia/Ho_Chi_Minh. The production inventory comparison found zero live-only, SHA or document drift; production HTTP smoke passed 7/7 on attempt 1. Generation and repair routing were recorded above. The owner handles credit monitoring; no account usage or Billing lookup was performed.
