import { execFileSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { TUTOR_FEEDBACK_INSTRUCTIONS } from '../js/tutor-prompts.js';
import { validateTutorFeedback } from '../js/tutor-validation.js';
import { estimateUsage } from './lessons/budget.mjs';
import { LIVE_EVAL_CASES } from './tutor-live-eval-cases.js';

const root = new URL('../docs/lesson-studio-evidence/p2-evaluation-2026-10-27/', import.meta.url);
const outputPath = new URL('meta-live-run-missing-quote-retest.json', root);
const prior = JSON.parse(await readFile(new URL('meta-live-run-corrected.json', root), 'utf8'));
const historicalCaseId = 'missing-quote';
const testCase = LIVE_EVAL_CASES.find((row) => row.id === 'quoted-grammar-error');
if (!prior.cases.some((row) => row.caseId === historicalCaseId && row.status === 'error')) throw Error('No failed historical case to deliberately re-evaluate.');
try { await readFile(outputPath, 'utf8'); throw Error('Retest report already exists; refusing duplicate call.'); }
catch (error) { if (error.code !== 'ENOENT') throw error; }

let key = process.env.DD_META_KEY?.trim() || '';
if (!key && process.platform === 'darwin') {
  try { key = execFileSync('/usr/bin/security', ['find-generic-password', '-s', 'DD_META_KEY', '-a', 'DD-lesson-studio', '-w'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim(); }
  catch { throw Error('DD_META_KEY unavailable; no provider call made.'); }
}
if (!key) throw Error('DD_META_KEY unavailable; no provider call made.');

const maxTokens = 10000;
const perCallLimitUsd = 0.05;
const payload = { phrase: testCase.phrase, sourceSentence: testCase.sourceSentence, prompt: testCase.prompt, answer: testCase.answer };
const controller = new AbortController();
const timer = setTimeout(() => controller.abort(), 45_000);
const started = performance.now();
let result;
try {
  const response = await fetch('https://api.meta.ai/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'muse-spark-1.3', temperature: 0.2, max_tokens: maxTokens, reasoning_effort: 'medium', messages: [{ role: 'system', content: TUTOR_FEEDBACK_INSTRUCTIONS }, { role: 'user', content: JSON.stringify(payload) }] }),
    signal: controller.signal,
  });
  const elapsedMs = Math.round(performance.now() - started);
  if (!response.ok) result = { caseId: testCase.id, status: 'error', httpStatus: response.status, elapsedMs, payload };
  else {
    const data = await response.json();
    const usage = data?.usage;
    if (!Number.isFinite(usage?.prompt_tokens) || !Number.isFinite(usage?.completion_tokens)) result = { caseId: testCase.id, status: 'unknown-usage', elapsedMs, providerResponseKeys: Object.keys(data || {}), payload };
    else {
      const estimatedUsd = estimateUsage({ inputTokens: usage.prompt_tokens, outputTokens: usage.completion_tokens });
      const rawOutput = data?.choices?.[0]?.message?.content ?? null;
      result = {
        caseId: testCase.id, status: 'success', elapsedMs, estimatedUsd,
        usage: { inputTokens: usage.prompt_tokens, outputTokens: usage.completion_tokens, totalTokens: usage.total_tokens ?? usage.prompt_tokens + usage.completion_tokens },
        finishReason: data?.choices?.[0]?.finish_reason ?? null,
        providerResponseKeys: Object.keys(data || {}), choiceKeys: Object.keys(data?.choices?.[0] || {}),
        messageKeys: Object.keys(data?.choices?.[0]?.message || {}), rawOutput, payload, expectedVerdicts: testCase.expected,
      };
      try {
        const raw = JSON.parse(rawOutput);
        const feedback = validateTutorFeedback(raw, testCase.answer);
        const quoteExact = !raw.quote || testCase.answer.includes(String(raw.quote).trim());
        result.rawFeedback = raw; result.feedback = feedback;
        result.expectedVerdictPass = testCase.expected.includes(feedback.verdict);
        result.quoteExact = quoteExact;
        result.quoteValid = quoteExact && (!testCase.quoteRequired || !!feedback.quote);
      } catch (error) {
        result.status = 'error'; result.error = error.message; result.errorCategory = /quote did not match/i.test(error.message) ? 'invalid-quote' : 'invalid-format';
      }
      if (estimatedUsd > perCallLimitUsd) result.stopReason = 'Local per-call estimate limit exceeded; no further request.';
    }
  }
} catch (error) {
  result = { caseId: testCase.id, status: 'error', elapsedMs: Math.round(performance.now() - started), errorCategory: controller.signal.aborted ? 'timeout' : 'network-or-provider-error', error: controller.signal.aborted ? 'Request timed out.' : error.message, payload };
} finally { clearTimeout(timer); key = ''; }

const report = {
  date: new Date().toISOString(), provider: 'Meta Model API', model: 'muse-spark-1.3',
  purpose: 'One deliberate retest of the missing-quote case after it reached the 2,000-token output cap; previous response remains unchanged.',
  historicalCaseId,
  adjudicatedCaseId: testCase.id,
  requestBound: { maxCalls: 1, maxTokens, perCallEstimateLimitUsd: perCallLimitUsd, automaticRetries: 0 },
  billingConfirmed: false,
  estimatedUsd: result.estimatedUsd ?? null,
  note: 'Synthetic payload only; no learner data or repository source. The Tutor adapter now uses max_tokens=10000 and reasoning_effort=medium. Estimate uses published standard rates and is not a confirmed Billing charge.',
  case: result,
};
await writeFile(outputPath, JSON.stringify(report, null, 2), { flag: 'wx' });
console.log(JSON.stringify({ status: result.status, caseId: result.caseId, elapsedMs: result.elapsedMs, usage: result.usage, estimatedUsd: result.estimatedUsd ?? null, finishReason: result.finishReason ?? null, errorCategory: result.errorCategory ?? null, output: outputPath.pathname }, null, 2));
