import { execFileSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { TUTOR_FEEDBACK_INSTRUCTIONS } from '../js/tutor-prompts.js';
import { validateTutorFeedback } from '../js/tutor-validation.js';
import { estimateUsage } from './lessons/budget.mjs';
import { LIVE_EVAL_CASES } from './tutor-live-eval-cases.js';

const root = new URL('../docs/lesson-studio-evidence/p2-evaluation-2026-10-27/', import.meta.url);
const previousPath = new URL('meta-live-run.json', root);
const outputPath = new URL('meta-live-run-continuation.json', root);
const model = 'muse-spark-1.3';
const maxTokens = 500;
const perCallLimitUsd = 0.05;
const totalLimitUsd = 0.25;
const previous = JSON.parse(await readFile(previousPath, 'utf8'));
const alreadyAttempted = new Set(previous.cases.map((row) => row.caseId));
const pending = LIVE_EVAL_CASES.filter((item) => !alreadyAttempted.has(item.id));
if (!pending.length) throw Error('No unattempted P2 cases remain; refusing duplicate provider calls.');
try {
  await readFile(outputPath, 'utf8');
  throw Error('A continuation report already exists; refusing duplicate provider calls.');
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
  } catch { keychainLookup = 'unavailable'; }
}
if (!key) throw Error(`DD_META_KEY unavailable (${keychainLookup}); no provider call made.`);

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

for (const testCase of pending) {
  if (cumulativeEstimateUsd + perCallLimitUsd > totalLimitUsd) {
    stopReason = 'Local P2 continuation cap reached before next request.';
    break;
  }
  const payload = { phrase: testCase.phrase, sourceSentence: testCase.sourceSentence, prompt: testCase.prompt, answer: testCase.answer };
  const started = performance.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45_000);
  try {
    const response = await fetch('https://api.meta.ai/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model, temperature: 0.2, max_tokens: maxTokens,
        messages: [
          { role: 'system', content: TUTOR_FEEDBACK_INSTRUCTIONS },
          { role: 'user', content: JSON.stringify(payload) },
        ],
      }),
      signal: controller.signal,
    });
    const elapsedMs = Math.round(performance.now() - started);
    if (!response.ok) {
      results.push({ caseId: testCase.id, status: 'error', elapsedMs, httpStatus: response.status, errorCategory: classifyError('', response.status), payload });
      stopReason = `Provider returned HTTP ${response.status}; no retry or subsequent call.`;
      break;
    }
    const data = await response.json();
    const usage = data?.usage;
    if (!Number.isFinite(usage?.prompt_tokens) || !Number.isFinite(usage?.completion_tokens)) {
      results.push({ caseId: testCase.id, status: 'unknown-usage', elapsedMs, payload });
      stopReason = 'Provider did not return token usage; no retry or subsequent call.';
      break;
    }
    const estimatedUsd = estimateUsage({ inputTokens: usage.prompt_tokens, outputTokens: usage.completion_tokens });
    cumulativeEstimateUsd += estimatedUsd;
    const row = {
      caseId: testCase.id, status: 'success', elapsedMs,
      usage: { inputTokens: usage.prompt_tokens, outputTokens: usage.completion_tokens, totalTokens: usage.total_tokens ?? usage.prompt_tokens + usage.completion_tokens },
      estimatedUsd, payload, expectedVerdicts: testCase.expected, quoteRequired: testCase.quoteRequired,
      rawOutput: data?.choices?.[0]?.message?.content ?? null,
    };
    try {
      const raw = JSON.parse(row.rawOutput);
      const feedback = validateTutorFeedback(raw, testCase.answer);
      const quoteExact = !raw.quote || testCase.answer.includes(String(raw.quote).trim());
      row.rawFeedback = raw;
      row.feedback = feedback;
      row.expectedVerdictPass = testCase.expected.includes(feedback.verdict);
      row.quoteExact = quoteExact;
      row.quoteValid = quoteExact && (!testCase.quoteRequired || !!feedback.quote);
    } catch (error) {
      row.status = 'error';
      row.error = error.message;
      row.errorCategory = classifyError(error.message);
      // This case has failed; continue only to a different, unattempted case.
    }
    results.push(row);
    if (estimatedUsd > perCallLimitUsd) {
      stopReason = 'A response exceeded the per-call estimate limit; no subsequent request.';
      break;
    }
    if (cumulativeEstimateUsd > totalLimitUsd) {
      stopReason = 'A response exceeded the continuation estimate limit; no subsequent request.';
      break;
    }
  } catch (error) {
    const message = controller.signal.aborted ? 'Request timed out.' : error.message;
    results.push({ caseId: testCase.id, status: 'error', elapsedMs: Math.round(performance.now() - started), errorCategory: classifyError(message), error: message, payload });
    stopReason = `${message}; no retry or subsequent call.`;
    break;
  } finally {
    clearTimeout(timer);
  }
}

key = '';
const successes = results.filter((row) => row.status === 'success');
const report = {
  date: new Date().toISOString(),
  provider: 'Meta Model API', model,
  priorRun: 'meta-live-run.json; attempted case IDs are excluded from this continuation',
  requestBound: { maxCalls: pending.length, maxTokensPerCall: maxTokens, perCallEstimateLimitUsd: perCallLimitUsd, totalEstimateLimitUsd: totalLimitUsd, automaticRetries: 0 },
  denominators: {
    remainingAuthoredCases: pending.length,
    casesAttempted: results.length,
    providerCalls: results.length,
    questions: results.length,
    successfulResponses: successes.length,
    verdictScored: successes.filter((row) => row.feedback).length,
    verdictMatched: successes.filter((row) => row.expectedVerdictPass).length,
    quoteScored: successes.filter((row) => typeof row.quoteValid === 'boolean').length,
    quoteValid: successes.filter((row) => row.quoteValid === true).length,
    explanationQualityScored: 0,
    latencySamples: results.filter((row) => Number.isFinite(row.elapsedMs)).length,
    errorTypes: results.filter((row) => row.status !== 'success').map((row) => row.errorCategory || row.status),
  },
  estimatedUsd: cumulativeEstimateUsd,
  billingConfirmed: false,
  note: 'Only previously unattempted synthetic cases were sent; no retry of a failed case, learner data, or source code. max_tokens=500 is a bounded request. Raw provider text and usage are retained for each successful HTTP response. Token-rate estimate is not a confirmed Billing charge.',
  stopReason,
  cases: results,
};
await writeFile(outputPath, JSON.stringify(report, null, 2), { flag: 'wx' });
console.log(JSON.stringify({ status: stopReason ? 'STOPPED' : 'COMPLETE', providerCalls: results.length, successfulResponses: successes.length, estimatedUsd: cumulativeEstimateUsd, stopReason, output: outputPath.pathname }, null, 2));
