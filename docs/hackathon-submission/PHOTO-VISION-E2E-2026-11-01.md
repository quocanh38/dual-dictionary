# Photo path end-to-end evidence — 1 Nov 2026

Live Meta Model API vision call, real keychain key, synthetic printed notice.
No fixture output: every byte below came from the provider response.

## Vision call

- Model: `muse-spark-1.3` · endpoint `https://api.meta.ai/v1/chat/completions`
- HTTP 200 in ~3.9s
- Usage returned: 1482 prompt + 614 completion (535 reasoning) = 2096 total
- Input: 1200×900 PNG notice, 16KB file, 21,826-char data URL (under 1.5MB cap)

## Raw provider output (verbatim)

```json
{"reading_text":"NOTICE: SHIFT HANDOVER Evening shift begins at 18:00. Please hand over unfinished tasks to the night team and follow up on pending deliveries before leaving the workshop. Report equipment issues to the supervisor and record all completed checks in the logbook. Thank you for keeping the workplace safe and organised every single day."}
```

## Validator road (same as typed text)

- `parseVisionResult`: 333 chars ≥ 100 floor — PASS
- `startDraft`: 4 sentences — PASS
- `acceptSelection` with `hand over` + `follow up on` grounded in s2 — PASS, stage `selected`
- A deliberately mis-grounded target (wrong sentence ID) was REJECTED by the validator — the gate bites on vision text too

## Cost note

One vision call consumed 2096 tokens on the owner's key. No further provider
calls were made for this evidence. Repro: render any 100+ char English notice,
run `sendVisionRequest` with a keychain key, pipe through `parseVisionResult`.
