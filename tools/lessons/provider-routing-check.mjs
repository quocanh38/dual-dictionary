import assert from 'node:assert/strict';
import { sendMeta } from '../../lessons/generator.js';
import { HACKATHON_PROVIDER, META_MODEL_API_PROVIDER, providerForPurpose } from '../../lessons/provider.js';
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

  assert.equal(providerForPurpose('select-targets').id, HACKATHON_PROVIDER.id);
  assert.equal(providerForPurpose('generate-exercises').id, HACKATHON_PROVIDER.id);
  assert.equal(providerForPurpose('repair-exercises').id, META_MODEL_API_PROVIDER.id);

  globalThis.fetch = async (url, options) => {
    requests.push({ url: String(url), headers: options.headers, body: JSON.parse(options.body) });
    return respond();
  };

  const creation = await sendMeta({ apiKey: 'baseten-test-only', model: HACKATHON_PROVIDER.model }, {
    purpose: 'generate-exercises', instructions: 'Create fixture only.', input: { source: 'synthetic' },
  });
  assert.equal(requests[0].url, HACKATHON_PROVIDER.baseUrl + '/chat/completions');
  assert.equal(requests[0].headers.Authorization, 'Bearer baseten-test-only');
  assert.equal(requests[0].body.model, HACKATHON_PROVIDER.model);
  assert.equal('reasoning_effort' in requests[0].body, false);
  assert.equal(creation.providerId, HACKATHON_PROVIDER.id);

  const chosenModel = 'muse-spark-1.2-contributor';
  const repair = await sendMeta({
    providerId: META_MODEL_API_PROVIDER.id,
    providerLabel: META_MODEL_API_PROVIDER.label,
    baseUrl: META_MODEL_API_PROVIDER.baseUrl,
    model: chosenModel,
    apiKey: 'meta-test-only',
  }, { purpose: 'repair-exercises', instructions: 'Repair fixture only.', input: { source: 'synthetic' } });
  assert.equal(requests[1].url, META_MODEL_API_PROVIDER.baseUrl + '/chat/completions');
  assert.equal(requests[1].headers.Authorization, 'Bearer meta-test-only');
  assert.equal(requests[1].body.model, chosenModel);
  assert.equal(requests[1].body.reasoning_effort, 'medium');
  assert.equal(repair.providerId, META_MODEL_API_PROVIDER.id);
  assert.equal(repair.providerLabel, META_MODEL_API_PROVIDER.label);
  assert.equal(repair.model, chosenModel);
  assert.equal(JSON.stringify(repair).includes('test-only'), false);

  console.log('PASS creation routes to Baseten; selectable Meta model and credential are used for repair (2 fake calls, 0 live calls)');
} finally {
  globalThis.fetch = originalFetch;
}
