import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { STUDY_CONTENT_PACKS, IELTS_PATHWAY_STAGES, IELTS_DIAGNOSTIC_FORM, getStudyExercises, getStudyPrompts, validateStudyContentPacks } from '../../js/study-content.js';
import { IELTS_META_PRACTICE_EXERCISES, IELTS_META_WRITING_PROMPTS, IELTS_META_SPEAKING_PROMPTS } from '../../js/ielts-meta-practice.js';
const load=async path=>import('data:text/javascript;base64,'+Buffer.from(await fs.readFile(path,'utf8')).toString('base64'));
const {validateTutorPhrases,validateTutorFeedback}=await load('js/tutor-validation.js');
const article='Our team will carry out research into vocabulary learning.';
assert.equal(validateTutorPhrases([{phrase:'carry out research',sourceSentence:article,meaningVi:'tiến hành nghiên cứu'}],article).length,1);
assert.equal(validateTutorPhrases([{phrase:'invented phrase',sourceSentence:article}],article).length,0);
assert.throws(()=>validateTutorFeedback({quote:'not in answer'},'My answer'));
assert.equal(validateTutorFeedback({verdict:'uncertain',quote:''},'Answer').verdict,'uncertain');
const data=new Map();globalThis.localStorage={getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};
const cache=await load('js/tutor-cache.js');const args={provider:'meta',model:'sample',task:'phrases',input:article,promptVersion:'test'};
cache.setTutorCache(args,{phrases:[]});assert.ok(cache.getTutorCache(args));assert.equal(cache.getTutorCache({...args,input:'different article'}),null);assert.equal(cache.getTutorCache({...args,model:'other'}),null);
const source=(await fs.readFile('js/tutor-selection.js','utf8')).replace("import { normalizeText } from './store.js';","const normalizeText=x=>String(x).toLowerCase().trim();");
const {rankTutorPhrases}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const phrases=[{phrase:'new phrase'},{phrase:'due phrase'},{phrase:'error phrase'}];const result=rankTutorPhrases(phrases,{savedItems:[{type:'phrase',text:'due phrase',due:1,userData:{status:'learning'}}],confirmedErrors:[{phrase:'error phrase'}],now:100});assert.deepEqual(result.map(x=>x.phrase),['error phrase','due phrase','new phrase']);
console.log('PASS: grounding, exact feedback quotes, uncertainty, cache round-trip/isolation, local error/due ranking');
const packCheck=validateStudyContentPacks();
assert.equal(packCheck.valid,true,packCheck.issues.join('; '));
assert.equal(new Set(STUDY_CONTENT_PACKS.flatMap(p=>[...p.exercises,...p.writingPrompts,...p.speakingPrompts].map(x=>x.id))).size,packCheck.count);
assert.deepEqual(new Set(getStudyExercises('TOEIC Listening & Reading').map(x=>x.part.match(/Part ([1-7])/)[1])),new Set(['1','2','3','4','5','6','7']));
assert.deepEqual(new Set(getStudyExercises('IELTS Academic').map(x=>x.skill)),new Set(['Listening','Reading']));
assert.ok(STUDY_CONTENT_PACKS[0].writingPrompts.length>0&&STUDY_CONTENT_PACKS[0].speakingPrompts.length>0);
assert.equal(getStudyExercises('IELTS Academic').length,484);
assert.equal(getStudyExercises('IELTS Academic','band-5').length,125);
assert.equal(getStudyExercises('IELTS Academic','band-6').length,126);
assert.equal(getStudyExercises('IELTS Academic','band-6-5').length,129);
assert.equal(getStudyExercises('IELTS Academic','band-7').length,104);
for(const [skill,expectedSections] of [['Listening',[10,10,10,10]],['Reading',[13,13,14]]]){
  const diagnostic=getStudyExercises('IELTS Academic').filter(x=>x.skill===skill&&x.diagnosticSet===IELTS_DIAGNOSTIC_FORM).sort((a,b)=>a.diagnosticOrder-b.diagnosticOrder);
  assert.equal(diagnostic.length,40,`${skill} diagnostic should contain 40 questions`);
  assert.deepEqual(diagnostic.map(x=>x.diagnosticOrder),Array.from({length:40},(_,i)=>i+1),`${skill} diagnostic order should be complete`);
  assert.deepEqual(expectedSections.map((_,i)=>diagnostic.filter(x=>x.diagnosticSection===i+1).length),expectedSections,`${skill} diagnostic should follow section structure`);
  const answerCounts=[0,1,2,3].map(index=>diagnostic.filter(x=>x.type==='choice'&&x.answer===index).length);
  assert.ok(answerCounts.every(count=>count>=5),`${skill} answer key positions should be reasonably distributed: ${answerCounts.join(',')}`);
}
for(const stage of IELTS_PATHWAY_STAGES){
  for(const skill of ['Listening','Reading','Writing','Speaking']){
    const items=[...getStudyExercises('IELTS Academic',stage.id),...getStudyPrompts('writing',stage.id),...getStudyPrompts('speaking',stage.id)].filter(x=>x.skill===skill);
    assert.ok(items.length,`${stage.id} is missing ${skill}`);
    assert.ok(items.every(x=>x.pathwayStage===stage.id&&x.focus),`${stage.id} ${skill} is missing pathway metadata`);
  }
}
assert.equal(getStudyPrompts('writing').length,210);
assert.equal(getStudyPrompts('speaking').length,210);
assert.equal(IELTS_META_PRACTICE_EXERCISES.length,400);
assert.equal(IELTS_META_WRITING_PROMPTS.length,200);
assert.equal(IELTS_META_SPEAKING_PROMPTS.length,200);
const metaItems=[...IELTS_META_PRACTICE_EXERCISES,...IELTS_META_WRITING_PROMPTS,...IELTS_META_SPEAKING_PROMPTS];
assert.equal(metaItems.length,800);
for(const stage of IELTS_PATHWAY_STAGES){
  const batch=metaItems.filter(x=>x.pathwayStage===stage.id);
  assert.equal(batch.length,200,`${stage.id} must contain ten complete 20-item Meta batches`);
  for(const skill of ['Listening','Reading','Writing','Speaking'])
    assert.equal(batch.filter(x=>x.skill===skill).length,50,`${stage.id} must contain fifty ${skill} items`);
}
for(const promptId of ['ia-w3','ia-w5','ia-w7']){
  const prompt=getStudyPrompts('writing').find(x=>x.id===promptId);
  assert.ok(prompt?.image&&prompt.imageAlt,`${promptId} must include an accessible Academic Task 1 visual`);
  await fs.access(prompt.image.replace(/^\.\//,''));
}
console.log(`PASS: offline content-pack schema, ${packCheck.count} stable IDs, 800 cross-reviewed IELTS Meta items, IELTS productive prompts, TOEIC Parts 1–7`);
