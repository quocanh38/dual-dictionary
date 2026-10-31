import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const source = await fs.readFile('js/ai-client.js', 'utf8');
const { getAiSettings, saveAiSettings, askTutor } = await import(
  'data:text/javascript;base64,' + Buffer.from(source).toString('base64')
);
const values = new Map();
globalThis.localStorage = {
  getItem: (key) => values.get(key) ?? null,
  setItem: (key, value) => values.set(key, String(value)),
  removeItem: (key) => values.delete(key),
};

assert.equal(getAiSettings().baseUrl, 'https://api.meta.ai/v1');
assert.equal(getAiSettings().model, 'muse-spark-1.3');
assert.throws(() => saveAiSettings({ provider: 'meta', apiKey: 'test', baseUrl: 'http://example.com', model: 'm' }), /HTTPS/);
saveAiSettings({ provider: 'meta', apiKey: 'test-only-never-real', baseUrl: 'https://api.meta.ai/v1', model: 'muse-spark-1.3' });

let seen;
globalThis.fetch = async (url, options) => {
  seen = { url, options };
  return { ok: true, json: async () => ({ choices: [{ message: { content: '{"status":"ok"}' } }] }) };
};
assert.deepEqual(await askTutor({ instructions: 'test', input: 'hello' }), { status: 'ok' });
assert.equal(seen.url, 'https://api.meta.ai/v1/chat/completions');
assert.equal(seen.options.headers.Authorization, 'Bearer test-only-never-real');
const metaBody = JSON.parse(seen.options.body);
assert.equal(metaBody.model, 'muse-spark-1.3');
assert.equal(metaBody.max_tokens, 32768);
assert.equal(metaBody.reasoning_effort, 'medium');

saveAiSettings({ provider: 'compatible', apiKey: 'test-compatible', baseUrl: 'https://example.test/v1', model: 'test-model' });
globalThis.fetch = async (_url, options) => {
  seen = { options };
  return { ok: true, json: async () => ({ choices: [{ message: { content: '{"status":"ok"}' } }] }) };
};
await askTutor({ instructions: 'test', input: 'hello' });
const compatibleBody = JSON.parse(seen.options.body);
assert.equal(compatibleBody.max_tokens, undefined, 'Meta-only output limits must not leak to other providers');
assert.equal(compatibleBody.reasoning_effort, undefined);
saveAiSettings({ provider: 'meta', apiKey: 'test-only-never-real', baseUrl: 'https://api.meta.ai/v1', model: 'muse-spark-1.3' });

for (const [status, message] of [
  [401, /rejected the key/],
  [403, /rejected the key/],
  [500, /Provider request failed/],
  [402, /billing or available quota/],
  [429, /rate limit or quota/],
  [400, /rejected the request/],
]) {
  globalThis.fetch = async () => ({ ok: false, status });
  await assert.rejects(askTutor({ instructions: 'test', input: 'hello' }), message);
}

globalThis.fetch = async () => { throw new TypeError('network'); };
await assert.rejects(askTutor({ instructions: 'test', input: 'hello' }), /CORS support/);

globalThis.fetch = async () => ({ ok: true, json: async () => ({ choices: [{ message: { content: 'not-json' } }] }) });
await assert.rejects(askTutor({ instructions: 'test', input: 'hello' }), /not valid JSON/);

for (const data of [null, {}, { choices: [] }]) {
  globalThis.fetch = async () => ({ ok: true, json: async () => data });
  await assert.rejects(askTutor({ instructions: 'test', input: 'hello' }), /unexpected response/);
}
globalThis.fetch = async () => ({ ok: true, json: async () => { throw new SyntaxError('bad json'); } });
await assert.rejects(askTutor({ instructions: 'test', input: 'hello' }), /non-JSON response/);

globalThis.fetch = (_url, options) => new Promise((_resolve, reject) => {
  if (options.signal.aborted) { reject(new DOMException('Aborted', 'AbortError')); return; }
  options.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
});
const cancelled = new AbortController();
const cancelledRequest = askTutor({ instructions: 'test', input: 'hello', signal: cancelled.signal });
cancelled.abort('cancelled');
await assert.rejects(cancelledRequest, /Request cancelled/);

const alreadyCancelled = new AbortController();
alreadyCancelled.abort();
await assert.rejects(askTutor({ instructions: 'test', input: 'hello', signal: alreadyCancelled.signal }), /Request cancelled/);

const timedRequest = askTutor({ instructions: 'test', input: 'hello', timeoutMs: 5 });
await assert.rejects(timedRequest, /timed out/);

console.log('PASS: Meta defaults, HTTPS validation, request shape, auth header, provider status errors, browser/CORS error, malformed JSON, cancellation, timeout');
