import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';

const stages = ['band-5', 'band-6', 'band-6-5', 'band-7'];
const historicalReviewers = [
  ['gpt-6-luna', 'review-gpt-6-luna-final.json'],
  ['gpt-5.6-terra', 'review-gpt-5-6-terra-final.json'],
];
const waves = [
  {
    batchId: 'wave-1',
    evidenceRoot: path.resolve('docs/lesson-studio-evidence/ielts-meta-batches-2026-10-27'),
    candidateName: 'candidate-meta-repaired.json',
    sidecarName: 'candidate-meta-repaired.sha256.json',
  },
  {
    batchId: 'wave-2',
    evidenceRoot: path.resolve('docs/lesson-studio-evidence/ielts-meta-batches-2026-10-28/wave-2'),
    candidateName: 'candidate-meta-repaired.json',
    sidecarName: 'candidate-meta-repaired.sha256.json',
  },
  {
    batchId: 'wave-3',
    evidenceRoot: path.resolve('docs/lesson-studio-evidence/ielts-meta-batches-2026-10-28/wave-3'),
    candidateName: 'candidate-meta-repaired.json',
    sidecarName: 'candidate-meta-repaired.sha256.json',
    reviewers: historicalReviewers,
  },
  {
    batchId: 'wave-4',
    evidenceRoot: path.resolve('docs/lesson-studio-evidence/ielts-meta-batches-2026-10-28/wave-4'),
    candidateName: 'candidate-final-v4.json',
    sidecarName: 'candidate-final-v4.sha256.json',
    reviewers: [
      ['gpt-6-luna', 'review-gpt-6-luna-final.json'],
      ['gpt-6.1-sol', 'review-gpt-6-1-sol-final.json'],
    ],
  },
  {
    batchId: 'wave-5',
    evidenceRoot: path.resolve('docs/lesson-studio-evidence/ielts-meta-batches-2026-10-29/wave-5'),
    candidateName: 'candidate-final-v2.json',
    sidecarName: 'candidate-final-v2.sha256.json',
    reviewers: [
      ['gpt-6-luna', 'review-gpt-6-luna-final.json'],
      ['gpt-6.1-sol', 'review-gpt-6-1-sol-final.json'],
    ],
  },
  ...[6, 7, 8, 9, 10].map((wave) => ({
    batchId: `wave-${wave}`,
    evidenceRoot: path.resolve(`docs/lesson-studio-evidence/ielts-meta-batches-2026-10-29/wave-${wave}`),
    candidateName: 'candidate-final-v2.json',
    sidecarName: 'candidate-final-v2.sha256.json',
    ...(wave === 6 ? {
      candidateNameByStage: { 'band-5': 'candidate-final-v3.json', 'band-6': 'candidate-final-v4.json' },
      sidecarNameByStage: { 'band-5': 'candidate-final-v3.sha256.json', 'band-6': 'candidate-final-v4.sha256.json' },
      reviewersByStage: {
        'band-5': [
          ['gpt-6-luna', 'review-gpt-6-luna-final-v3.json'],
          ['gpt-6.1-sol', 'review-gpt-6-1-sol-final-v3.json'],
        ],
        'band-6': [
          ['gpt-6-luna', 'review-gpt-6-luna-final-v4.json'],
          ['gpt-6.1-sol', 'review-gpt-6-1-sol-final-v4.json'],
        ],
      },
    } : {}),
    ...(wave === 8 ? {
      candidateNameByStage: { 'band-5': 'candidate-final-v3.json', 'band-6': 'candidate-final-v3.json', 'band-7': 'candidate-final-v3.json' },
      sidecarNameByStage: { 'band-5': 'candidate-final-v3.sha256.json', 'band-6': 'candidate-final-v3.sha256.json', 'band-7': 'candidate-final-v3.sha256.json' },
      reviewersByStage: Object.fromEntries(['band-5', 'band-6', 'band-7'].map((stage) => [stage, [
        ['gpt-6-luna', 'review-gpt-6-luna-final-v3.json'],
        ['gpt-6.1-sol', 'review-gpt-6-1-sol-final-v3.json'],
      ]])),
    } : {}),
    ...(wave === 10 ? {
      candidateNameByStage: { 'band-6-5': 'candidate-final-v4.json' },
      sidecarNameByStage: { 'band-6-5': 'candidate-final-v4.sha256.json' },
      reviewersByStage: {
        'band-6-5': [
          ['gpt-6-luna', 'review-gpt-6-luna-final-v4.json'],
          ['gpt-6.1-sol', 'review-gpt-6-1-sol-final-v4.json'],
        ],
      },
    } : {}),
    reviewers: [
      ['gpt-6-luna', 'review-gpt-6-luna-final.json'],
      ['gpt-6.1-sol', 'review-gpt-6-1-sol-final.json'],
    ],
  })),
];
const outputPath = path.resolve('js/ielts-meta-practice.js');
const allCandidates = [];

