// Builds lessons/library/provenance.json from existing approved packs.
// No provider calls. Reads local files only; output is a small lookup table
// so the Studio UI can show per-pack Meta provenance with ONE fetch
// instead of 33 pack fetches on a cheap device.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(new URL('./build-provenance.mjs', import.meta.url)));
const libDir = path.join(root, '..', '..', 'lessons', 'library');
const index = JSON.parse(await fs.readFile(path.join(libDir, 'index.json'), 'utf8'));
const out = { format: 'dual-dictionary-lesson-provenance', schemaVersion: 1, packs: [] };
for (const entry of index.packs) {
  const raw = await fs.readFile(path.join(libDir, entry.file), 'utf8');
  const envelope = JSON.parse(raw);
  const p = envelope.payload;
  out.packs.push({
    packId: p.packId,
    version: p.version,
    title: p.title,
    topic: p.topic,
    levelEstimate: p.levelEstimate,
    sha256: envelope.sha256,
    provider: p.generation?.provider || 'unknown',
    model: p.generation?.model || 'unknown',
    promptVersion: p.generation?.promptVersion || 'unknown',
    generatedAt: p.generation?.generatedAt || null,
    reviewerType: p.review?.reviewerType || 'unknown',
    reviewStatus: p.review?.status || 'unknown',
  });
}
await fs.writeFile(path.join(libDir, 'provenance.json'), JSON.stringify(out, null, 2) + '\n');
console.log(`Wrote provenance for ${out.packs.length} packs.`);
