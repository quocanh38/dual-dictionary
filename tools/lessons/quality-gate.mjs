// Editorial evidence gate. Never uses a provider, infers linguistic correctness,
// or deploys. A reviewer must fill every criterion for this exact pack digest.
import { validatePack, digest, exportPack } from '../../lessons/schema.js';
import fs from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
export function criteriaFor(pack) {
  const rows = [{ id: 'rights', prompt: 'Original/permitted source, author, distribution rights and no learner PII checked.' }];
  for (const l of pack.lessons) {
    for (const t of l.targets) for (const [suffix, prompt] of [
      ['source', 'Phrase occurs in cited source and the contextual sense is supported.'],
      ['meaning-en', 'English gloss is the actual contextual meaning, not a selection rationale.'],
      ['meaning-vi', 'Vietnamese gloss is accurate, natural and includes diacritics.']
    ]) rows.push({ id: `${l.lessonId}/${t.id}/${suffix}`, prompt });
    for (const e of l.exercises) {
      const checks = e.type === 'transfer' ? [
        ['new-situation', 'Role or purpose differs meaningfully from the source; not merely rewriting it.'],
        ['self-check', 'Model answer is idiomatic and uses target; checklist is usable; writing is not automatically graded.']
      ] : [
        ['unique-answer', 'Identify correct option and explain each distractor. No other plausible answer; no subjective style/intent assumptions.'],
        ['explanations', 'Every option explanation is accurate; grammar/collocation claims are not overgeneralized.']
      ];
      for (const [suffix, prompt] of checks) rows.push({ id: `${l.lessonId}/${e.exerciseId}/${suffix}`, prompt });
    }
  }
  return rows;
}
export async function reviewTemplate(pack) {
  const v = validatePack(pack); if (!v.ok) throw Error(v.errors.join('\n'));
  return { schemaVersion: 1, packSha256: await digest(pack), reviewerType: 'ai-assisted-editor', reviewerName: '', reviewedAt: '', note: '',
    criteria: criteriaFor(pack).map(r => ({ ...r, status: 'pending', evidence: '' })), findings: pack.review.findings.map((f,i) => ({id: `pack-finding-${i+1}`, severity:f.severity, resolved:f.resolved, evidence:f.message})) };
}
export async function audit(pack, review) {
  const structure = validatePack(pack), errors = [...structure.errors];
  if (!structure.ok) return { status: 'invalid-pack', ready: false, errors };
  const sha256 = await digest(pack);
  if (!review) return { status: 'needs-review', ready: false, sha256, errors: ['Create and complete an editorial review.'] };
  if(typeof review!=='object'||Array.isArray(review))return {status:'changes-required',ready:false,sha256,errors:['Malformed editorial review.']};
  const text=s=>typeof s==='string'&&Boolean(s.trim());
  const expected = criteriaFor(pack).map(r => r.id);
  if (review.schemaVersion !== 1 || review.packSha256 !== sha256) errors.push('Review is stale or for another payload. Any pack edit requires a fresh review.');
  if (!['ai-assisted-editor','human-editor'].includes(review.reviewerType) || !text(review.reviewerName) || !text(review.note) || (typeof review.reviewedAt!=='string'||!Number.isFinite(Date.parse(review.reviewedAt)))) errors.push('Identify the actual reviewer, type, time, scope and limitations.');
  const rows = Array.isArray(review.criteria) ? review.criteria : [];
  if (rows.length !== expected.length || new Set(rows.map(r => r?.id)).size !== rows.length || rows.some(r => !expected.includes(r?.id))) errors.push('Review must cover every required criterion exactly once.');
  for (const id of expected) {
    const row = rows.find(r => r?.id === id);
    if (!row || row.status !== 'pass' || typeof row.evidence !== 'string' || !row.evidence.trim()) errors.push(`Unresolved or undocumented criterion: ${id}`);
  }
  if (!Array.isArray(review.findings)) errors.push('Review findings must be recorded, including an empty list if none.');
  else for (const f of review.findings) {
    if (!f || !['minor','critical','uncertain'].includes(f.severity) || typeof f.resolved !== 'boolean' || !text(f.id) || !text(f.evidence)) errors.push('Malformed finding.');
    else if (!f.resolved && ['critical','uncertain'].includes(f.severity)) errors.push(`Unresolved ${f.severity} finding: ${f.id}`);
  }
  for (const [i,f] of pack.review.findings.entries()) if (!f.resolved && ['critical','uncertain'].includes(f.severity) && !(Array.isArray(review.findings)?review.findings:[]).some(r => r?.id===`pack-finding-${i+1}` && r.severity===f.severity && r.resolved===true && text(r.evidence))) errors.push(`Existing pack finding needs documented closure: pack-finding-${i+1}`);
  return { status: errors.length ? 'changes-required' : 'ready-for-approval', ready: !errors.length, sha256, reviewerType: review.reviewerType, errors };
}
export async function approve(pack, review) {
  const result = await audit(pack, review); if (!result.ready) throw Error(result.errors.join('\n'));
  const next = structuredClone(pack);
  next.review = { status: 'approved', reviewerType: review.reviewerType, note: `${review.reviewerName}; ${review.reviewedAt}. ${review.note}`,
    checks: { rights: true, meaning: true, uniqueAnswers: true, explanations: true },
    findings: review.findings.map(f => ({ severity: f.severity, resolved: f.resolved, message: f.evidence })) };
  return { envelope: await exportPack(next), approval: { approvedAt: new Date().toISOString(), reviewedPayloadSha256: result.sha256, reviewSha256: await digest(review), exportedPayloadSha256: await digest(next), reviewerName: review.reviewerName, reviewerType: review.reviewerType } };
}
async function readJSON(path) {
  const bytes = await fs.readFile(path); if (bytes.length > 2 * 1024 * 1024) throw Error('File exceeds 2 MB.');
  if (/LLM_[0-9]{6,}_[A-Za-z0-9_-]{12,}/.test(bytes.toString())) throw Error('Credential-like text rejected.');
  return JSON.parse(bytes);
}
async function main() {
  const [command, packPath, reviewPath, outputPath] = process.argv.slice(2);
  if (!['template','audit','approve'].includes(command) || !packPath) throw Error('Usage: node tools/lessons/quality-gate.mjs template PACK OUTPUT | audit PACK REVIEW | approve PACK REVIEW NEW_OUTPUT');
  const input = await readJSON(packPath), pack = input.pack || input.payload || input;
  if (command === 'template') { if (!reviewPath) throw Error('Specify a new review filename.'); await fs.writeFile(reviewPath, JSON.stringify(await reviewTemplate(pack), null, 2), { flag: 'wx' }); return; }
  const review = await readJSON(reviewPath);
  if (command === 'audit') { const r = await audit(pack, review); console.log(JSON.stringify(r, null, 2)); if (!r.ready) process.exitCode = 1; return; }
  if (!outputPath) throw Error('Approve is an explicit editorial release action. Specify a new output filename.');
  // Never silently overwrite a previously distributed pack or approval record.
  const result = await approve(pack, review);
  await fs.mkdir(outputPath);
  await fs.writeFile(outputPath+'/pack.json', JSON.stringify(result.envelope, null, 2), { flag: 'wx' });
  await fs.writeFile(outputPath+'/approval.json', JSON.stringify(result.approval, null, 2), { flag: 'wx' });
  await fs.writeFile(outputPath+'/review.json', JSON.stringify(review, null, 2), { flag: 'wx' });
  console.log('New release directory written: pack.json is importable. Not uploaded, installed or deployed.');
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().catch(e => { console.error(e.message); process.exitCode = 1; });
