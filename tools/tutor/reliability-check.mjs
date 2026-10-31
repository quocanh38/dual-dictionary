// Exercise the actual app request functions with controlled storage/network timing.
// No provider calls, real keys, or browser profiles are used.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
const source = await fs.readFile('js/app.js', 'utf8');
const prompts = await import('../../js/tutor-prompts.js');
const { validateTutorSituation } = await import('../../js/tutor-validation.js');
function fn(name) {
  const start = source.search(new RegExp(`(?:async )?function ${name}\\(`));
  assert.ok(start >= 0, name);
  const rest = source.slice(start);
  const next = rest.slice(1).search(/\n(?:async )?function /);
  return next < 0 ? rest : rest.slice(0, next + 1);
}
function deferred() {
  let resolve, reject;
  const promise = new Promise((ok, no) => { resolve = ok; reject = no; });
  return { promise, resolve, reject };
}
function harness(overrides = {}) {
  const messages = [], stage = { replaceChildren() {}, append() {} };
  let calls = 0, writes = 0;
  const ctx = vm.createContext({
    AbortController, Date, console, ...prompts, validateTutorSituation,
    tutorSession: { id: 'session', target: { phrase: 'phrase' }, article: 'article', phrases: [{ phrase: 'phrase' }], stage: 'select' },
    tutorBusy: false, tutorController: null, tutorRequestId: 0, tutorPendingRequest: null,
    tutorSystem: '', TUTOR_PROMPT_VERSION: 'test', state: { items: [] },
    $: () => stage, tutorText: () => ({}), tutorButton: () => ({}),
    tutorStatus: text => messages.push(text), renderTutorStage() {}, renderTutorAnswer() {},
    renderTutorFeedback() {}, tutorRenderSuggestions() {},
    tutorProviderMatchesSession: () => true, tutorProviderLabel: () => 'mock',
    getAiSettings: () => ({ apiKey: 'fake', provider: 'compatible', model: 'mock' }),
    localStorage: { setItem() {} }, putTutorRecord: async () => {},
    askTutor: async () => { calls++; return { prompt: 'New prompt', contextId: 'study', phrases: [{}] }; },
    validateTutorFeedback: x => x, validateTutorPhrases: x => x || [],
    getTutorCache: () => null, setTutorCache: () => { writes++; },
    tutorLocalHistory: async () => ({ confirmedErrors: [] }), rankTutorPhrases: x => x,
    tutorShowRequestConsent() {}, ...overrides,
  });
  vm.runInContext(['persistTutor','createTutorPrompt','requestTutorFeedback','findTutorPhrases','cancelTutorRequest'].map(fn).join('\n'), ctx);
  return { ctx, messages, calls: () => calls, writes: () => writes };
}
for (const [name, argument] of [['createTutorPrompt', 0], ['requestTutorFeedback', 'My draft']]) {
  const h = harness({ putTutorRecord: async () => { throw new Error('Storage full'); } });
  await h.ctx[name](argument);
  assert.equal(h.ctx.tutorBusy, false, `${name} must unlock after a failed save`);
  assert.equal(h.ctx.tutorController, null);
  assert.equal(h.calls(), 0, 'Do not contact provider when draft save failed');
  assert.match(h.messages.join(' '), /Storage full/);
  h.ctx.putTutorRecord = async () => {};
  await h.ctx[name](argument);
  assert.equal(h.calls(), 1, 'Retry must work after storage recovers');
}
console.log('PASS storage failure unlocks prompt/feedback and allows retry without premature API call');
for (const [name, argument] of [['createTutorPrompt', 0], ['requestTutorFeedback', 'My draft']]) {
  const gate = deferred();
  const h = harness({ putTutorRecord: () => gate.promise });
  const request = h.ctx[name](argument);
  h.ctx.cancelTutorRequest();
  gate.resolve(); await request;
  assert.equal(h.calls(), 0, 'Cancel during persistence must prevent a late API request');
  assert.equal(h.ctx.tutorBusy, false);
}
console.log('PASS cancellation while saving prevents late prompt/feedback requests');
{
  const gate = deferred();
  const h = harness({ tutorLocalHistory: () => gate.promise });
  const request = h.ctx.findTutorPhrases({ consented: true });
  await Promise.resolve();
  h.ctx.cancelTutorRequest();
  const replacement = { id: 'new-session', phrases: [], stage: 'select' };
  h.ctx.tutorSession = replacement;
  gate.resolve({ confirmedErrors: [] }); await request;
  assert.equal(replacement.phrases.length, 0, 'Cancelled response must not mutate a newer session');
}
console.log('PASS cancelled phrase ranking cannot overwrite a newer session');
{
  const h = harness({ validateTutorPhrases: () => [] });
  await h.ctx.findTutorPhrases({ consented: true });
  assert.equal(h.writes(), 0, 'Rejected extraction must not be cached');
  assert.match(h.messages.join(' '), /No suggestions passed/);
}
{
  const h = harness({ getTutorCache: () => ({ value: { phrases: [] } }) });
  await h.ctx.findTutorPhrases({ consented: true });
  assert.equal(h.calls(), 1, 'An old invalid cache must not block retrying the provider');
}
console.log('PASS invalid extractions stay out of cache and old rejected caches allow live retry');
{
  let pointer = null;
  const h = harness({ localStorage: { setItem: (_key, value) => { pointer = value; } }, putTutorRecord: async () => { throw new Error('Storage full'); } });
  await assert.rejects(h.ctx.persistTutor(), /Storage full/);
  assert.equal(pointer, null, 'Do not point resume at an unwritten session');
}
console.log('PASS resume pointer is published only after the session is stored');

