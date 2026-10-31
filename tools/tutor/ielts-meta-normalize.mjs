import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { digest } from '../../lessons/schema.js';
import { HACKATHON_PROVIDER } from '../../lessons/provider.js';

const [stage, evidenceDir, outputName = 'candidate.json', idNamespace = '', promptEvidenceDir = evidenceDir] = process.argv.slice(2);
const allowDraft = process.argv[7] === '--allow-draft';
if (!['band-5', 'band-6', 'band-6-5', 'band-7'].includes(stage) || !evidenceDir || !['', 'wave-2', 'wave-3', 'wave-4', 'wave-5', 'wave-6', 'wave-7', 'wave-8', 'wave-9', 'wave-10'].includes(idNamespace))
  throw Error('Usage: node tools/tutor/ielts-meta-normalize.mjs STAGE EVIDENCE_DIR [OUTPUT_NAME] [wave-2|wave-3|wave-4|wave-5|wave-6|wave-7|wave-8|wave-9|wave-10]');
const root = path.resolve(evidenceDir);
const promptRoot = path.resolve(promptEvidenceDir);
const objectiveResponseName = process.argv[8] || 'objective-generate-response.json';
const promptsResponseName = process.argv[9] || 'prompts-generate-response.json';
const [objectiveFile, promptsFile] = await Promise.all([
  fs.readFile(path.join(root, objectiveResponseName), 'utf8'),
  fs.readFile(path.join(promptRoot, promptsResponseName), 'utf8'),
]);
const objectivePayload = JSON.parse(objectiveFile);
const promptsPayload = JSON.parse(promptsFile);
let objective = objectivePayload.result;
const repairFiles = async (segment, dir) => (await fs.readdir(dir))
  .filter((name) => new RegExp(`^${segment}-repair(?:-([0-9]+))?-response\\.json$`).test(name))
  .map((name) => ({ name, round: Number(name.match(/repair(?:-([0-9]+))?-response/)?.[1] || 1) }))
  .sort((a, b) => b.round - a.round);
const objectiveRepairs = await repairFiles('objective', root);
let listeningPartRepair = null;
let objectiveRepair = null;
if (objectiveRepairs.length) {
  const latest = JSON.parse(await fs.readFile(path.join(root, objectiveRepairs[0].name), 'utf8'));
  listeningPartRepair = latest.result?.listeningPart || null;
  if (latest.result?.listening) objective = latest.result;
  objectiveRepair = { provider: latest.provider, model: latest.model, usage: latest.usage, round: objectiveRepairs[0].round };
}
const promptRepairs = await repairFiles('prompts', promptRoot);
let promptRepair = null;
let prompts = promptsPayload.result;
if (promptRepairs.length) {
  const repaired = JSON.parse(await fs.readFile(path.join(promptRoot, promptRepairs[0].name), 'utf8'));
  prompts = repaired.result;
  promptRepair = { provider: repaired.provider, model: repaired.model, usage: repaired.usage, round: promptRepairs[0].round };
}
const listeningPart = listeningPartRepair || objective?.listening?.part;
if (!['Part 1', 'Part 2', 'Part 3', 'Part 4'].includes(listeningPart))
  throw Error('Listening part metadata is missing; complete GPT review and Meta repair before normalizing the final candidate.');
