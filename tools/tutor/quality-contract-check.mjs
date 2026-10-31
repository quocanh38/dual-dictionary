import assert from 'node:assert/strict';
import { validateTutorFeedback, validateTutorPhrases, validateTutorSituation } from '../../js/tutor-validation.js';
import { makeTutorSituationPayload } from '../../js/tutor-prompts.js';
const article='Our team will carry out research into vocabulary learning.';
const phrase={phrase:'carry out research',sourceSentence:article,meaningVi:'tiến hành nghiên cứu',selectionReason:'Useful academic phrase'};
const [valid]=validateTutorPhrases([phrase],article);
assert.equal(valid.meaningVi,'tiến hành nghiên cứu');
assert.equal(valid.selectionReason,'Useful academic phrase');
assert.equal(validateTutorPhrases([{...phrase,meaningVi:'',reason:'Very useful phrase'}],article).length,0);
const answer='My bus leaves at seven.';
const downgraded=validateTutorFeedback({verdict:'incorrect',quote:'',suggestion:'You are wrong',explanation_vi:'Definite correction'},answer);
assert.equal(downgraded.verdict,'uncertain');
assert.equal(downgraded.evidenceStatus,'missing-quote');
assert.equal(downgraded.suggestion,'');
assert.equal(validateTutorFeedback(downgraded,answer).evidenceStatus,'missing-quote');
assert.equal(validateTutorFeedback({verdict:'correct',quote:''},answer).verdict,'correct');
assert.equal(validateTutorFeedback({verdict:'uncertain',quote:''},answer).verdict,'uncertain');
assert.throws(()=>validateTutorFeedback({verdict:'incorrect',quote:'invented'},answer),/quote did not match/);
assert.equal(validateTutorFeedback({verdict:'incorrect',quote:'My bus'},answer).verdict,'incorrect');
const session={prompt:'Explain your university project.',promptContextId:'study'};
const payload=makeTutorSituationPayload(phrase,session,true);
assert.equal(payload.contextId,'workplace');
assert.deepEqual(payload.previousPrompts,[session.prompt]);
assert.equal('answer' in payload,false);
assert.throws(()=>validateTutorSituation({prompt:session.prompt,contextId:'workplace'},payload),/repeated/);
assert.throws(()=>validateTutorSituation({prompt:'Please rewrite your answer.',contextId:'workplace'},payload),/revision/);
assert.throws(()=>validateTutorSituation({prompt:'Hãy viết lại câu cũ.',contextId:'workplace'},payload),/revision/);
assert.throws(()=>validateTutorSituation({prompt:'A different wording.',contextId:'study'},payload),/context/);
assert.equal(validateTutorSituation({prompt:'Explain a market study to your manager.',contextId:'workplace'},payload).contextId,'workplace');
console.log('PASS semantic meaning required; uncited incorrect feedback downgraded idempotently; exact quotes enforced; context changes and repeats/revision tasks rejected');

// Run actual save/accept handlers so legacy sessions cannot bypass the UI guards.
const fs = await import('node:fs/promises');
const vm = await import('node:vm');
const source = await fs.readFile('js/app.js','utf8');
const start=source.indexOf('async function handleTutorClick(');
const next=source.indexOf('\nasync function createTutorPrompt(',start);
const handler=source.slice(start,next);
let captured=null, message='';
const ctx=vm.createContext({
  tutorSession:{id:'legacy',target:{phrase:'carry out research',reason:'useful academic phrase',sourceSentence:article},feedback:{verdict:'correct'},feedbackDecision:'accepted',provider:'meta',model:'mock'},
  tutorBusy:false, tutorStatus:text=>{message=text;},
  validateTutorFeedback, PROVIDERS:{meta:{label:'Meta'}},
  senseStableKey:()=> 'sense', addItem:async item=>{captured=item;return {merged:true,item:{id:'item'}};},
  persistTutor:async()=>{},renderTutorStage(){},renderTutorFeedback(){},
});
vm.runInContext(handler,ctx);
await ctx.handleTutorClick({target:{dataset:{tutorAction:'save-phrase'}}});
assert.equal(captured,null);
assert.match(message,/no saved Vietnamese meaning/);
assert.equal(ctx.tutorBusy,false);
ctx.tutorSession.target.meaningVi='tiến hành nghiên cứu';
await ctx.handleTutorClick({target:{dataset:{tutorAction:'save-phrase'}}});
assert.equal(captured.dictionary.definition,'tiến hành nghiên cứu');
ctx.tutorSession.feedback={verdict:'incorrect',quote:'',suggestion:'Unproven correction'};
ctx.tutorSession.feedbackDecision=null; ctx.tutorSession.answer=answer;ctx.tutorSession.confirmedErrors=[];
await ctx.handleTutorClick({target:{dataset:{tutorAction:'accept-feedback'}}});
assert.equal(ctx.tutorSession.feedbackDecision,null);
assert.equal(ctx.tutorSession.confirmedErrors.length,0);
assert.equal(ctx.tutorSession.feedback.verdict,'uncertain');
console.log('PASS legacy reason cannot become a review answer; semantic meaning persists; uncited feedback cannot be accepted or logged as a confirmed error');

// A context-only false correction must not become a confirmed language error.
{
 const answer='She turned it down.';
 const f=validateTutorFeedback({verdict:'incorrect',quote:answer,issue:'Uses pronoun without an identified object, so the referent is unclear',suggestion:'She turned down the job offer.'},answer);
 assert.equal(f.verdict,'uncertain');assert.equal(f.evidenceStatus,'context-ambiguity');assert.equal(f.suggestion,'');assert.deepEqual(validateTutorFeedback(f,answer),f);
 const g=validateTutorFeedback({verdict:'incorrect',quote:'looked up it',issue:'Wrong particle placement with a pronoun; referent is also unclear',suggestion:'I looked it up.'},'I looked up it.');assert.equal(g.verdict,'incorrect');
 console.log('PASS context-only correction is safely uncertain and idempotent; real particle-order diagnosis retained');
}
