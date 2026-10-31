import { HACKATHON_PROVIDER, META_MODEL_API_PROVIDER } from '../../lessons/provider.js';

// Local estimates apply only to Baseten. Meta calls are recorded without
// assigning them a price or charging them against the Baseten ledger.
export const PRICING = {
  model: HACKATHON_PROVIDER.model,
  inputPerMillion: 1.25,
  outputPerMillion: 4.25,
  source: 'https://www.baseten.co/pricing/',
  checkedOn: '2026-10-29',
};
export const MAX_OUTPUT_TOKENS = 65536;

const BASETEN_ID = HACKATHON_PROVIDER.id;
const META_ID = META_MODEL_API_PROVIDER.id;
const object = (value) => value && typeof value === 'object' && !Array.isArray(value);

export function estimateUsage(usage, providerId = BASETEN_ID) {
  if (providerId === META_ID) return null;
  if (providerId !== BASETEN_ID) throw Error('Unsupported provider in budget record.');
  if (!Number.isFinite(usage?.inputTokens) || !Number.isFinite(usage?.outputTokens)
      || usage.inputTokens < 0 || usage.outputTokens < 0) return null;
  return (usage.inputTokens * PRICING.inputPerMillion
    + usage.outputTokens * PRICING.outputPerMillion) / 1e6;
}

export function validateLedger(ledger) {
  const allowedLedger = ['schemaVersion', 'balanceAtStartUsd', 'balanceSource', 'balanceRecordedAt', 'safetyReserveUsd', 'pricing', 'scope', 'requests', 'stopReason'];
  if (!object(ledger) || Object.keys(ledger).some((key) => !allowedLedger.includes(key))
      || ledger.schemaVersion !== 1 || !Number.isFinite(ledger.balanceAtStartUsd) || ledger.balanceAtStartUsd <= 0
      || !Number.isFinite(ledger.safetyReserveUsd) || ledger.safetyReserveUsd < 2
      || !Array.isArray(ledger.requests) || ledger.requests.length > 10000) throw Error('Invalid budget ledger.');
  if (ledger.pricing?.model !== PRICING.model || ledger.pricing?.inputPerMillion !== PRICING.inputPerMillion
      || ledger.pricing?.outputPerMillion !== PRICING.outputPerMillion) throw Error('Pricing/model mismatch; verify current official rates.');

  const ids = new Set(), outcomes = new Set(['in-flight-or-unknown', 'response-received', 'failed-or-unknown']);
  for (const row of ledger.requests) {
    const providerId = row?.providerId ?? BASETEN_ID; // Legacy rows were all Baseten.
    if (!object(row) || Object.keys(row).some((key) => !['id', 'purpose', 'sourceId', 'at', 'providerId', 'model', 'reservedUsd', 'estimatedUsd', 'outcome', 'status', 'usage', 'latencyMs'].includes(key))
        || typeof row.id !== 'string' || !/^[-a-z0-9_]{1,160}$/i.test(row.id) || ids.has(row.id)
        || typeof row.purpose !== 'string' || !row.purpose.trim()
        || typeof row.sourceId !== 'string' || !/^[-a-z0-9_]{1,160}$/i.test(row.sourceId)
        || typeof row.at !== 'string' || !Number.isFinite(Date.parse(row.at))
        || ![BASETEN_ID, META_ID].includes(providerId)
        || (row.providerId != null && typeof row.providerId !== 'string')
        || (row.model != null && typeof row.model !== 'string')
        || !Number.isFinite(row.reservedUsd) || row.reservedUsd < (providerId === META_ID ? 0 : 1)
        || !outcomes.has(row.outcome)) throw Error('Invalid request reservation.');
    ids.add(row.id);
    if (row.estimatedUsd !== null && (!Number.isFinite(row.estimatedUsd) || row.estimatedUsd < 0)) throw Error('Invalid request estimate.');
    if (row.status != null && (!Number.isSafeInteger(row.status) || row.status < 100 || row.status > 599)) throw Error('Invalid request status.');
    if (row.latencyMs != null && (!Number.isFinite(row.latencyMs) || row.latencyMs < 0)) throw Error('Invalid request latency.');
    if (row.usage != null && (!object(row.usage) || Object.keys(row.usage).some((key) => !['inputTokens', 'outputTokens', 'totalTokens'].includes(key))
        || Object.values(row.usage).some((value) => value !== null && (!Number.isFinite(value) || value < 0)))) throw Error('Invalid token usage.');
    if (row.outcome === 'in-flight-or-unknown' && row.estimatedUsd !== null) throw Error('An unsettled request cannot have an estimate.');
    if (estimateUsage(row.usage, providerId) !== row.estimatedUsd) throw Error('Request estimate does not match recorded token usage.');
  }
  if (ledger.stopReason != null && typeof ledger.stopReason !== 'string') throw Error('Invalid ledger stop reason.');
}

