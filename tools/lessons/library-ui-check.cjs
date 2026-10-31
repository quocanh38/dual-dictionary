// Public catalogue UI regression; loopback only, no approval/provider requests.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('playwright-core'),{openBrowser,qaUrl}=require('./browser-runtime.cjs');
const out=process.env.DD_QA_OUTPUT||path.resolve('docs/lesson-studio-evidence/p1-cross-model-2026-10-27/library-ui-qa');
fs.mkdirSync(out,{recursive:true});const results=[],errors=[],external=[];
async function stores(p){return p.evaluate(async()=>{const S=await import('./storage.js'),V=await import('/js/store.js'),D=await import('/js/db.js');return {packs:await S.listRecords('packs'),progress:await S.listRecords('progress'),items:await V.allItems(),reviews:await D.allReviews()};});}
async function run(){
 const {readLibraryIndex}=await import('../../lessons/library.js');
 const index=readLibraryIndex(fs.readFileSync('lessons/library/index.json','utf8'));assert.ok(index.packs.length,'Empty public catalogue');
 const browser=await openBrowser(chromium);
 async function context(serviceWorkers='allow'){
  const c=await browser.newContext({viewport:{width:390,height:844},serviceWorkers});
  await c.route('**/*',r=>{const u=new URL(r.request().url());if(u.origin!==new URL(qaUrl('/')).origin&&!['data:','blob:'].includes(u.protocol)){external.push(u.origin+u.pathname);return r.abort();}return r.continue();});
  const p=await c.newPage();p.on('pageerror',e=>errors.push(e.message));return {c,p};
 }
 try{
 const {c,p}=await context();await p.goto(qaUrl('/lessons/'));
 await p.waitForFunction(()=>document.querySelector('#offline-status')?.textContent.startsWith('Ready offline'),null,{timeout:60000});
 await p.evaluate(async()=>{const V=await import('/js/store.js'),D=await import('/js/db.js');const r=await V.addItem({id:'qa-catalogue-existing',type:'phrase',text:'existing card',due:Date.now()-86400000,reviewCount:4,lastReviewedAt:Date.now()-172800000,fsrs:{s:6.8,d:4.2}});await D.putReview({id:'qa-catalogue-existing-review',itemId:r.item.id,at:Date.now()-172800000,rating:3});});
 const seeded=await stores(p);
 // Prove catalogue and packs are precached before any pack has been installed.
 await c.setOffline(true);await p.reload();
 for(const entry of index.packs){
  await p.getByRole('button',{name:'Install lesson: '+entry.title,exact:true}).click();
  await p.getByText('Reviewed lesson installed. No API key or provider call used.',{exact:true}).waitFor();
  const state=await stores(p),installed=state.packs.filter(v=>v.id===entry.packId+'@'+entry.version);
  assert.equal(installed.length,1);assert.equal(installed[0].sha256,entry.sha256);assert.deepEqual(state.items,seeded.items);assert.deepEqual(state.reviews,seeded.reviews);
  await p.reload();await p.getByText('Installed on this browser. Use Study below.',{exact:true}).first().waitFor();
  assert.equal(await p.getByRole('button',{name:'Install lesson: '+entry.title,exact:true}).count(),0);
  // Reimport the exact cached envelope: no duplicate rows or schedule reset.
  const raw=fs.readFileSync(path.join('lessons/library',entry.file));
  await p.locator('#import-pack').setInputFiles({name:entry.file,mimeType:'application/json',buffer:raw});
  await p.getByText('Pack installed atomically. Existing lesson progress was preserved.',{exact:true}).waitFor();
  const after=await stores(p);assert.deepEqual(after,state);
  results.push({packId:entry.packId,sha256:entry.sha256,status:'PASS',checks:['real catalogue install while offline before prior install','exact installed sha256','reload hides repeat install','reimport idempotent','existing Vault schedule/FSRS/review history preserved']});
 }
 assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 await p.screenshot({path:path.join(out,'catalogue-offline-installed.png'),fullPage:true});await c.close();
 const entry=index.packs[0];
 for(const kind of ['malformed-index','tampered-pack']){
  const {c,p}=await context('block');
  if(kind==='malformed-index')await c.route('**/lessons/library/index.json',r=>r.fulfill({contentType:'application/json',body:JSON.stringify({...index,packs:[{...entry,file:'../outside.json'}]})}));
  else await c.route('**/lessons/library/'+entry.file,r=>{const e=JSON.parse(fs.readFileSync(path.join('lessons/library',entry.file)));e.payload.title+=' TAMPERED';return r.fulfill({contentType:'application/json',body:JSON.stringify(e)});});
  await p.goto(qaUrl('/lessons/'));
  if(kind==='malformed-index'){await p.getByText('Invalid library entry.',{exact:true}).waitFor();assert.equal(await p.getByRole('button',{name:/^Install lesson:/}).count(),0);}
  else{await p.getByRole('button',{name:'Install lesson: '+entry.title,exact:true}).click();await p.waitForFunction(()=>document.querySelector('#status').textContent.includes('Integrity check failed'));}
  assert.deepEqual((await stores(p)).packs,[]);results.push({case:kind,status:'PASS',checks:['visible rejection','no installed pack']});await c.close();
 }
 assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
 }finally{await browser.close();}
}
run().then(()=>{fs.writeFileSync(path.join(out,'library-ui-tests.json'),JSON.stringify({status:'PASS',testedAt:new Date().toISOString(),runtimeSha256:Object.fromEntries(['lessons/app.js','lessons/storage.js','lessons/library.js','sw.js'].map(f=>[f,require('node:crypto').createHash('sha256').update(fs.readFileSync(f)).digest('hex')])),physicalDevice:false,device:'Chrome emulation 390x844',realProviderRequests:0,blockedExternalRequests:external,uncaughtExceptions:errors,results},null,2));console.log('PASS public lesson catalogue offline install, dedup and malformed/tampered UI rejection');}).catch(e=>{fs.writeFileSync(path.join(out,'library-ui-tests.json'),JSON.stringify({status:'FAIL',reason:e.message,results,uncaughtExceptions:errors,blockedExternalRequests:external,realProviderRequests:0},null,2));console.error(e);process.exitCode=1;});
