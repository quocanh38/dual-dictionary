import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { access, writeFile } from 'node:fs/promises';
import { TUTOR_FEEDBACK_INSTRUCTIONS } from '../js/tutor-prompts.js';
import { validateTutorFeedback } from '../js/tutor-validation.js';
import { estimateUsage, PRICING } from './lessons/budget.mjs';
import { LIVE_EVAL_CASES } from './tutor-live-eval-cases.js';

const outputPath = new URL('../docs/lesson-studio-evidence/p2-evaluation-2026-10-27/meta-live-run-24case-resweep-32768-2026-10-30.json', import.meta.url);
const model = 'muse-spark-1.3';
const maxTokens = 32768;
const perCallLimitUsd = 0.05;
const totalLimitUsd = 0.30;
try {
  await access(outputPath);
  throw Error('A P2 live report already exists; refusing to make duplicate provider calls.');
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
let key = process.env.DD_META_KEY?.trim() || '';
let keychainLookup = 'not-queried';
if (!key && process.platform === 'darwin') {
  try {
    key = execFileSync('/usr/bin/security', ['find-generic-password', '-s', 'DD_META_KEY', '-a', 'DD-lesson-studio', '-w'], {
      encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
    keychainLookup = key ? 'available' : 'empty';
  } catch {
    keychainLookup = 'unavailable';
  }
}
if (!key) throw Error(`DD_META_KEY unavailable (${keychainLookup}); no provider call made.`);

const startedAt = new Date().toISOString();
const SWEEP_MODE = 'continue-past-error-no-retry (B sweep 30 Oct 2026: per-case errors recorded, run continues; budget caps unchanged)';
const results = [];
let cumulativeEstimateUsd = 0;
let stopReason = null;

function classifyError(message, status = 0) {
  if (status === 402) return 'quota-or-billing-stop';
  if ([401, 403].includes(status)) return 'key-or-access';
  if (status === 429) return 'quota-or-rate-limit-stop';
  if (/quote did not match/i.test(message)) return 'invalid-quote';
  if (/valid json|invalid feedback|unexpected response/i.test(message)) return 'invalid-format';
  if (/timed out|timeout/i.test(message)) return 'timeout';
  return status ? `provider-http-${status}` : 'network-or-provider-error';
}

for (const testCase of LIVE_EVAL_CASES) {
  if (cumulativeEstimateUsd + perCallLimitUsd > totalLimitUsd) {
    stopReason = 'Local P2 evaluation cap reached before next request.';
    break;
  }
  const payload = {
    phrase: testCase.phrase,
    sourceSentence: testCase.sourceSentence,
    prompt: testCase.prompt,
    answer: testCase.answer,
  };
  const started = performance.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45_000);
  let usageRecord = null;
  let diagContent = '';
  try {
    const response = await fetch('https://api.meta.ai/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        max_tokens: maxTokens,
        messages: [
          { role: 'system', content: TUTOR_FEEDBACK_INSTRUCTIONS },
          { role: 'user', content: JSON.stringify(payload) },
        ],
      }),
      signal: controller.signal,
    });
    const elapsedMs = Math.round(performance.now() - started);
    if (!response.ok) {
      const row = { caseId: testCase.id, status: 'error', elapsedMs, httpStatus: response.status, errorCategory: classifyError('', response.status), payload };
      results.push(row);
      stopReason = null; // sweep continues; the stopReason below only applies to budget caps
      continue;
    }
    const data = await response.json();
    const usage = data?.usage;
    if (!Number.isFinite(usage?.prompt_tokens) || !Number.isFinite(usage?.completion_tokens)) {
      results.push({ caseId: testCase.id, status: 'unknown-usage', elapsedMs, payload });
      continue; // sweep continues
    }
    const estimatedUsd = estimateUsage({ inputTokens: usage.prompt_tokens, outputTokens: usage.completion_tokens });
    usageRecord = {
      usage: { inputTokens: usage.prompt_tokens, outputTokens: usage.completion_tokens, totalTokens: usage.total_tokens ?? usage.prompt_tokens + usage.completion_tokens },
      estimatedUsd,
    };
    const row = {
      caseId: testCase.id,
      status: 'success',
      elapsedMs,
      ...usageRecord,
      payload,
      expectedVerdicts: testCase.expected,
      quoteRequired: testCase.quoteRequired,
    };
    cumulativeEstimateUsd += estimatedUsd;
    const content = data?.choices?.[0]?.message?.content;
    diagContent = typeof content === 'string' ? content : '';
    let raw;
    try { raw = JSON.parse(content); } catch { throw Error('Tutor response was not valid JSON.'); }
    const feedback = validateTutorFeedback(raw, testCase.answer);
    const quoteExact = !raw.quote || testCase.answer.includes(String(raw.quote).trim());
    row.rawFeedback = raw;
    row.feedback = feedback;
    row.expectedVerdictPass = testCase.expected.includes(feedback.verdict);
    row.quoteExact = quoteExact;
    row.quoteValid = quoteExact && (!testCase.quoteRequired || !!feedback.quote);
    results.push(row);
    if (estimatedUsd > perCallLimitUsd) {
      stopReason = 'A response exceeded its local per-call estimate cap; no subsequent request.';
      break;
    }
    if (cumulativeEstimateUsd > totalLimitUsd) {
      stopReason = 'A response exceeded the local total estimate cap; no subsequent request.';
      break;
    }
  } catch (error) {
    const message = controller.signal.aborted ? 'Request timed out.' : error.message;
    results.push({ caseId: testCase.id, status: 'error', elapsedMs: Math.round(performance.now() - started), ...usageRecord, errorCategory: classifyError(message), error: message, rawContent: diagContent ? diagContent.slice(0, 2000) : undefined, payload });
    continue; // sweep continues; no per-case retry
    break;
  } finally {
    clearTimeout(timer);
  }
}

