# Free-credit preflight — 27 October2026

Named macOS Keychain credential is available outside sandbox; no secret value
was printed, copied into arguments or written to repository. Meta launcher
loads it only into the batch child environment.

Authenticated official Billing displayed free credits in use USD149.26, with
warning that activity can lag by one hour. No billing settings were changed.
The local ledger holds a USD5 safety reserve and pessimistic per-request
reservations; it is not an account-wide hard billing cap. Stop on402, uncertain
usage or exhausted local budget, without retries or paid-balance fallback.

Current pricing was rechecked at https://dev.meta.ai/docs/pricing-rate-limits:
Muse Spark1.3 standard input USD1.25 and output USD4.25 per million tokens.
This batch uses original development sources, no learner data or code.
Raw responses, errors, latency and usage are retained separately from edits.
Review will use Luna first, Sol final; GPT review quota differs from Meta
generation credits. No performance/learning claims follow from these calls.
