import { execFileSync } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { TUTOR_FEEDBACK_INSTRUCTIONS } from '../js/tutor-prompts.js';
import { LIVE_EVAL_CASES } from './tutor-live-eval-cases.js';
import { estimateUsage } from './lessons/budget.mjs';

const outputPath = new URL('../docs/lesson-studio-evidence/p2-evaluation-2026-10-27/probe-maxtokens-2000-2026-10-30.json', import.meta.url);
const testCase = LIVE_EVAL_CASES.find((c) => c.id === 'natural-use');
let key = process.env.DD_META_KEY?.trim() || '';
if (!key) {
  key = execFileSync('/usr/bin/security', ['find-generic-password', '-s', 'DD_META_KEY', '-a', 'DD-lesson-studio', '-w'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}
if (!key) throw Error('DD_META_KEY unavailable; no provider call made.');
const started = performance.now();
const controller = new AbortController();
const timer = setTimeout(() => controller.abort(), 60_000);
try {
  const response = await fetch('https://api.meta.ai/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'muse-spark-1.3', temperature: 0.2, max_tokens: 2000,
      messages: [{ role: 'system', content: TUTOR_FEEDBACK_INSTRUCTIONS },
        { role: 'user', content: JSON.stringify({ phrase: testCase.phrase, sourceSentence: testCase.sourceSentence, prompt: testCase.prompt, answer: testCase.answer }) }] }),
    signal: controller.signal,
  });
  const elapsedMs = Math.round(performance.now() - started);
  const data = await response.json();
  const choice = data?.choices?.[0] || {};
  const msg = choice.message || {};
  const shape = { httpStatus: response.status, elapsedMs,
    topKeys: Object.keys(data || {}), choiceKeys: Object.keys(choice),
    finishReason: choice.finish_reason ?? null, messageKeys: Object.keys(msg),
    contentType: typeof msg.content, contentLength: typeof msg.content === 'string' ? msg.content.length : null,
    contentHead: typeof msg.content === 'string' ? msg.content.slice(0, 300) : null,
    usage: data?.usage ?? null,
    estimatedUsd: data?.usage ? estimateUsage({ inputTokens: data.usage.prompt_tokens, outputTokens: data.usage.completion_tokens }) : null };
  key = '';
  await writeFile(outputPath, JSON.stringify({ date: new Date().toISOString(), caseId: 'natural-use', maxTokens: 2000, shape }, null, 2), { flag: 'wx' });
  console.log(JSON.stringify(shape, null, 1));
} finally { clearTimeout(timer); key = ''; }
