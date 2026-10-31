import assert from 'node:assert/strict';
import { access, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = fileURLToPath(new URL('../..', import.meta.url));
const script = fileURLToPath(new URL('./repair.mjs', import.meta.url));
const pack = JSON.parse(await readFile(path.join(root, 'lessons/example.json'), 'utf8'));
const example = pack.lessons[0];
const draft = {
  id: 'repair-fixture',
  source: {
    title: pack.title,
    author: pack.provenance.author,
    article: example.reading.text,
    rightsStatement: pack.provenance.rightsStatement,
    sourceType: pack.provenance.sourceType,
    topic: pack.topic,
    levelEstimate: pack.levelEstimate,
  },
  reading: example.reading,
  targets: example.targets,
  repairCount: 0,
};
const dir = await mkdtemp(path.join(os.tmpdir(), 'dd-repair-preflight-'));
try {
  const draftPath = path.join(dir, 'draft.json');
  const feedbackPath = path.join(dir, 'feedback.txt');
  const ledgerPath = path.join(dir, 'ledger.json');
  const outputPath = path.join(dir, 'new-output');
  await writeFile(draftPath, JSON.stringify(draft));
  await writeFile(feedbackPath, 'Clarify the answer explanations.');
  await writeFile(ledgerPath, JSON.stringify({ schemaVersion: 1, requests: 'corrupt' }));

  const child = spawnSync(process.execPath, [
    script, 'repair-fixture', draftPath, feedbackPath, ledgerPath, outputPath,
  ], { encoding: 'utf8', env: { ...process.env, DD_META_KEY: 'local-test-placeholder' } });

  assert.notEqual(child.status, 0);
  assert.match(child.stderr, /Invalid budget ledger/);
  await assert.rejects(access(outputPath));
  await assert.rejects(access(ledgerPath + '.lock'));
  console.log('PASS corrupt ledger fails before output, reservation or Meta request');
} finally {
  await rm(dir, { recursive: true, force: true });
}
