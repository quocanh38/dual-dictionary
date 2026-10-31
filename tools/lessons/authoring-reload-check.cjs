// Fixture-only browser regression: no release candidates or real provider traffic.
const {openBrowser,qaUrl}=require('./browser-runtime.cjs');
const {chromium}=require('playwright-core');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=process.env.DD_LESSON_ROOT||process.cwd();
const output=process.env.DD_QA_OUTPUT||path.join(root,'docs/lesson-studio-evidence/agents-2026-10-27/authoring');
const base=new URL(qaUrl('/lessons/',{DD_QA_BASE_URL:process.env.DD_QA_BASE_URL||'http://127.0.0.1:8877'})).origin;
const fixture=JSON.parse(fs.readFileSync(path.join(root,'lessons/example.json')));
let unexpected=0,mockedCalls=0;
(async()=>{
 fs.mkdirSync(output,{recursive:true});
 const browser=await openBrowser(chromium),checks=[];
 try{
 const context=await browser.newContext({viewport:{width:390,height:844}});
 await context.exposeFunction('qaRecordProviderCall',()=>{mockedCalls++;});
 // Even a broken mock must never send a credential or request to a provider.
 await context.route('**/*',route=>{const u=new URL(route.request().url());if(u.origin!==new URL(base).origin){unexpected++;return route.abort();}return route.continue();});
 await context.addInitScript(()=>{
  const original=window.fetch.bind(window);window.qaProviderCalls=0;
  window.fetch=(url,options)=>{
   if(String(url).includes('/chat/completions')){
    window.qaProviderCalls++;window.qaRecordProviderCall();
    // Deliberately ignore AbortSignal: emulate a provider finishing after cancellation.
    return new Promise(resolve=>{window.qaResolveProvider=result=>resolve(new Response(JSON.stringify({choices:[{message:{content:JSON.stringify(result)},finish_reason:'stop'}],usage:{prompt_tokens:10,completion_tokens:20,total_tokens:30}}),{status:200,headers:{'Content-Type':'application/json'}}));});
   }
   return original(url,options);
  };
 });
 const page=await context.newPage(),pageErrors=[];page.on('pageerror',e=>pageErrors.push(e.message));page.setDefaultTimeout(12000);
 const btn=name=>page.getByRole('button',{name,exact:true});
 const state=()=>page.evaluate(async()=>{const s=await import('./storage.js');return {drafts:await s.listRecords('drafts'),usage:await s.listRecords('usage'),progress:await s.listRecords('progress')};});
 const reopen=async title=>{await page.goto(base+'/lessons/');await btn('Open draft: '+title).click();};
 const assertReload=async(title,stage)=>{const before=(await state()).drafts.find(d=>d.source.title===title);await page.reload();await reopen(title);const after=(await state()).drafts.find(d=>d.id===before.id);assert.deepEqual(after,before);assert.equal(after.stage,stage);checks.push(stage+' stage survives reload with exact persisted payload');};
 // Seed real learning progress through the player UI, before touching authoring.
 await page.goto(base+'/lessons/');await btn('Load authored example').click();await page.getByRole('button',{name:/^Study:/}).click();await btn('Start exercises').click();
 const first=fixture.lessons[0].exercises[0];await page.locator('input[value="'+first.correctOptionId+'"]').check();
 await page.waitForFunction(async({id,option})=>{const s=await import('./storage.js');return(await s.listRecords('progress')).some(p=>p.answers[id]?.optionId===option);},{id:first.exerciseId,option:first.correctOptionId});
 const learnerProgress=(await state()).progress;assert.equal(learnerProgress.length,1);
 await page.goto(base+'/lessons/#studio');
 await btn('Use authored source example').click();await page.waitForFunction(()=>document.querySelector('#source-title')?.value.length>0);await page.locator('#source-title').fill('QA authoring lifecycle');await page.locator('#source-confirmed').check();await btn('Create draft and inspect selection request').click();await btn('Back without sending').click();
 await assertReload('QA authoring lifecycle','source');
 const send=async inspect=>{await btn(inspect).click();await page.getByText('Provider settings and request limit',{exact:true}).click();await page.locator('#studio-baseten-key').fill('fixture-only-not-a-key');await page.locator('#studio-meta-key').fill('fixture-only-meta-key');await page.locator('#request-consent').check();await btn('Agree and send request').click();await page.waitForFunction(()=>typeof window.qaResolveProvider==='function');};
 await send('Inspect selection request');await page.evaluate(targets=>window.qaResolveProvider({targets}),fixture.lessons[0].targets);await btn('Inspect exercise generation request').waitFor();await assertReload('QA authoring lifecycle','selected');
 await send('Inspect exercise generation request');await page.evaluate(l=>window.qaResolveProvider({title:l.title,objective:l.objective,exercises:l.exercises}),fixture.lessons[0]);await btn('Preview lesson').waitFor();await assertReload('QA authoring lifecycle','draft');
 for(const id of ['rights','meaning','unique','explanations'])await page.locator('#review-'+id).check();await page.locator('#review-note').fill('Synthetic authored fixture only; regression of persisted review state.');await btn('Mark reviewed').click();await btn('Approve this pack').waitFor();await assertReload('QA authoring lifecycle','reviewed');
 assert.equal((await state()).drafts[0].pack.review.status,'reviewed');assert.equal(await btn('Export approved pack').count(),0);
 // A subsequent payload edit must invalidate persisted review, including after reload.
 await page.getByText('Edit draft JSON (saving edits resets review)',{exact:true}).click();const edited=JSON.parse(await page.locator('#pack-editor').inputValue());edited.title+=' edited';await page.locator('#pack-editor').fill(JSON.stringify(edited));await btn('Validate and save edits').click();await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('Review has been reset'));await assertReload('QA authoring lifecycle','draft');assert.equal(await btn('Approve this pack').count(),0);checks.push('payload edit invalidates reviewed status across reload');
 // Start a separate source, then let its request finish after switching to the saved draft.
 await btn('Start another source').click();await btn('Use authored source example').click();await page.waitForFunction(()=>document.querySelector('#source-title')?.value.length>0);await page.locator('#source-title').fill('QA delayed source');await page.locator('#source-confirmed').check();await btn('Create draft and inspect selection request').click();await btn('Back without sending').click();await send('Inspect selection request');
 const baseline=await state();await page.evaluate(()=>{location.hash='library';});await btn('Open draft: QA authoring lifecycle').click();await btn('Preview lesson').waitFor();await page.evaluate(targets=>window.qaResolveProvider({targets}),fixture.lessons[0].targets);
 await page.waitForFunction(async()=>{const s=await import('./storage.js');return(await s.listRecords('usage')).some(r=>r.outcome==='discarded-late');});
 assert.deepEqual((await state()).drafts,baseline.drafts);assert.equal(await btn('Preview lesson').count(),1);checks.push('delayed successful response after switching drafts discarded without overwriting either draft');
 // Provider feature is optional: offline refusal leaves all authored and learner records intact.
 const offlineBefore=await state();await btn('Start another source').click();await btn('Use authored source example').click();await page.waitForFunction(()=>document.querySelector('#source-title')?.value.length>0);await page.locator('#source-title').fill('QA offline source');await page.locator('#source-confirmed').check();await btn('Create draft and inspect selection request').click();
 const beforeRefusal=await state();await context.setOffline(true);await page.locator('#request-consent').check();await btn('Agree and send request').click();await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('You are offline'));assert.deepEqual(await state(),beforeRefusal);assert.deepEqual((await state()).progress,offlineBefore.progress);assert.deepEqual((await state()).progress,learnerProgress);checks.push('offline optional generation refused before network/ledger mutation; drafts and existing answered lesson progress preserved');
 assert.deepEqual(pageErrors,[]);assert.equal(mockedCalls,3);assert.equal(unexpected,0);assert.equal(await page.evaluate(()=>window.qaProviderCalls),1); // count resets on each reload; only stale call on current page
 const summary={status:'PASS',testedAt:new Date().toISOString(),checks,baseUrl:base,mockedProviderCalls:mockedCalls,uncaughtBrowserErrors:pageErrors,fixtureOnly:true,realProviderCalls:0,unexpectedExternalRequests:unexpected,approvalPerformed:false,physicalDevice:false,appSha256:crypto.createHash('sha256').update(fs.readFileSync(path.join(root,'lessons/app.js'))).digest('hex')};
 fs.writeFileSync(path.join(output,'authoring-reload-tests.json'),JSON.stringify(summary,null,2));console.log(JSON.stringify(summary,null,2));
 }finally{await browser.close();}
})().catch(e=>{fs.mkdirSync(output,{recursive:true});fs.writeFileSync(path.join(output,'authoring-reload-tests.json'),JSON.stringify({status:'FAIL',error:e.stack,unexpectedExternalRequests:unexpected},null,2));console.error(e);process.exitCode=1;});
