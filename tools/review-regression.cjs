#!/usr/bin/env node
// Runs real production functions with isolated persistence/DOM doubles. No user DB.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert/strict');
const ROOT = path.resolve(__dirname, '..');
const app = fs.readFileSync(path.join(ROOT, 'js/app.js'), 'utf8').replace(/\r\n/g, '\n');
const store = fs.readFileSync(path.join(ROOT, 'js/store.js'), 'utf8')
  .replace(/^import .*;\r?\n/gm, '').replace(/export /g, '');
const optimizer = fs.readFileSync(path.join(ROOT, 'js/fsrs-opt.js'), 'utf8').replace(/export /g, '');
function fn(name) {
  const start = app.search(new RegExp('(?:async )?function ' + name + '\\('));
  assert(start >= 0, 'Missing app function ' + name);
  return app.slice(start, app.indexOf('\n}', start) + 2);
}
function context(extra = {}) {
  return vm.createContext({ console, Date, Math, Map, Set, Number, String, Array, Blob, crypto: globalThis.crypto, ...extra });
}
function deferred() { let resolve, reject; const promise = new Promise((a,b) => { resolve=a; reject=b; }); return {promise,resolve,reject}; }
let checks = 0;
async function test(name, run) { await run(); checks++; console.log('PASS ' + name); }
async function main() {
  await test('JSON restore preserves FSRS, schedule, context and local-wins', async () => {
    let saved = []; const c = context(); vm.runInContext(store, c);
    c.allItems = async () => saved; c.putItems = async rows => saved.push(...rows);
    const original = { id:'a', text:'run', type:'word', reviewCount:8, due:1000, lastReviewedAt:500,
      fsrs:{s:80,d:6}, context:{sentence:'I run daily.'}, userData:{status:'learning',tags:['exercise']} };
    await c.importItems({version:3,items:[original]});
    assert.equal(saved[0].fsrs.s,80); assert.equal(saved[0].fsrs.d,6);
    assert.equal(saved[0].due,1000); assert.equal(saved[0].reviewCount,8);
    assert.equal(saved[0].context.sentence,original.context.sentence);
    const result = await c.importItems({version:3,items:[{...original,fsrs:{s:1,d:1}}]});
    assert.equal(result.skipped,1); assert.equal(saved[0].fsrs.s,80);
    saved=[]; await c.importItems({version:3,items:[{...original,fsrs:{s:-1,d:6}}]});
    assert.equal(saved[0].fsrs,undefined);
  });
  for (const gotIt of [false,true]) await test('Reading copy grade persists canonical item: ' + (gotIt?'Good':'Again'), async () => {
    let persisted, writes=0; const logs=[];
    const item={id:'r',text:'run',type:'word',due:1,reviewCount:0,box:1,userData:{status:'new',tags:[]}};
    const c=context({state:{items:[item]},getItemById:()=>item,putReview:async r=>logs.push(r),
      updateVocabBadge(){},updateReviewBadge(){},updateSaveButtonState(){},renderPractice(){},markPracticeDay(){},
      practiceStats:{ok:0,done:0},practiceIndex:0,practiceChecked:true});
    vm.runInContext(store,c); c.putItem=async row=>{writes++;persisted=structuredClone(row);};
    vm.runInContext(fn('gradeById')+'\n'+fn('finishPracticeCard'),c);
    const before=Date.now(); await c.finishPracticeCard({...item,forceCloze:true},gotIt);
    assert.equal(writes,1); assert.equal(persisted.reviewCount,1); assert.equal(logs.length,1);
    assert.equal(persisted.fsrs.s,item.fsrs.s); assert(persisted.due>before);
    if(!gotIt) { assert(persisted.due<=Date.now()+600000); assert(persisted.userData.tags.includes('review-later')); }
    assert(!('forceCloze' in persisted));
  });
  await test('Direct Review boot waits for items, then keeps an active queue', async () => {
    const nodes={}; for(const id of ['#review-list','#review-count','#review-empty','#review-empty-msg'])
      nodes[id]={classList:{add(){},remove(){}},innerHTML:'',textContent:'',appendChild(){}};
    const c=context({$:id=>nodes[id],reviewQueueIds:null,reviewTotal:0,state:{items:[],itemsReady:false},
      buildReviewCard:i=>i,i18n:x=>x}); c.getItemById=id=>c.state.items.find(i=>i.id===id);
    vm.runInContext(fn('dueItems')+'\n'+fn('renderReview'),c);
    c.renderReview(); assert.equal(c.reviewQueueIds,null);
    c.state.items=[{id:'due',due:1,userData:{status:'new'}}]; c.state.itemsReady=true; c.renderReview();
    assert.equal(c.reviewQueueIds.length,1); assert.equal(c.reviewTotal,1);
    c.state.items.push({id:'later',due:1,userData:{status:'new'}}); c.renderReview();
    assert.equal(c.reviewQueueIds.length,1,'Do not replace an active session');
  });
  function renderContext(lookup, build = async (d,h)=>({doc:h})) {
    const iframe={dataset:{}}; const frame={querySelector:()=>iframe,scrollTop:0}; const statuses=[];
    const c=context({state:{dicts:{oxford:{mdx:{ext:'mdx',numEntries:2,lookup}}}},$:()=>frame,
      lookupGen:1,latestLookupEntries:{generation:1,word:'bank',bySlot:{}},anchorJumps:new Map(),setStatus:(s,t)=>statuses.push(t),formatEntry:x=>x,tapOrigin:null,
      dictDisplayName:()=> 'Oxford',
      buildEntryDoc:build,clearDidYouMean(){},emptyDoc:()=> 'EMPTY',showDidYouMean(){},
      lookupLemmatized:async()=>null,escapeHtml:x=>x,console:{error(){}},performance});
    vm.runInContext(fn('renderSlot'),c); return {c,iframe,statuses};
  }
  for(const outcome of ['hit','miss','error']) await test('Old lookup cannot overwrite latest: '+outcome,async()=>{
    const old=deferred(); const {c,iframe,statuses}=renderContext(w=>w==='old'?old.promise:Promise.resolve([{text:w}]));
    const pending=c.renderSlot('oxford','old'); c.lookupGen++; await c.renderSlot('oxford','new');
    if(outcome==='error') old.reject(new Error('old error')); else old.resolve(outcome==='miss'?[]:[{text:'old'}]);
    await pending; assert.equal(iframe.srcdoc,'new'); assert(!statuses.includes('lookup error'));
  });
  await test('Old buildEntryDoc cannot overwrite latest',async()=>{
    const oldBuild=deferred(); const {c,iframe}=renderContext(async w=>[{text:w}],async(d,h)=>h==='old'?oldBuild.promise:{doc:h});
    const pending=c.renderSlot('oxford','old'); await new Promise(r=>setImmediate(r));
    c.lookupGen++; await c.renderSlot('oxford','new'); oldBuild.resolve({doc:'old'}); await pending;
    assert.equal(iframe.srcdoc,'new');
  });
  await test('Replaced dictionary invalidates pending render',async()=>{
    const old=deferred(); const {c,iframe}=renderContext(()=>old.promise);
    const pending=c.renderSlot('oxford','old'); c.state.dicts.oxford=null;
    old.resolve([{text:'old'}]); await pending; assert.equal(iframe.srcdoc,undefined);
  });
  await test('Gloss recovers after empty source and invalidates old in-flight source',async()=>{
    const c=context({state:{dicts:{}},SLOTS:{oxford:{}}});
    vm.runInContext('const glossCache = new Map(); let glossGeneration = 0;\n'+fn('invalidateGlossCache')+'\n'+fn('quickGloss'),c);
    assert.equal(await c.quickGloss('run'),'');
    c.state.dicts.oxford={mdx:{lookup:async()=>[{text:'first meaning'}]}};
    assert.equal(await c.quickGloss('run'),'first meaning');
    const old=deferred(); c.invalidateGlossCache(); c.state.dicts.oxford={mdx:{lookup:()=>old.promise}};
    const pending=c.quickGloss('run'); c.state.dicts.oxford={mdx:{lookup:async()=>[{text:'new meaning'}]}};
    c.invalidateGlossCache(); old.resolve([{text:'stale meaning'}]);
    assert.equal(await pending,'new meaning'); assert.equal(await c.quickGloss('run'),'new meaning');
    c.state.dicts.oxford=null; c.invalidateGlossCache(); assert.equal(await c.quickGloss('run'),'');
  });
  for(const warmed of [false,true]) await test('Scheduler/replay parity: first, 10 min, <1 day, 1 day, old logs; warm='+warmed,async()=>{
    let clock=2000000000000; class TestDate extends Date { static now(){return clock;} }
    const item={id:'s',text:'study',type:'word',reviewCount:warmed?4:0,box:3,due:1,lastReviewedAt:warmed?clock-2*86400000:0,userData:{status:'learning',tags:[]}};
    const logs=[]; const c=context({Date:TestDate,getItemById:()=>item,putReview:async r=>logs.push(structuredClone(r)),updateVocabBadge(){},updateReviewBadge(){},updateSaveButtonState(){}});
    vm.runInContext(store,c); c.putItem=async()=>{};vm.runInContext(fn('gradeById'),c);
    const o=context(); vm.runInContext(optimizer,o); const weights=vm.runInContext('DEFAULT_W',o);
    for(const [delta,action] of [[0,'forgot'],[600000,'know'],[86390000,'know'],[86400000,'forgot']]) {
      clock+=delta;await c.gradeById('s',action);const replay=o.replay({records:logs},weights);
      assert(Math.abs(replay.s-item.fsrs.s)<1e-10); assert(Math.abs(replay.d-item.fsrs.d)<1e-10);
    }
    assert.equal(o.replay({records:logs},weights).points,warmed?2:1);
    const legacy=logs.map(({longTerm,...r})=>r);const legacyReplay=o.replay({records:legacy},weights);
    assert(Math.abs(legacyReplay.s-item.fsrs.s)<1e-10);
  });
  await test('SW gate catches unbumped JS/CSS, accepts bump, checks missing and binary content',()=>{
    const {inspectShell}=require('./sw-shell-check.cjs');
    const sw=v=>`const CACHE = 'mdx-dict-v${v}';\nconst ASSETS = ['./', './js/app.js', './css/style.css', './samples/a.mdx'];`;
    const base={'sw.js':Buffer.from(sw(99)),'index.html':Buffer.from('home\n'),'js/app.js':Buffer.from('old\n'),'css/style.css':Buffer.from('style'),'samples/a.mdx':Buffer.from([0,1])};
    const current={...base};const check=()=>inspectShell(current['sw.js'].toString(),sw(99),f=>{if(!current[f])throw Error('missing');return current[f];},f=>base[f]);
    assert(check().ok); current['index.html']=Buffer.from('home\r\n');assert(check().ok);
    current['js/app.js']=Buffer.from('new');assert(!check().ok);
    current['sw.js']=Buffer.from(sw(100));assert(check().ok);
    current['sw.js']=Buffer.from(sw(98));assert(!check().ok);
    current['sw.js']=Buffer.from(sw(100));delete current['css/style.css'];assert(!check().ok);
    Object.assign(current,base);current['samples/a.mdx']=Buffer.from([0,2]);assert(!check().ok);
  });
  console.log('ALL PASS — '+checks+' regression scenarios');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