const failures = [];
const words = (s) => String(s || '').trim().split(/\s+/).filter(Boolean).length;
const text = (x, label) => {
  if (typeof x !== 'string' || !x.trim()) failures.push(`${label} must be non-empty text.`);
  return typeof x === 'string' ? x.trim() : '';
};
const id = (skill, n) => `ielts-meta-${idNamespace ? `${idNamespace}-` : ''}${stage}-${skill}-${String(n + 1).padStart(2, '0')}`;
const list = (x, length, label) => {
  if (!Array.isArray(x) || x.length !== length) failures.push(`${label} must contain exactly ${length} entries.`);
  return Array.isArray(x) ? x : [];
};
function questions(group, skill, passageKey, minWords, maxWords) {
  if (!group || typeof group !== 'object') { failures.push(`${skill} group is missing.`); return null; }
  const title = text(group.title, `${skill} title`);
  const focus = text(group.focus, `${skill} focus`);
  const context = text(group[passageKey], `${skill} ${passageKey}`);
  if (words(context) < minWords || words(context) > maxWords)
    failures.push(`${skill} ${passageKey} has ${words(context)} words; expected ${minWords}–${maxWords}.`);
  const qs = list(group.questions, 5, `${skill} questions`).map((q, i) => {
    const options = list(q?.options, 4, `${skill} question ${i + 1} options`).map((v, j) => text(v, `${skill} question ${i + 1} option ${j + 1}`));
    if (new Set(options.map((v) => v.toLowerCase().replace(/\s+/g, ' ').trim())).size !== 4)
      failures.push(`${skill} question ${i + 1} has duplicate options.`);
    if (!Number.isInteger(q?.answer) || q.answer < 0 || q.answer >= options.length)
      failures.push(`${skill} question ${i + 1} has an invalid answer index.`);
    return {
      id: id(skill.toLowerCase(), i), title: text(q?.title, `${skill} question ${i + 1} title`),
      prompt: text(q?.prompt, `${skill} question ${i + 1} prompt`), options,
      answer: q?.answer, explanation: text(q?.explanation, `${skill} question ${i + 1} explanation`),
    };
  });
  const keyPositions = new Set(qs.map((q) => q.answer));
  if (keyPositions.size < 4) failures.push(`${skill} answer positions do not cover all four options.`);
  return { title, focus, context, questions: qs };
}
const listening = questions(objective?.listening, 'Listening', 'script', 300, 400);
const reading = questions(objective?.reading, 'Reading', 'passage', 400, 500);
const writingPrompts = list(prompts?.writing, 5, 'Writing prompts').map((p, i) => {
  const task = text(p?.task, `Writing prompt ${i + 1} task`);
  const isTask1 = /^Task 1\b/i.test(task);
  const minimumWords = isTask1 ? 150 : 250;
  const suggestedMinutes = isTask1 ? 20 : 40;
  if (p?.minimumWords !== minimumWords || p?.suggestedMinutes !== suggestedMinutes)
    failures.push(`Writing prompt ${i + 1} has incorrect IELTS task timing/word target.`);
  if (isTask1 && !/\d/.test(String(p?.prompt || '')))
    failures.push(`Writing Task 1 prompt ${i + 1} must include complete original data.`);
  return {
    id: id('writing', i), exam: `IELTS Academic · ${task.split(' · ')[0]}`, skill: 'Writing', task,
    pathwayStage: stage, focus: text(p?.focus, `Writing prompt ${i + 1} focus`),
    prompt: text(p?.prompt, `Writing prompt ${i + 1} prompt`), minimumWords, suggestedMinutes,
  };
});
const speakingPrompts = list(prompts?.speaking, 5, 'Speaking prompts').map((p, i) => {
  const task = text(p?.task, `Speaking prompt ${i + 1} task`);
  if (!/^Part [123]\b/.test(task)) failures.push(`Speaking prompt ${i + 1} must identify Part 1, 2 or 3.`);
  if (/^Part 2\b/.test(task) && !/\n|\d\.|•|\*/.test(String(p?.prompt || '')))
    failures.push(`Speaking Part 2 prompt ${i + 1} needs visible cue-card bullets.`);
  return {
    id: id('speaking', i), exam: `IELTS Academic · ${task.split(' · ')[0]}`, skill: 'Speaking', task,
    pathwayStage: stage, focus: text(p?.focus, `Speaking prompt ${i + 1} focus`),
    prompt: text(p?.prompt, `Speaking prompt ${i + 1} prompt`),
  };
});
if (new Set([...writingPrompts, ...speakingPrompts].map((p) => p.prompt.toLowerCase().replace(/\s+/g, ' ').trim())).size !== 10)
  failures.push('Writing/Speaking prompts contain duplicates.');
