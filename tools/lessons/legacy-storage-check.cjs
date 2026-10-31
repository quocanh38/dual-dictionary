const {openBrowser}=require('./browser-runtime.cjs');
const {chromium}=require('playwright-core');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
const base=process.env.DD_QA_BASE_URL||'http://127.0.0.1:8877';
const output=process.env.DD_QA_OUTPUT||path.resolve('docs/lesson-studio-evidence/agents-2026-10-27/storage');
const oldCommit='8b7e0f267';
const historical={storage:execFileSync('git',['show',oldCommit+':lessons/storage.js'],{encoding:'utf8'}),generator:execFileSync('git',['show',oldCommit+':lessons/generator.js'],{encoding:'utf8'})};
(async()=>{fs.mkdirSync(output,{recursive:true});const browser=await openBrowser(chromium);const results=[];const pass=name=>results.push({name,status:'PASS'});try{
 const context=await browser.newContext(),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(base+'/lessons/');
 const initial=await page.evaluate(async historical=>{
  const moduleFrom=async text=>import(URL.createObjectURL(new Blob([text],{type:'text/javascript'})));
  const oldS=await moduleFrom(historical.storage),oldG=await moduleFrom(historical.generator.replace("'./schema.js'",JSON.stringify(location.origin+'/lessons/schema.js')));
  const fixture=await(await fetch('./example.json')).json(),V=await import('./schema.js'),Store=await import('../js/store.js'),DB=await import('../js/db.js');
  const oldDraft=await oldS.saveDraft(oldG.startDraft({title:'Historical draft',author:'QA fixture',article:fixture.lessons[0].reading.text,rightsStatement:'Authored application fixture for QA',rightsConfirmed:true}));
  await oldS.installPack(await V.exportPack(fixture));
  const progress={id:oldS.progressKey(fixture,fixture.lessons[0]),step:2,answers:{},writing:{},revealed:{}};await oldS.putRecord('progress',progress);
  const t=fixture.lessons[0].targets[0],key=await V.digest({phrase:t.phrase.toLowerCase(),meaningEn:t.meaningEn,meaningVi:t.meaningVi});
  const fields={id:'legacy-vault-card',type:'phrase',text:t.phrase,dictionary:{senseKey:'lesson:'+key,definition:t.meaningEn+' · '+t.meaningVi},due:1893456000000,lastReviewedAt:1793000000000,reviewCount:9,box:5,fsrs:{s:21.5,d:4.25},note:'Existing learner note',tags:['personal'],sourceTag:'existing-personal-card'};
  await Store.addItem(fields);await DB.putReview({id:'existing-review-log',itemId:fields.id,at:1793000000000,rating:3});
  return {oldDraft,progress,fixture,vault:await Store.allItems(),reviews:await DB.allReviews()};
 },historical);pass('Original Studio generator/storage from 8b7e0f267 create older records in isolated browser');
 const mixed=await page.evaluate(async initial=>{
  const S=await import('./storage.js'),B=await import('./backup.js'),G=await import('./generator.js'),V=await import('./schema.js');
  const draft=await S.saveDraft(G.startDraft({...initial.oldDraft.source,title:'New draft',rightsConfirmed:true}));
  await S.putRecord('usage',{id:'new-usage',at:new Date().toISOString(),draftId:draft.id,purpose:'select-targets',model:'fixture-no-call',outcome:'failed-or-unknown',usage:null});
  const backup=await B.createBackup();const raw=JSON.stringify(backup);await B.readBackup(raw);
  const old=await S.getRecord('drafts',initial.oldDraft.id);old.source.title='Locally edited after backup';const saved=await S.saveDraft(old);
  const result=await B.restoreBackup(raw);const after=await S.snapshotRecords();
  const newer=structuredClone(initial.fixture);newer.version++;await S.installPack(await V.exportPack(newer));
  return {backup,result,after,saved,installed:await S.listRecords('packs')};
 },initial);
 assert.equal(mixed.backup.data.drafts.length,2);assert.equal(mixed.backup.data.usage.length,1);pass('Mixed historical/current records create and validate complete backup');
 assert.deepEqual(mixed.result,{added:0,keptLocal:5});assert.deepEqual(mixed.after.drafts.find(d=>d.id===initial.oldDraft.id),mixed.saved);pass('Restore keeps newer local draft revision and original progress without overwrite');
 assert.equal(mixed.installed.length,2);pass('Installing a newer pack version retains historical installed version');
 const restoredContext=await browser.newContext(),restored=await restoredContext.newPage();await restored.goto(base+'/lessons/');
 const imported=await restored.evaluate(async backup=>{const B=await import('./backup.js'),S=await import('./storage.js');return {result:await B.restoreBackup(JSON.stringify(backup)),data:await S.snapshotRecords()};},mixed.backup);
 assert.deepEqual(imported.result,{added:5,keptLocal:0});for(const name of ['drafts','packs','progress','usage'])assert.deepEqual(imported.data[name],mixed.backup.data[name]);pass('Fresh second context restores every mixed record byte-for-byte');
 const fault=await page.evaluate(async backup=>{const S=await import('./storage.js'),V=await import('./schema.js'),B=await import('./backup.js');const before=await S.snapshotRecords(),data=structuredClone(backup.data);data.drafts[0].id='rollback-only-draft';const p=structuredClone(data.packs[0].payload);p.title+=' conflicting';data.packs[0]={id:data.packs[0].id,...await V.exportPack(p)};await B.validateSnapshot(data);let rejected=false;try{await S.mergeRecords(data);}catch{rejected=true;}return{before,after:await S.snapshotRecords(),rejected};},mixed.backup);
 assert.equal(fault.rejected,true);assert.deepEqual(fault.after,fault.before);pass('Mixed merge conflict rolls back additions in every Studio store');
 const retry=await page.evaluate(async()=>{
  const S=await import('./storage.js'),B=await import('./backup.js');const before=await S.snapshotRecords();
  const current=before.drafts[0],stale={...current,revision:current.revision-1};let staleRejected=false;try{await S.saveDraft(stale);}catch{staleRejected=true;}
  const afterStale=await S.snapshotRecords();
  const originalOpen=IDBFactory.prototype.open;let denied=false;
  try{IDBFactory.prototype.open=function(){throw new DOMException('QA-injected storage denial','SecurityError');};try{await B.createBackup();}catch(e){denied=e.name==='SecurityError';}}
  finally{IDBFactory.prototype.open=originalOpen;}
  const backup=await B.createBackup();await B.readBackup(JSON.stringify(backup));return{staleRejected,denied,before,afterStale,afterRetry:await S.snapshotRecords()};
 });
 assert.equal(retry.staleRejected,true);assert.deepEqual(retry.afterStale,retry.before);pass('Stale draft write rejects without altering any Studio record');
 assert.equal(retry.denied,true);assert.deepEqual(retry.afterRetry,retry.before);pass('Injected IndexedDB open denial rejects backup; restored open permits retry without record changes');
 // Exercise real library import, then real completion/Vault duplicate save.
 await page.reload();await page.locator('#import-pack').setInputFiles({name:'existing-pack.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({format:mixed.backup.data.packs[0].format,payload:mixed.backup.data.packs[0].payload,sha256:mixed.backup.data.packs[0].sha256}))});
 await page.getByText('Pack installed atomically. Existing lesson progress was preserved.',{exact:true}).waitFor();
 const importProgress=await page.evaluate(async id=>(await import('./storage.js')).getRecord('progress',id),initial.progress.id);assert.deepEqual(importProgress,initial.progress);pass('Real library pack import keeps historical learner progress exactly');
 await page.getByRole('button',{name:'Study: '+initial.fixture.lessons[0].title,exact:true}).first().click();
 await page.evaluate(async initial=>{const S=await import('./storage.js');await S.putRecord('progress',{...initial.progress,step:initial.fixture.lessons[0].exercises.length+1});},initial);
 await page.reload();await page.getByRole('button',{name:'Study: '+initial.fixture.lessons[0].title,exact:true}).first().click();
 await page.getByRole('button',{name:'Save to Vault: '+initial.fixture.lessons[0].targets[0].phrase,exact:true}).click();
 await page.getByText('Existing card kept; review schedule unchanged.',{exact:true}).waitFor();pass('Real pack import/player duplicate Vault save preserves existing card');
 const final=await page.evaluate(async()=>{const Store=await import('../js/store.js'),DB=await import('../js/db.js');return{vault:await Store.allItems(),reviews:await DB.allReviews()};});
 assert.deepEqual(final.vault,initial.vault);assert.deepEqual(final.reviews,initial.reviews);pass('Vault notes, due date, FSRS memory state and review log remain exactly unchanged');
 await page.reload();const persisted=await page.evaluate(async()=>{const Store=await import('../js/store.js'),DB=await import('../js/db.js');return{vault:await Store.allItems(),reviews:await DB.allReviews()};});assert.deepEqual(persisted,final);assert.deepEqual(errors,[]);pass('Existing learner records survive reload without page errors');
 fs.writeFileSync(path.join(output,'legacy-storage-tests.json'),JSON.stringify({status:'PASS',testedAt:new Date().toISOString(),base,historicalCommit:oldCommit,appCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),fileSha256:Object.fromEntries(['lessons/storage.js','lessons/backup.js','lessons/app.js','js/store.js','js/db.js'].map(p=>[p,require('node:crypto').createHash('sha256').update(fs.readFileSync(p)).digest('hex')])),scope:'Isolated Chrome contexts; no real user profile, Meta calls, approval or deployment; historical Studio schema v1 compatibility, not database migration.',results},null,2));console.log(results.length+' legacy storage groups PASS');
 }finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
