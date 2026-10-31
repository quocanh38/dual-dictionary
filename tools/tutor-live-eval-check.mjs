import assert from 'node:assert/strict';
import { LIVE_EVAL_CASES, summarizeLiveEvalResults } from './tutor-live-eval-cases.js';

const ids = LIVE_EVAL_CASES.map((item) => item.id);
assert.equal(new Set(ids).size, ids.length, 'Live evaluation IDs must be unique');
for (const id of ['natural-use', 'incorrect-use', 'off-topic', 'missing-required-detail', 'quoted-grammar-error']) {
  assert.ok(ids.includes(id), `Missing required P2 case: ${id}`);
}
assert.ok(LIVE_EVAL_CASES.find((item) => item.id === 'quoted-grammar-error').quoteRequired);

const rows = new Map([
  ['correct', { status: 'success', expectedVerdictPass: true, quoteValid: true, explanationQuality: '5', elapsedMs: 220 }],
  ['bad-quote', { status: 'error', errorCategory: 'invalid-quote', elapsedMs: 90 }],
  ['api-error', { status: 'error', errorCategory: 'provider-error', elapsedMs: 410 }],
]);
assert.deepEqual(summarizeLiveEvalResults(rows), {
  authoredCases: 24,
  casesAttempted: 3,
  providerCalls: 3,
  questions: 3,
  successfulResponses: 1,
  verdictScored: 1,
  verdictMatched: 1,
  quoteScored: 1,
  quoteValid: 1,
  explanationQualityScored: 1,
  latencySamples: 3,
  errors: 2,
  errorTypes: ['invalid-quote', 'provider-error'],
});
console.log('PASS P2 live case coverage and separate case/call/response/verdict/quote/explanation/latency/error denominators');
