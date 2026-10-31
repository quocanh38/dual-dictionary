import {readLibraryIndex,readLibraryPack} from '../../lessons/library.js';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = process.env.DD_LESSON_ROOT || process.cwd();
const app = fs.readFileSync(path.join(root, 'lessons/app.js'), 'utf8');
const worker = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');

const cacheVersion = worker.match(/const CACHE\s*=\s*'([^']+)'/);
assert.ok(cacheVersion, 'service worker must declare one cache version');
assert.match(cacheVersion[1], /^mdx-dict-v\d+$/);

const assetsBlock = worker.match(/const ASSETS\s*=\s*\[([\s\S]*?)\n\];/);
assert.ok(assetsBlock, 'service worker must declare its precache asset list');
const assets = new Set([...assetsBlock[1].matchAll(/'([^']+)'/g)].map((match) => match[1]));

const readinessBlock = app.match(/async function offlineReady\(\)\s*\{([\s\S]*?)\nwindow\.addEventListener/);
assert.ok(readinessBlock, 'Lesson Studio must expose its offline readiness check');
const pathsBlock = readinessBlock[1].match(/const paths\s*=\s*\[([^\]]+)\]/);
assert.ok(pathsBlock, 'offline readiness must enumerate required shell paths');
const required = [...pathsBlock[1].matchAll(/'([^']+)'/g)].map((match) => match[1]);
assert.ok(required.length > 0, 'offline readiness must check at least one path');

for (const relative of required) {
  const joined = path.posix.normalize(path.posix.join('lessons', relative));
  const normalized = `./${joined}${relative.endsWith('/') && !joined.endsWith('/') ? '/' : ''}`;
  assert.ok(assets.has(normalized), `offline readiness requires ${normalized}, but it is not precached`);
}

assert.match(
  readinessBlock[1],
  /\.filter\(name\s*=>\s*\/\^mdx-dict-v\\d\+\$\/\.test\(name\)\)/,
  'Lesson Studio must discover a versioned shell cache instead of pinning a cache name',
);

const index=readLibraryIndex(fs.readFileSync(path.join(root,'lessons/library/index.json'),'utf8'));
for(const entry of index.packs){
 const relative='./library/'+entry.file;
 assert.ok(required.includes(relative),`Reviewed library pack ${entry.file} must be checked for offline readiness`);
 assert.ok(assets.has('./lessons/library/'+entry.file),`Reviewed library pack ${entry.file} must be precached`);
 await readLibraryPack(fs.readFileSync(path.join(root,'lessons/library',entry.file),'utf8'),entry);
}
console.log(`PASS ${index.packs.length} reviewed library envelopes match exact index hashes and offline paths`);
console.log(`PASS ${required.length} Lesson Studio offline paths are in ${cacheVersion[1]}`);
