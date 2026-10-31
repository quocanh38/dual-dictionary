import fs from 'node:fs/promises';
import {
  repairRequest, acceptExercises, sendMeta, PROMPT_VERSION,
} from '../../lessons/generator.js';
import { META_MODEL_API_PROVIDER } from '../../lessons/provider.js';
import { validateSelection, digest } from '../../lessons/schema.js';
import {
  reserve, settle, validateLedger,
} from './budget.mjs';

const [sourceId, draftPath, feedbackPath, ledgerPath, outputDir] = process.argv.slice(2);
if (!outputDir || !/^[a-z][a-z0-9_-]{0,79}$/i.test(sourceId || '')) {
  throw Error('Usage: node tools/lessons/repair.mjs SOURCE_ID DRAFT FEEDBACK_TEXT_FILE LEDGER NEW_DIRECTORY');
}
if (!process.env.DD_META_KEY) throw Error('Set DD_META_KEY ephemerally via meta-run.mjs for the Meta repair call.');
const metaModel = process.env.DD_META_MODEL?.trim() || META_MODEL_API_PROVIDER.model;
if (!META_MODEL_API_PROVIDER.models.includes(metaModel)) throw Error('DD_META_MODEL must match a supported Meta Model API text model.');

const draft = JSON.parse(await fs.readFile(draftPath, 'utf8'));
const feedback = await fs.readFile(feedbackPath, 'utf8');
const selectionErrors = validateSelection(draft.targets, draft.reading);
if (selectionErrors.length) throw Error(selectionErrors.join('\n'));
const request = repairRequest(draft, feedback);
const lockPath = ledgerPath + '.lock';
const lock = await fs.open(lockPath, 'wx');
let ledger;

async function saveLedger() {
  const temporary = ledgerPath + '.tmp';
  await fs.writeFile(temporary, JSON.stringify(ledger, null, 2), { mode: 0o600 });
  await fs.rename(temporary, ledgerPath);
}

try {
  ledger = JSON.parse(await fs.readFile(ledgerPath, 'utf8'));
  validateLedger(ledger);
  if (!ledger.requests.some((row) => row.sourceId === sourceId && row.purpose === 'generate-exercises')
    || ledger.requests.some((row) => row.sourceId === sourceId && row.purpose === 'repair-exercises')
    || ledger.requests.some((row) => row.outcome === 'in-flight-or-unknown')) {
    throw Error('Source has no initial exercise attempt, has already used repair, or has an unresolved call.');
  }

  // Validate the budget and create the evidence folder before recording a
  // reservation. The provider is never called unless that reservation is saved.
  await fs.mkdir(outputDir);
  await fs.writeFile(`${outputDir}/request.json`, JSON.stringify({
    request,
    promptVersion: PROMPT_VERSION,
    sourceId,
    draftSha256: await digest(draft),
  }, null, 2), { flag: 'wx' });

  const id = crypto.randomUUID();
  reserve(ledger, {
    id,
    purpose: request.purpose,
    sourceId,
    requestBytes: new TextEncoder().encode(JSON.stringify(request)).length,
    providerId: META_MODEL_API_PROVIDER.id,
    model: metaModel,
  });
  await saveLedger();

  let response;
  try {
    response = await sendMeta({
      providerId: META_MODEL_API_PROVIDER.id,
      providerLabel: META_MODEL_API_PROVIDER.label,
      baseUrl: META_MODEL_API_PROVIDER.baseUrl,
      model: metaModel,
      apiKey: process.env.DD_META_KEY,
      maxOutputTokens: META_MODEL_API_PROVIDER.maxOutputTokens,
    }, request);
    settle(ledger, id, response, 'response-received');
    await saveLedger();
    await fs.writeFile(`${outputDir}/response.json`, JSON.stringify(response, null, 2), { flag: 'wx' });

    const next = { ...acceptExercises(draft, response.result, response), repairCount: 1 };
    await fs.writeFile(`${outputDir}/draft.json`, JSON.stringify(next, null, 2), { flag: 'wx' });
    await fs.writeFile(`${outputDir}/candidate.json`, JSON.stringify({
      kind: 'unapproved-editor-draft',
      pack: next.pack,
    }, null, 2), { flag: 'wx' });
    console.log(`${sourceId}: repaired, validated, still unapproved.`);
  } catch (error) {
    if (!response) settle(ledger, id, error.call || {}, 'failed-or-unknown');
    if ([401, 402, 403, 429].includes(error.call?.status) || (!response && !error.call?.usage)) {
      ledger.stopReason = 'Meta repair call failed or has unknown outcome; preserve its record and do not retry automatically.';
    }
    await saveLedger();
    await fs.writeFile(`${outputDir}/failure.json`, JSON.stringify({
      error: error.message,
      call: error.call || null,
    }, null, 2), { flag: 'wx' });
    throw error;
  }
} finally {
  await lock.close();
  await fs.unlink(lockPath);
}