export function committedUsd(ledger) {
  validateLedger(ledger);
  return ledger.requests.reduce((total, row) => total + (row.estimatedUsd ?? row.reservedUsd), 0);
}

export function reserve(ledger, {
  id, purpose, sourceId, requestBytes, maxOutputTokens = MAX_OUTPUT_TOKENS,
  providerId = BASETEN_ID, model = PRICING.model,
}) {
  validateLedger(ledger);
  if (![BASETEN_ID, META_ID].includes(providerId)) throw Error('Unsupported provider for lesson request.');
  if ((ledger.stopReason && providerId !== META_ID) || !Number.isSafeInteger(requestBytes) || requestBytes < 0
      || requestBytes > 200000 || !Number.isSafeInteger(maxOutputTokens) || maxOutputTokens < 1
      || maxOutputTokens > MAX_OUTPUT_TOKENS || typeof model !== 'string' || !model.trim()) throw Error('Invalid request bounds or stopped ledger.');
  if (ledger.requests.some((row) => row.id === id)) throw Error('Request already recorded; no automatic retry.');

  if (providerId === META_ID) {
    ledger.requests.push({ id, purpose, sourceId, providerId, model, at: new Date().toISOString(), reservedUsd: 0, estimatedUsd: null, outcome: 'in-flight-or-unknown' });
    return 0;
  }
  if (!Number.isFinite(ledger.balanceAtStartUsd) || ledger.balanceAtStartUsd <= 0) throw Error('Record a verified Baseten credit balance before calls.');
  // Pessimistic input bound (one token per UTF-8 byte), plus a $1 minimum.
  // Successful known usage releases unused local reservation only.
  const amount = Math.max(1, (requestBytes * PRICING.inputPerMillion + maxOutputTokens * PRICING.outputPerMillion) / 1e6 * 2);
  if (committedUsd(ledger) + amount + ledger.safetyReserveUsd > ledger.balanceAtStartUsd) throw Error('Local Baseten budget stop.');
  ledger.requests.push({ id, purpose, sourceId, providerId, model, at: new Date().toISOString(), reservedUsd: amount, estimatedUsd: null, outcome: 'in-flight-or-unknown' });
  return amount;
}

export function settle(ledger, id, meta, outcome) {
  validateLedger(ledger);
  const row = ledger.requests.find((entry) => entry.id === id);
  if (!row) throw Error('No reservation for this call.');
  if (row.outcome !== 'in-flight-or-unknown') throw Error('Call already settled.');
  if (!['response-received', 'failed-or-unknown'].includes(outcome)) throw Error('Invalid settlement outcome.');
  const providerId = row.providerId ?? BASETEN_ID;
  Object.assign(row, {
    outcome, status: meta.status ?? null, usage: meta.usage ?? null,
    latencyMs: meta.latencyMs ?? null, estimatedUsd: estimateUsage(meta.usage, providerId),
  });
  if (row.estimatedUsd !== null && row.estimatedUsd > row.reservedUsd) {
    ledger.stopReason = 'Baseten usage exceeded local reservation; stop and inspect before continuing.';
    throw Error(ledger.stopReason);
  }
}
