# Provider routing handoff — 29 October 2026

## Current state

Local candidate v150 changes Lesson Studio creation to Baseten Muse Spark Open
and optional single repair to a user-selected Meta Model API text model. The
Codex user configuration defaults to Meta Muse Spark 1.3, with selectable
profiles for supported Meta text models and two GPT review profiles. Credentials
are read from environment/Keychain at use time and are not stored in Codex
configuration or lesson artifacts. No live provider calls, usage/Billing lookup,
deploy, push or commit was made in this work session.

## Verification

Fake-endpoint provider-routing tests confirm Baseten creation and selected Meta
repair routing without live calls. Configuration parses as TOML, Meta key helper
works with a test-only environment value without printing it, and Codex CLI
recognizes named profiles. Contract, offline-shell, quality-gate, batch-input,
browser-runtime mock, storage, budget, network and repair-preflight checks passed.
`git diff --check` and JavaScript syntax checks passed.

Playwright browser QA could not start: Chrome aborted before assertions with
macOS Crashpad `EPERM`/permission-denied errors. Do not report browser QA as
passing. Production remains v149; v150 is local and not deployed.

## Open limitation and next step

Codex custom providers currently use the Responses wire protocol; Baseten's
published Muse Spark Open example uses Chat Completions. Therefore Codex itself
uses the Meta Model API for code generation, while Baseten creates Lesson Studio
draft content. GPT profiles are reserved for review by workflow convention.

Next: after the owner requests it, run the repository's full-snapshot deploy
runbook and verify production parity. Until then, keep v150 as a local candidate.