{
  const gate = deferred();
  const h = harness({ askTutor: () => gate.promise });
  const oldTarget = { phrase: 'previous phrase' };
  h.ctx.tutorSession.target = oldTarget;
  const request = h.ctx.createTutorPrompt(0);
  await Promise.resolve(); await Promise.resolve();
  h.ctx.cancelTutorRequest();
  gate.resolve({ prompt: 'Late prompt' }); await request;
  assert.equal(h.ctx.tutorSession.target, oldTarget, 'Cancelled prompt must retain the previous target and answer');
}
console.log('PASS cancelled prompt preserves the previous target');
for (const [name, argument] of [['createTutorPrompt', 0], ['requestTutorFeedback', 'My draft']]) {
  const gate = deferred(); let saves = 0, renders = 0;
  const h = harness({
    putTutorRecord: async () => { if (++saves === 2) await gate.promise; },
    renderTutorAnswer: () => { renders++; }, renderTutorFeedback: () => { renders++; },
  });
  const request = h.ctx[name](argument);
  for (let i = 0; i < 10 && saves < 2; i++) await Promise.resolve();
  assert.equal(saves, 2);
  h.ctx.cancelTutorRequest();
  gate.resolve(); await request;
  assert.equal(renders, 0, 'A cancelled request must not repaint after its final save completes');
}
console.log('PASS late persistence cannot repaint cancelled prompt/feedback');
{
  const gate = deferred(); let pointer = null;
  const h = harness({ putTutorRecord: () => gate.promise, localStorage: { setItem: (_key, value) => { pointer = value; } } });
  const saving = h.ctx.persistTutor();
  h.ctx.tutorSession = null;
  gate.resolve(); await saving;
  assert.equal(pointer, null, 'Discarding a session must not restore its resume pointer after a pending save');
}
console.log('PASS a pending save cannot restore a discarded session pointer');
{
  const h=harness({askTutor:async()=>({prompt:'Please rewrite your answer.',contextId:'workplace'})});
  const previousFeedback={verdict:'incorrect',quote:'old answer'};
  h.ctx.tutorSession.prompt='An existing university situation';
  h.ctx.tutorSession.promptContextId='study';
  h.ctx.tutorSession.stage='feedback';
  h.ctx.tutorSession.feedback=previousFeedback;
  h.ctx.tutorSession.feedbackDecision='accepted';
  h.ctx.tutorSession.answer='old answer';
  await h.ctx.createTutorPrompt(0,{freshContext:true});
  assert.equal(h.ctx.tutorSession.stage,'feedback');
  assert.equal(h.ctx.tutorSession.answer,'old answer');
  assert.equal(h.ctx.tutorSession.feedback,previousFeedback);
  assert.equal(h.ctx.tutorBusy,false);
  assert.match(h.messages.join(' '),/revision task/);
}
console.log('PASS rejected new-situation output preserves previous feedback, answer and retry ability');