if (failures.length && !allowDraft) throw Error(failures.join('\n'));

const exerciseItems = [
  ...listening.questions.map((q) => ({
    id: q.id, exam: 'IELTS Academic', skill: 'Listening', part: `Listening · ${listeningPart}`, type: 'choice',
    title: listening.title, pathwayStage: stage, focus: listening.focus, transcript: listening.context,
    prompt: q.prompt, options: q.options, answer: q.answer, explanation: q.explanation,
  })),
  ...reading.questions.map((q) => ({
    id: q.id, exam: 'IELTS Academic', skill: 'Reading', part: idNamespace ? 'Reading · Short-form practice passage' : 'Reading · Passage 1', type: 'choice',
    title: reading.title, pathwayStage: stage, focus: reading.focus, passage: reading.context,
    prompt: q.prompt, options: q.options, answer: q.answer, explanation: q.explanation,
  })),
];
const candidate = {
  stage, batchId: idNamespace || 'wave-1', itemCount: exerciseItems.length + writingPrompts.length + speakingPrompts.length,
  status: failures.length ? 'meta-draft-awaiting-gpt-cross-review' : objectiveRepair || promptRepair ? 'meta-repaired-awaiting-gpt-cross-review' : 'meta-draft-awaiting-gpt-cross-review',
  ...(failures.length ? { normalizationFindings: failures } : {}),
  ...((objectiveRepair || promptRepair) ? { metaRepairs: [
    ...(objectiveRepair ? [{ field: listeningPartRepair ? 'listening part label' : 'GPT findings on Listening/Reading content', ...(listeningPartRepair ? { result: listeningPartRepair } : {}), ...objectiveRepair }] : []),
    ...(promptRepair ? [{ field: 'GPT findings on Writing/Speaking prompts', ...promptRepair }] : []),
  ] } : {}),
  provenance: {
    provider: objectivePayload.provider || 'Baseten Model API', model: objectivePayload.model || HACKATHON_PROVIDER.model,
    promptVersions: { objective: objectivePayload.promptVersion, writingSpeaking: promptsPayload.promptVersion },
    originalContent: true,
  },
  sharedContexts: {
    listening: { title: listening.title, focus: listening.focus, part: listeningPart, script: listening.context, wordCount: words(listening.context) },
    reading: { title: reading.title, focus: reading.focus, passage: reading.context, wordCount: words(reading.context) },
  },
  exercises: exerciseItems, writingPrompts, speakingPrompts,
};
const allIds = [...candidate.exercises, ...writingPrompts, ...speakingPrompts].map((x) => x.id);
if (allIds.length !== 20 || new Set(allIds).size !== 20) throw Error('Normalized batch must contain 20 unique exercise IDs.');
const canonicalSha256 = await digest(candidate);
const candidatePath = path.join(root, outputName);
await fs.writeFile(candidatePath, JSON.stringify(candidate, null, 2), { flag: 'wx', mode: 0o600 });
const fileSha256 = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', await fs.readFile(candidatePath))), (v) => v.toString(16).padStart(2, '0')).join('');
const hashPath = candidatePath.replace(/\.json$/, '.sha256.json');
await fs.writeFile(hashPath, JSON.stringify({ sha256: fileSha256, canonicalSha256, hashAlgorithm: 'SHA-256 of exact candidate file bytes', stage, batchId: idNamespace || 'wave-1', itemCount: 20, createdAt: new Date().toISOString() }, null, 2), { flag: 'wx', mode: 0o600 });
console.log(JSON.stringify({ stage, itemCount: 20, listening: 5, reading: 5, writing: 5, speaking: 5, sha256: fileSha256, candidate: pathToFileURL(candidatePath).href }));