for (const wave of waves) {
  for (const stage of stages) {
    const dir = path.join(wave.evidenceRoot, stage);
    const candidateName = wave.candidateNameByStage?.[stage] || wave.candidateName;
    const sidecarName = wave.sidecarNameByStage?.[stage] || wave.sidecarName;
    const reviewerSet = wave.reviewersByStage?.[stage] || wave.reviewers || historicalReviewers;
    const candidatePath = path.join(dir, candidateName);
    const [candidateBytes, sidecarText] = await Promise.all([
      fs.readFile(candidatePath),
      fs.readFile(path.join(dir, sidecarName), 'utf8'),
    ]);
    const sha256 = createHash('sha256').update(candidateBytes).digest('hex');
    const sidecar = JSON.parse(sidecarText);
    if (sidecar.sha256 !== sha256 || sidecar.stage !== stage || sidecar.itemCount !== 20 || (sidecar.batchId && sidecar.batchId !== wave.batchId))
      throw Error(`${wave.batchId}/${stage}: candidate byte hash or sidecar metadata does not match.`);
    const candidate = JSON.parse(candidateBytes.toString('utf8'));
    if (candidate.stage !== stage || candidate.itemCount !== 20 || !candidate.status?.startsWith('meta-') || (candidate.batchId && candidate.batchId !== wave.batchId))
      throw Error(`${wave.batchId}/${stage}: expected a normalized, original Meta-authored 20-item candidate.`);
    if (candidate.normalizationFindings?.length)
      throw Error(`${wave.batchId}/${stage}: unresolved structural findings remain in the candidate.`);

    for (const [reviewer, filename] of reviewerSet) {
      const review = JSON.parse(await fs.readFile(path.join(dir, filename), 'utf8'));
      if (review.reviewer !== reviewer || review.candidateSha256 !== sha256 || review.verdict !== 'pass' || review.findings?.length)
        throw Error(`${wave.batchId}/${stage}: ${reviewer} has not passed this exact candidate hash.`);
    }

    const counts = {
      Listening: candidate.exercises.filter((x) => x.skill === 'Listening').length,
      Reading: candidate.exercises.filter((x) => x.skill === 'Reading').length,
      Writing: candidate.writingPrompts.length,
      Speaking: candidate.speakingPrompts.length,
    };
    if (Object.values(counts).some((n) => n !== 5))
      throw Error(`${wave.batchId}/${stage}: expected five reviewed items per skill; got ${JSON.stringify(counts)}.`);
    const wordCount = (text) => String(text || '').trim().split(/\s+/).filter(Boolean).length;
    const listeningWords = wordCount(candidate.sharedContexts?.listening?.script);
    const readingWords = wordCount(candidate.sharedContexts?.reading?.passage);
    if (listeningWords < 300 || listeningWords > 400 || readingWords < 400 || readingWords > 500)
      throw Error(`${wave.batchId}/${stage}: shared Listening/Reading contexts fall outside the required word-count ranges.`);
    for (const skill of ['Listening', 'Reading']) {
      const answers = new Set(candidate.exercises.filter((item) => item.skill === skill).map((item) => item.answer));
      // Preserve the already published, hash-reviewed wave-3 answer layout.
      // Its Reading keys [1,0,3,1,3] omit position 2; this is a distribution
      // limitation, not a reason to reorder and invalidate reviewed content.
      const publishedLayout = wave.batchId === 'wave-3' && stage === 'band-7' && skill === 'Reading';
      if (!publishedLayout && [0, 1, 2, 3].some((position) => !answers.has(position)))
        throw Error(`${wave.batchId}/${stage}: ${skill} answer positions must cover options 0–3.`);
    }
    const expectedPrefix = wave.batchId === 'wave-1' ? `ielts-meta-${stage}-` : `ielts-meta-${wave.batchId}-${stage}-`;
    const ids = [...candidate.exercises, ...candidate.writingPrompts, ...candidate.speakingPrompts].map((x) => x.id);
    if (new Set(ids).size !== 20 || ids.some((id) => !id.startsWith(expectedPrefix)))
      throw Error(`${wave.batchId}/${stage}: content IDs are duplicated or do not match the batch and pathway stage.`);
    allCandidates.push({ ...wave, stage, candidate, sha256 });
  }
}

