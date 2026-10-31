import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateTutorFeedback } from '../../js/tutor-validation.js';
import { askTutor, saveAiSettings } from '../../js/ai-client.js';

const fixture = JSON.parse(await readFile(new URL('./fixtures/product-evaluation.json', import.meta.url), 'utf8'));
const ids = [...fixture.feedbackCases, ...fixture.apiCases].map(item => item.id);
assert.equal(new Set(ids).size, ids.length, 'Duplicate case ID');
assert.equal(fixture.feedbackCases.length, 6);
assert.equal(fixture.apiCases.length, 2);
for (const item of fixture.feedbackCases) {
  assert.ok(item.rationale && item.prompt && item.answer);
  if (item.error) {
    assert.throws(() => validateTutorFeedback(item.raw, item.answer), new RegExp(item.error));
    continue;
  }
  const actual = validateTutorFeedback(item.raw, item.answer);
  for (const [key, value] of Object.entries(item.expected)) assert.equal(actual[key], value, `${item.id}: ${key}`);
  assert.deepEqual(validateTutorFeedback(actual, item.answer), actual, `${item.id}: normalization must be idempotent`);
}

// Every request is intercepted in-process; there is no fallback to native fetch.
const originalFetch = globalThis.fetch;
const originalStorage = globalThis.localStorage;
let mockRequests = 0;
try {
  const values = new Map();
  globalThis.localStorage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
  saveAiSettings({ provider: 'meta', apiKey: 'fixture-only-not-a-real-key', baseUrl: 'https://api.meta.ai/v1', model: 'fixture-only' });
  for (const item of fixture.apiCases) {
    globalThis.fetch = async () => { mockRequests++; return { ok: false, status: item.status }; };
    await assert.rejects(askTutor({ instructions: 'Fixture only', input: 'Authored test input' }), new RegExp(item.error));
  }
  assert.equal(mockRequests, fixture.apiCases.length, 'One attempt per fixture; no automatic retry');
} finally {
  globalThis.fetch = originalFetch;
  if (originalStorage === undefined) delete globalThis.localStorage;
  else globalThis.localStorage = originalStorage;
}
console.log(JSON.stringify({ status: 'PASS', provenance: 'authored-development-fixtures', feedbackCases: 6, feedbackAccepted: 5, feedbackRejected: 1, apiFailureCases: 2, mockRequests, realProviderCalls: 0, providerAccuracy: 'not-measured', learningOutcomes: 'not-measured' }, null, 2));
