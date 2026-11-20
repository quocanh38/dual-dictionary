import assert from 'node:assert/strict';
import { sendMeta } from '../../lessons/generator.js';
import { GEMINI_PROVIDER, providerForPurpose } from '../../lessons/provider.js';
import { getMetaApiKey } from './meta-key.mjs';

const originalFetch = globalThis.fetch;
const requests = [];
function respond(content = '{}') {
  return new Response(JSON.stringify({
    choices: [{ message: { content }, finish_reason: 'stop' }],
    usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
  }), { status: 200, headers: { 'Content-Type': 'application/json' } });
}

try {
  const previousMetaKey = process.env.DD_META_KEY;
  process.env.DD_META_KEY = 'meta-test-only';
  assert.deepEqual(getMetaApiKey(), { key: 'meta-test-only', source: 'environment' });
  if (previousMetaKey === undefined) delete process.env.DD_META_KEY;
  else process.env.DD_META_KEY = previousMetaKey;

  assert.equal(providerForPurpose('select-targets').id, GEMINI_PROVIDER.id);
  assert.equal(providerForPurpose('generate-exercises').id, GEMINI_PROVIDER.id);
  assert.equal(providerForPurpose('repair-exercises').id, GEMINI_PROVIDER.id);

  globalThis.fetch = async (url, options) => {
    requests.push({ url: String(url), headers: options.headers, body: JSON.parse(options.body) });
    return respond();
  };

  const creation = await sendMeta({ apiKey: 'gemini-test-only', model: GEMINI_PROVIDER.model }, {
    purpose: 'generate-exercises', instructions: 'Create fixture only.', input: { source: 'synthetic' },
  });
  assert.equal(requests[0].url, GEMINI_PROVIDER.baseUrl + '/chat/completions');
  assert.equal(requests[0].headers.Authorization, 'Bearer gemini-test-only');
  assert.equal(requests[0].body.model, GEMINI_PROVIDER.model);
  assert.equal(creation.providerId, GEMINI_PROVIDER.id);

  const chosenModel = 'gemini-3.8-flash';
  const repair = await sendMeta({
    providerId: GEMINI_PROVIDER.id,
    providerLabel: GEMINI_PROVIDER.label,
    baseUrl: GEMINI_PROVIDER.baseUrl,
    model: chosenModel,
    apiKey: 'gemini-test-only',
  }, { purpose: 'repair-exercises', instructions: 'Repair fixture only.', input: { source: 'synthetic' } });
  assert.equal(requests[1].url, GEMINI_PROVIDER.baseUrl + '/chat/completions');
  assert.equal(requests[1].headers.Authorization, 'Bearer gemini-test-only');
  assert.equal(requests[1].body.model, chosenModel);
  assert.equal(repair.providerId, GEMINI_PROVIDER.id);
  assert.equal(repair.providerLabel, GEMINI_PROVIDER.label);
  assert.equal(repair.model, chosenModel);
  assert.equal(JSON.stringify(repair).includes('test-only'), false);

  console.log('PASS creation and repair route to Gemini provider with selected model and no credential leakage (2 fake calls, 0 live calls)');
} finally {
  globalThis.fetch = originalFetch;
}
