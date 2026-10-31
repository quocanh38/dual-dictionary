import assert from 'node:assert/strict';
import { mkdtemp, access, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { prepareBatchSources } from './batch-input.mjs';

const node = process.execPath;
const script = fileURLToPath(new URL('./batch.mjs', import.meta.url));
const article = 'A university team reviewed the transport proposal and compared its costs with the available evidence. The decision was recorded for the next planning meeting.';
const valid = (sourceId, purpose = 'development') => ({
  sourceId, purpose, title: 'Transport review', author: 'Test author', article,
  rightsConfirmed: true, rightsStatement: 'Original test source', sourceType: 'original',
  topic: 'academic', levelEstimate: 'B1',
});
let count = 0;
const test = (name, fn) => { fn(); count++; console.log('PASS ' + name); };

test('preflights all sources and returns drafts before any call', () => {
  const prepared = prepareBatchSources([valid('first'), valid('second', 'evaluation')]);
  assert.equal(prepared.length, 2);
  assert.ok(prepared.every((item) => item.draft.stage === 'source'));
});
test('invalid later purpose blocks the entire batch', () => {
  assert.throws(() => prepareBatchSources([valid('first'), valid('second', 'guess')]), /purpose/);
});
test('invalid later rights or reading blocks the entire batch', () => {
  const noRights = valid('second'); noRights.rightsConfirmed = false;
  assert.throws(() => prepareBatchSources([valid('first'), noRights]), /rights/);
  const short = valid('second'); short.article = 'Too short.';
  assert.throws(() => prepareBatchSources([valid('first'), short]), /100–12,000/);
});
test('unexpected fields, duplicate IDs and credentials are rejected', () => {
  const extra = valid('first'); extra.apiKey = 'placeholder';
  assert.throws(() => prepareBatchSources([extra]), /Unexpected/);
  assert.throws(() => prepareBatchSources([valid('same'), valid('same')]), /unique/);
  const credential = valid('first'); credential.article += ' LLM_123456_abcdefghijklmnop';
  assert.throws(() => prepareBatchSources([credential]), /Credential-like/);
});

const dir = await mkdtemp(path.join(tmpdir(), 'dd-batch-preflight-'));
try {
  const sourcesPath = path.join(dir, 'sources.json');
  const ledgerPath = path.join(dir, 'ledger.json');
  const outputPath = path.join(dir, 'new-output');
  await writeFile(sourcesPath, JSON.stringify([valid('first'), valid('second', 'guess')]));
  const child = spawnSync(node, [script, sourcesPath, ledgerPath, outputPath], {
    encoding: 'utf8', env: { ...process.env, BASETEN_API_KEY: '' },
  });
  assert.notEqual(child.status, 0);
  assert.match(child.stderr, /purpose/);
  await assert.rejects(access(ledgerPath + '.lock'));
  await assert.rejects(access(outputPath));
} finally {
  await rm(dir, { recursive: true, force: true });
}
count++;
console.log('PASS malformed late source fails before lock, output or provider key check');
const ledgerDir = await mkdtemp(path.join(tmpdir(), 'dd-batch-ledger-'));
try {
  const sourcesPath = path.join(ledgerDir, 'sources.json');
  const ledgerPath = path.join(ledgerDir, 'ledger.json');
  const outputPath = path.join(ledgerDir, 'new-output');
  await writeFile(sourcesPath, JSON.stringify([valid('first')]));
  await writeFile(ledgerPath, JSON.stringify({ schemaVersion: 1, requests: 'corrupt' }));
  const child = spawnSync(node, [script, sourcesPath, ledgerPath, outputPath], {
    encoding: 'utf8', env: { ...process.env, BASETEN_API_KEY: 'local-test-placeholder' },
  });
  assert.notEqual(child.status, 0);
  assert.match(child.stderr, /Invalid budget ledger/);
  await assert.rejects(access(ledgerPath + '.lock'));
  await assert.rejects(access(outputPath));
} finally {
  await rm(ledgerDir, { recursive: true, force: true });
}
console.log('PASS corrupt ledger fails before output, reservation or Meta request');
count++;
console.log(count + ' batch preflight groups PASS');
