// Exact approved-envelope release regression. No approval or provider calls.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {chromium}=require('playwright-core');
const {openBrowser,qaUrl}=require('./browser-runtime.cjs');
const root=process.env.DD_RELEASE_ROOT;
const out=process.env.DD_QA_OUTPUT||path.resolve('docs/lesson-studio-evidence/p1-cross-model-2026-10-27/release-qa');
fs.mkdirSync(out,{recursive:true});
const results=[],errors=[],externalRequests=[];
const hashFile=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
async function snapshot(page){return page.evaluate(async()=>{const S=await import('/js/store.js'),D=await import('/js/db.js');return {items:await S.allItems(),reviews:await D.allReviews()};});}
async function run(){
 assert.ok(root,'Set DD_RELEASE_ROOT to approved release directories');
 const {digest,readPack}=await import('../../lessons/schema.js');
 const entries=[];
 for(const name of fs.readdirSync(root).sort()){
  const dir=path.join(root,name);if(!fs.statSync(dir).isDirectory()||!fs.existsSync(path.join(dir,'pack.json')))continue;
  const bytes=fs.readFileSync(path.join(dir,'pack.json')),envelope=await readPack(bytes.toString()),review=JSON.parse(fs.readFileSync(path.join(dir,'review.json'))),approval=JSON.parse(fs.readFileSync(path.join(dir,'approval.json')));
  assert.equal(approval.reviewSha256,await digest(review),'Review digest mismatch');
  assert.equal(approval.reviewedPayloadSha256,review.packSha256,'Reviewed payload link mismatch');
  assert.equal(approval.exportedPayloadSha256,envelope.sha256,'Approved payload link mismatch');
  assert.equal(envelope.payload.review.status,'approved');
  entries.push({name,dir,bytes,envelope,approval});
 }
 assert.ok(entries.length,'No approved release envelopes found');
 const browser=await openBrowser(chromium);
 try{
 for(const entry of entries)for(const mode of ['clean','preseeded']){
  const c=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'allow'}),p=await c.newPage();
  c.on('page',pg=>pg.on('pageerror',e=>errors.push(e.message)));p.on('pageerror',e=>errors.push(e.message));
  const origin=new URL(qaUrl('/')).origin;
  await c.route('**/*',route=>{const u=new URL(route.request().url());if(u.origin!==origin&&!['data:','blob:'].includes(u.protocol)){externalRequests.push({url:u.origin+u.pathname,method:route.request().method()});return route.abort();}return route.continue();});
  await p.goto(qaUrl('/lessons/'));
  await p.waitForFunction(()=>document.querySelector('#offline-status')?.textContent.startsWith('Ready offline'),null,{timeout:60000});
  const pack=entry.envelope.payload;
  let seeded=null;
  if(mode==='preseeded'){
   const t=pack.lessons[0].targets[0],l=pack.lessons[0],key=await digest({phrase:t.phrase.toLowerCase(),meaningEn:t.meaningEn,meaningVi:t.meaningVi});
   await p.evaluate(async({t,l,pack,key})=>{const S=await import('/js/store.js'),D=await import('/js/db.js');const r=await S.addItem({id:'lesson-'+key,type:'phrase',text:t.phrase,due:Date.now()-86400000,box:3,reviewCount:7,lastReviewedAt:Date.now()-172800000,fsrs:{s:8.3,d:4.7},dictionary:{senseKey:'lesson:'+key,definition:t.meaningEn+' · '+t.meaningVi,sourceFile:pack.packId+'@'+pack.version,source:'AI-assisted lesson · editor-reviewed',entryKey:t.phrase},context:{sentence:l.reading.sentences.find(s=>s.id===t.sourceSentenceId).text,sourceTitle:pack.title,headword:t.phrase},sourceTag:'lesson-studio'});await D.putReview({id:'qa-existing-review',itemId:r.item.id,at:Date.now()-172800000,rating:3,qaFixture:true});},{t,l,pack,key});
   seeded=await snapshot(p);
  }
  await p.locator('#import-pack').setInputFiles({name:'approved.json',mimeType:'application/json',buffer:entry.bytes});
  await p.getByRole('button',{name:'Study: '+pack.lessons[0].title,exact:true}).waitFor();
  const checks=[];
  for(const lesson of pack.lessons){
   const button=n=>p.getByRole('button',{name:n,exact:true});
   const study=()=>button('Study: '+lesson.title).click();
   await study();await p.getByText(lesson.reading.text,{exact:true}).waitFor();
   for(const t of lesson.targets)await p.getByText(t.meaningEn+' · '+t.meaningVi,{exact:true}).waitFor();
   await button('Start exercises').click();
   for(const e of lesson.exercises){
    await p.getByRole('heading',{name:e.prompt,exact:true}).waitFor();
    if(e.type==='transfer'){
     await p.locator('#transfer-answer').fill(e.sampleAnswer);
     await button('Reveal model and checklist').click();await p.getByText(e.sampleAnswer,{exact:true}).waitFor();
     for(const line of e.selfCheck)await p.getByText(line,{exact:true}).waitFor();
     await button('Finish self-check').click();checks.push(e.exerciseId+': transfer fill/model/all checklist');
    }else{
     for(const option of e.options.filter(o=>o.id!==e.correctOptionId)){
      await p.locator('input[value="'+option.id+'"]').check();await button('Check answer').click();
      await p.getByText('Not yet — inspect the explanation and try again.',{exact:true}).waitFor();
      await p.getByText(option.explanation,{exact:true}).waitFor();assert.equal(await button('Next exercise').count(),0);
     }
     await p.locator('input[value="'+e.correctOptionId+'"]').check();await button('Check answer').click();
     await p.getByText(e.options.find(o=>o.id===e.correctOptionId).explanation,{exact:true}).waitFor();
     await button('Next exercise').click();checks.push(e.exerciseId+': every wrong option blocked / correct advanced');
    }
   }
   await p.getByRole('heading',{name:'Lesson complete',exact:true}).waitFor();
   for(const t of lesson.targets){await p.locator('#status').evaluate(el=>el.textContent='');await button('Save to Vault: '+t.phrase).click();await p.waitForFunction(()=>/Real Vault card saved|Existing card kept/.test(document.querySelector('#status').textContent));}
   const saved=await snapshot(p);
   for(const t of lesson.targets){const key=await digest({phrase:t.phrase.toLowerCase(),meaningEn:t.meaningEn,meaningVi:t.meaningVi}),cards=saved.items.filter(i=>i.dictionary?.senseKey==='lesson:'+key);assert.equal(cards.length,1);assert.equal(cards[0].dictionary.definition,t.meaningEn+' · '+t.meaningVi);assert.equal(cards[0].dictionary.sourceFile,pack.packId+'@'+pack.version);assert.equal(cards[0].context.sentence,lesson.reading.sentences.find(s=>s.id===t.sourceSentenceId).text);}
   if(seeded){assert.deepEqual(saved.items.find(i=>i.id===seeded.items[0].id),seeded.items[0],'Existing scheduled card changed');assert.deepEqual(saved.reviews,seeded.reviews,'Review history changed');}
   // Navigate through the actual main-app links, without synthetic routes.
   await p.getByRole('link',{name:'Open Vault',exact:true}).click();
   await p.locator('#vault-view').waitFor({state:'visible'});
   for(const t of lesson.targets){await p.locator('#vault-search').fill(t.phrase);const card=p.locator('#vault-list .item-card').filter({has:p.getByText(t.phrase,{exact:true})}).first();await card.waitFor();await p.waitForFunction(({phrase,gloss})=>Array.from(document.querySelectorAll('#vault-list .item-card')).some(c=>c.querySelector('.item-text')?.textContent===phrase&&c.querySelector('.item-gloss')?.textContent===gloss),{phrase:t.phrase,gloss:t.meaningEn+' · '+t.meaningVi});}
   await p.goto(qaUrl('/lessons/'));await study();await p.getByRole('link',{name:'Open Review',exact:true}).click();await p.locator('#review-view').waitFor({state:'visible'});
   for(const t of lesson.targets){const card=p.locator('#review-list .review-card').filter({has:p.getByText(t.phrase,{exact:true})});await card.first().waitFor();await card.first().locator('.btn-show-answer').click();assert.equal(await card.first().locator('.item-gloss').first().textContent(),t.meaningEn+' · '+t.meaningVi);}
   await p.goto(qaUrl('/lessons/'));await study();await p.getByRole('heading',{name:'Lesson complete',exact:true}).waitFor();
   await c.setOffline(true);await p.reload();await study();await p.getByRole('heading',{name:'Lesson complete',exact:true}).waitFor();
   assert.deepEqual(await snapshot(p),saved,'Reload/offline changed Vault or review log');
   assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
   await p.screenshot({path:path.join(out,entry.name+'-'+mode+'-'+lesson.lessonId.replace(/[^a-z0-9-]/gi,'_')+'.png'),fullPage:true});
   await c.setOffline(false);await button('Back to library').click();
  }
  results.push({release:entry.name,packId:pack.packId,version:pack.version,payloadSha256:entry.envelope.sha256,packFileSha256:hashFile(path.join(entry.dir,'pack.json')),mode,status:'PASS',checks,vaultAndReview:'UI links, exact saved meanings/source, dedup schedule/log, reload/offline PASS'});
  await c.close();
 }
 assert.deepEqual(errors,[],'Uncaught JavaScript errors');assert.deepEqual(externalRequests,[],'External request attempted (blocked)');
 }finally{await browser.close();}
}
run().then(()=>{fs.writeFileSync(path.join(out,'approved-library-tests.json'),JSON.stringify({status:'PASS',testedAt:new Date().toISOString(),appFileSha256:hashFile('lessons/app.js'),runtimeSha256:Object.fromEntries(['lessons/app.js','lessons/storage.js','lessons/library.js','sw.js'].map(f=>[f,hashFile(f)])),physicalDevice:false,device:'Chrome mobile emulation 390x844',realProviderRequests:0,blockedExternalRequests:externalRequests,uncaughtExceptions:errors,results},null,2));console.log('PASS exact approved library release QA: '+results.length+' contexts; zero real provider requests');}).catch(error=>{fs.writeFileSync(path.join(out,'approved-library-tests.json'),JSON.stringify({status:'FAIL',testedAt:new Date().toISOString(),reason:error.message,results,blockedExternalRequests:externalRequests,uncaughtExceptions:errors,realProviderRequests:0},null,2));console.error(error);process.exitCode=1;});
