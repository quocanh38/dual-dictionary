import { startDraft } from '../../lessons/generator.js';

const PURPOSES = new Set(['development', 'evaluation', 'release']);
const FIELDS = new Set([
  'sourceId', 'purpose', 'title', 'author', 'article', 'rightsConfirmed',
  'rightsStatement', 'sourceType', 'topic', 'levelEstimate',
]);
const SOURCE_ID = /^[a-z][a-z0-9_-]{0,79}$/i;
const CREDENTIAL = /LLM_[0-9]{6,}_[A-Za-z0-9_-]{12,}/;

// Validate the entire batch before creating output files, locking a ledger or
// allowing the caller to make its first paid request.
export function prepareBatchSources(sources) {
  if (!Array.isArray(sources) || sources.length < 1 || sources.length > 3) {
    throw Error('Use 1–3 sources per deliberate batch.');
  }
  if (CREDENTIAL.test(JSON.stringify(sources))) {
    throw Error('Credential-like content is not allowed in source files.');
  }

  const ids = new Set();
  return sources.map((source) => {
    if (!source || typeof source !== 'object' || Array.isArray(source)) {
      throw Error('Each source must be an object.');
    }
    if (Object.keys(source).some((key) => !FIELDS.has(key))) {
      throw Error('Unexpected source field.');
    }
    if (!SOURCE_ID.test(source.sourceId) || ids.has(source.sourceId)) {
      throw Error('Source IDs must be valid and unique.');
    }
    ids.add(source.sourceId);
    if (!PURPOSES.has(source.purpose)) {
      throw Error('Explicit source purpose required: development, evaluation or release.');
    }
    if (!['original', 'licensed'].includes(source.sourceType)
      || !['academic', 'workplace'].includes(source.topic)
      || !['B1', 'B2'].includes(source.levelEstimate)) {
      throw Error('Source type, topic and level must be explicit.');
    }

    // startDraft checks permission, minimum reading length and required
    // attribution fields. Doing it for every source here prevents a later
    // invalid item from failing after earlier items have already cost money.
    return { source, draft: startDraft(source) };
  });
}