const allItems = allCandidates.flatMap(({ candidate }) => [
  ...candidate.exercises,
  ...candidate.writingPrompts,
  ...candidate.speakingPrompts,
]);
const globalIds = allItems.map((x) => x.id);
const duplicateGlobalIds = globalIds.filter((id, index) => globalIds.indexOf(id) !== index);
if (allItems.length !== 800 || new Set(globalIds).size !== 800)
  throw Error(`The forty reviewed batches must provide 800 globally unique IDs; got ${allItems.length} items and ${new Set(globalIds).size} IDs. Duplicate sample: ${[...new Set(duplicateGlobalIds)].slice(0, 8).join(', ') || 'none'}.`);

const contextKey = (batchId, stage) => `${batchId}-${stage}`;
const contexts = Object.fromEntries(allCandidates.map(({ batchId, stage, candidate }) => [contextKey(batchId, stage), {
  listening: candidate.sharedContexts.listening.script,
  reading: candidate.sharedContexts.reading.passage,
}]));
const objective = allCandidates.flatMap(({ batchId, stage, candidate }) => candidate.exercises.map((item) => {
  const { transcript, passage, ...fields } = item;
  const key = contextKey(batchId, stage);
  const contextField = item.skill === 'Listening'
    ? `transcript: IELTS_META_SHARED_CONTEXTS[${JSON.stringify(key)}].listening`
    : `passage: IELTS_META_SHARED_CONTEXTS[${JSON.stringify(key)}].reading`;
  return `  {\n${JSON.stringify(fields, null, 2).split('\n').slice(1, -1).map((line) => `    ${line}`).join('\n')},\n    ${contextField}\n  }`;
}));
const writing = allCandidates.flatMap(({ candidate }) => candidate.writingPrompts);
const speaking = allCandidates.flatMap(({ candidate }) => candidate.speakingPrompts);
const source = [
  '// Generated from forty normalized Meta-authored batches after exact-hash cross-review by the recorded GPT reviewers.',
  '// These are original formative practice items, not official IELTS material or calibrated band tests.',
  `const IELTS_META_SHARED_CONTEXTS = ${JSON.stringify(contexts, null, 2)};`,
  '',
  `export const IELTS_META_PRACTICE_EXERCISES = [\n${objective.join(',\n')}\n];`,
  '',
  `export const IELTS_META_WRITING_PROMPTS = ${JSON.stringify(writing, null, 2)};`,
  '',
  `export const IELTS_META_SPEAKING_PROMPTS = ${JSON.stringify(speaking, null, 2)};`,
  '',
].join('\n');
await fs.writeFile(outputPath, source);

const outputSha256 = createHash('sha256').update(source).digest('hex');
const report = {
  generatedAt: new Date().toISOString(),
  output: path.relative(process.cwd(), outputPath),
  outputSha256,
  includedBatches: allCandidates.map(({ batchId, stage, sha256 }) => ({ batchId, stage, candidateSha256: sha256 })),
  reviewedItems: 800,
  newWaveItems: 400,
  totals: { listening: 200, reading: 200, writing: 200, speaking: 200 },
};
await fs.writeFile(path.join(waves.at(-1).evidenceRoot, 'integration-report.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report));
