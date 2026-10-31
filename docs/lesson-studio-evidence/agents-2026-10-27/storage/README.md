# Historical Studio and existing learner storage regression

`legacy-storage-tests.json` records 12 passing assertions/groups from isolated
Chrome browser contexts on the shared QA checkout. The suite is
`tools/lessons/legacy-storage-check.cjs` and uses `DD_QA_BASE_URL` (default
`http://127.0.0.1:8877`) and `DD_QA_OUTPUT` (default this directory).

Historical generator/storage modules are read directly with `git show` from
`8b7e0f267` (first Offline Lesson Studio implementation). They create older
Studio records in the browser before current modules create newer records.
This verifies compatibility with the actual historical schema-v1 record
shapes, not a claimed database-version migration. No real user profile is
opened or changed.

Covered: mixed snapshot/integrity validation, newer local revision wins during
merge, clean-context exact restore, preservation of both installed pack
versions, atomic conflict rollback, real library file import preserving old
progress, real completion-screen duplicate Vault save, and exact preservation
of learner notes, due date, FSRS state and review log after operations/reload.
The Vault card and review history are synthetic QA fixtures using current
public persistence APIs; they are not a historical user's data or an FSRS
scheduling efficacy evaluation.

The authored example is imported without changing its existing approval
metadata. No candidate is approved, no provider call is made, and nothing is
published. This is persistence regression QA, not approved candidate release
QA, language-quality certification, physical-device testing or a test of all
historical localStorage migrations. A focused follow-up fixes a late connection after a rejected blocked open:
`storage.js` now closes that connection immediately instead of resolving an
already rejected promise. This is a code-path lifecycle finding, not a
reproduction of a user-visible storage failure.

Additional failure checks reject a stale draft revision without changing any
Studio records and temporarily inject a synchronous `SecurityError` from
`IDBFactory.open`. Backup rejects that denial and succeeds after restoring the
native method, with all records unchanged. This is fault injection, not proof
that browser storage policy or disk failures recover automatically.
`onversionchange` closes successful Studio connections; no database-version
upgrade is exercised because Studio remains schema version 1. The real-browser blocked-open request lifecycle is not covered by these
assertions. A separate deterministic fake-IndexedDB test,
`tools/lessons/storage-open-check.mjs`, verifies blocked rejection, late
connection close, a normal retry snapshot, and the versionchange close handler.
It passes four groups. Chrome persistence QA was rerun after the fix; all
12 browser groups pass with current file hashes in the JSON evidence.

Run from the repository root:

```
NODE_PATH=/Users/nguyenquocanh/Documents/DSH/ui-check/node_modules /tmp/node-dsh/bin/node tools/lessons/legacy-storage-check.cjs
```

Chrome execution may require the same sandbox escalation as the existing QA
suites. The browser helper also supports a dedicated loopback CDP endpoint;
no existing personal browser context is reused.
