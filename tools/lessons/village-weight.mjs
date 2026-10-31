// Village weight audit: proves the "light on cheap devices" story with bytes.
// Measures the Studio shell (what a village learner device needs) separately
// from the heavy dictionary downloads (teacher tooling, not learner-critical).
// No provider calls, no network. Fails closed on budget overruns.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(new URL('./village-weight.mjs', import.meta.url)));
const repo = path.join(root, '..', '..');
const KB = (n) => (n / 1024).toFixed(1) + ' KB';
const size = async (p) => (await fs.stat(path.join(repo, p))).size;

// Learner-critical: everything needed for airplane-mode lesson learning.
const SHELL = [
  'lessons/index.html', 'lessons/app.js', 'lessons/village.js', 'lessons/photo-pane.js', 'lessons/photo-request.js', 'lessons/photo-downscale.js', 'lessons/schema.js',
  'lessons/storage.js', 'lessons/generator.js', 'lessons/backup.js', 'lessons/draft-file.js',
  'lessons/library.js', 'lessons/studio.css', 'lessons/example.json',
  'lessons/library/index.json', 'lessons/library/provenance.json', 'lessons/why-meta.html',
  'sw.js', 'manifest.webmanifest', 'index.html', 'js/store.js', 'js/db.js',
];
const BUDGETS = { shellKB: 300, packKB: 12, provenanceKB: 24, totalLearnerKB: 700 };
const failures = [];
const check = (name, actualKB, budgetKB) => {
  const ok = actualKB <= budgetKB;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}: ${actualKB.toFixed(1)} KB (budget ${budgetKB} KB)`);
  if (!ok) failures.push(name);
};

let shellBytes = 0;
for (const f of SHELL) shellBytes += await size(f);
check('studio shell (HTML+JS+CSS+provenance, no packs)', shellBytes / 1024, BUDGETS.shellKB);

const libDir = path.join(repo, 'lessons', 'library');
const packFiles = (await fs.readdir(libDir)).filter((f) => f.endsWith('.json') && f !== 'index.json' && f !== 'provenance.json');
let packBytes = 0, maxPack = 0, maxName = '';
for (const f of packFiles) {
  const s = (await fs.stat(path.join(libDir, f))).size;
  packBytes += s;
  if (s > maxPack) { maxPack = s; maxName = f; }
}
console.log(`INFO ${packFiles.length} packs, total ${KB(packBytes)}, largest ${maxName} ${KB(maxPack)}`);
check('largest single pack', maxPack / 1024, BUDGETS.packKB);
check('provenance lookup (33 packs, 1 fetch)', (await size('lessons/library/provenance.json')) / 1024, BUDGETS.provenanceKB);
check('full learner kit (shell + all 33 packs)', (shellBytes + packBytes) / 1024, BUDGETS.totalLearnerKB);

// Contrast: heavy teacher-side downloads that the learner device never needs.
const heavy = [['data (dictionary sources)', 'data'], ['dicts-en-vi (bundled dicts)', 'dicts-en-vi'], ['vi/ landing', 'vi']];
for (const [label, dir] of heavy) {
  try {
    const out = (await fs.readdir(path.join(repo, dir))).length;
    console.log(`INFO ${label}: present (${out} entries) — NOT learner-critical, excluded from village budget`);
  } catch { console.log(`INFO ${label}: absent in this checkout`); }
}
if (failures.length) { console.error(`\n${failures.length} budget(s) exceeded: ${failures.join(', ')}`); process.exit(1); }
console.log('\nVillage weight audit PASS: learner kit fits a cheap-device budget.');
