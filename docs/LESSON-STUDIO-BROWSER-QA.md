# Lesson Studio browser regression routes

Run from the repository root with a recent Node runtime and the existing
`playwright-core` installation on `NODE_PATH`. Serve this exact checkout at
`http://127.0.0.1:8765` by default, or set `DD_QA_BASE_URL` to a dedicated
loopback HTTP origin (the agents session used port 8877). Set `DD_LESSON_ROOT` to the checkout and `DD_QA_OUTPUT`
to an evidence directory. The HTTP server and browser must be reachable from
the execution environment; sandbox loopback/network restrictions may differ.

The browser suites use `browser-runtime.cjs`:

- Default: system Chrome headless.
- `DD_BROWSER_HEADED=1`: system Chrome with a visible window.
- `DD_CDP_ENDPOINT=http://127.0.0.1:9222`: attach Playwright to a dedicated QA
  Chrome already started with remote debugging. Only loopback endpoints without
  URL credentials are accepted. Do not use a personal browsing profile.

Every route creates isolated contexts; CDP does not reuse existing user tabs.
Cleanup closes the suite contexts and disconnects the CDP client. No mode
falls back automatically or treats unavailable assertions as passing.

Run the relevant suites:

```
node tools/lessons/browser-runtime-check.cjs
node tools/lessons/browser.cjs
node tools/lessons/recovery-check.cjs
node tools/lessons/backup-check.cjs
node tools/lessons/import-ui-check.cjs
node tools/lessons/persistence-ui-check.cjs
node tools/lessons/authoring-reload-check.cjs
node tools/lessons/legacy-storage-check.cjs
node tools/lessons/keyboard-check.cjs
node tools/lessons/storage-open-check.mjs
```

The runtime check mocks browser APIs; it verifies route selection and failure
reporting, not browser behavior. `browser-startup.json` records STARTED or
BLOCKED separately from suite assertion results. Use a fresh output directory
for each run; old suite PASS artifacts are not evidence for a new attempt.
A nonzero suite exit remains a failure even if Chrome started successfully.

If all automation routes are unavailable, record manual Chrome UI evidence
with exact commit, viewport and cases: no-key import/play, wrong/right answer,
transfer writing, Vault and Review, reload, network cut, provider error and
cancel, backup merge with existing data, and keyboard focus. Mark automation
BLOCKED and manual cases individually; do not convert skipped suites to PASS.

27 October execution: sandbox headless launch failed SIGABRT/EPERM; the same
system Chrome launched outside the sandbox and the focused suites passed.
A later agents run verified a real loopback CDP connection with the keyboard
suite and verified that disconnect preserves the pre-existing blank page while
closing suite contexts. This used a separate temporary QA profile. A physical
phone and headed Chrome run were not performed. See the agents-2026-10-27
evidence directory; production remains unchanged.