key = '';
const successes = results.filter((row) => row.status === 'success');
const report = {
  date: new Date().toISOString(),
  startedAt,
  provider: 'Meta Model API',
  model,
  promptVersion: 'TUTOR_FEEDBACK_INSTRUCTIONS current local source',
  sweepMode: SWEEP_MODE,
  requestBound: { maxCalls: LIVE_EVAL_CASES.length, maxTokensPerCall: maxTokens, perCallEstimateLimitUsd: perCallLimitUsd, totalEstimateLimitUsd: totalLimitUsd, automaticRetries: 0 },
  denominators: {
    authoredCases: LIVE_EVAL_CASES.length,
    casesAttempted: results.length,
    providerCalls: results.length,
    questions: results.length,
    successfulResponses: successes.length,
    verdictScored: successes.length,
    verdictMatched: successes.filter((row) => row.expectedVerdictPass).length,
    quoteScored: successes.filter((row) => typeof row.quoteValid === 'boolean').length,
    quoteValid: successes.filter((row) => row.quoteValid === true).length,
    explanationQualityScored: 0,
    latencySamples: results.filter((row) => Number.isFinite(row.elapsedMs)).length,
    errorTypes: results.filter((row) => row.status !== 'success').map((row) => row.errorCategory || row.status),
  },
  estimatedUsd: cumulativeEstimateUsd,
  billingConfirmed: false,
  note: 'Synthetic authored evaluation payloads only; no learner data or repository source sent. Estimated cost uses documented standard token rates; Meta Billing may lag and was not billed as a confirmed amount. Evaluation request includes max_tokens=32768 matching production js/ai-client.js, so this resweep mirrors the production Tutor request. Explanation-quality and relevance are unscored; provider output quality is not reduced to verdict match.',
  stopReason,
  cases: results,
};
assert.ok(results.length <= LIVE_EVAL_CASES.length);
assert.ok(cumulativeEstimateUsd <= totalLimitUsd || stopReason?.includes('exceeded'));
await writeFile(outputPath, JSON.stringify(report, null, 2), { flag: 'wx' });
console.log(JSON.stringify({ status: stopReason ? 'STOPPED' : 'COMPLETE', providerCalls: results.length, successfulResponses: successes.length, estimatedUsd: cumulativeEstimateUsd, stopReason, output: outputPath.pathname }, null, 2));
