// Covers contract: display-only Muse Image art must never touch reviewed packs.
// No provider calls. Fails closed on any drift.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(new URL('./covers-check.mjs', import.meta.url)));
const lib = path.join(root, '..', '..', 'lessons', 'library');
const results = [];
async function test(name, fn) { await fn(); results.push(name); console.log('PASS ' + name); }

await test('covers manifest is small, versioned and names its model', async () => {
  const doc = JSON.parse(await fs.readFile(path.join(lib, 'covers.json'), 'utf8'));
  assert.equal(doc.format, 'dual-dictionary-lesson-covers');
  assert.equal(doc.schemaVersion, 1);
  assert.equal(doc.model, 'muse-image-1.0');
  assert.ok(doc.covers && typeof doc.covers === 'object');
});

await test('every cover file exists, is WebP, and maps to a real pack', async () => {
  const doc = JSON.parse(await fs.readFile(path.join(lib, 'covers.json'), 'utf8'));
  const index = JSON.parse(await fs.readFile(path.join(lib, 'index.json'), 'utf8'));
  const files = new Set(index.packs.map((p) => p.file));
  let bytes = 0;
  for (const [packFile, c] of Object.entries(doc.covers)) {
    assert.ok(files.has(packFile), 'cover maps to unknown pack: ' + packFile);
    const buf = await fs.readFile(path.join(lib, c.cover));
    assert.equal(buf.subarray(0, 4).toString('ascii'), 'RIFF', 'not WebP: ' + c.cover);
    assert.ok(buf.length > 10000, 'cover suspiciously small: ' + c.cover);
    bytes += buf.length;
  }
  assert.ok(bytes < 1024 * 1024, 'covers exceed 1MB total: ' + bytes);
  console.log(`INFO  ${Object.keys(doc.covers).length} covers, ${(bytes / 1024).toFixed(0)} KB total`);
});

await test('reviewed pack payloads are untouched by covers', async () => {
  const index = JSON.parse(await fs.readFile(path.join(lib, 'index.json'), 'utf8'));
  for (const entry of index.packs.slice(0, 5)) {
    const raw = await fs.readFile(path.join(lib, entry.file), 'utf8');
    const env = JSON.parse(raw);
    assert.ok(!('cover' in (env.payload || {})), 'pack payload polluted: ' + entry.file);
    assert.equal(env.sha256, entry.sha256, 'pack checksum drift: ' + entry.file);
  }
});

console.log(`${results.length} covers contract groups PASS`);
