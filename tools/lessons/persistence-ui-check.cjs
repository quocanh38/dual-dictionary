const {openBrowser,qaUrl}=require('./browser-runtime.cjs');
const {chromium}=require('playwright-core');
const assert=require('node:assert/strict');
const fs=require('node:fs');
(async()=>{
 const browser=await openBrowser(chromium);
 try {
  const context=await browser.newContext({viewport:{width:390,height:844}}),page=await context.newPage();
  let calls=0;await context.route(/\/chat\/completions/,r=>{calls++;return r.abort();});
  const button=name=>page.getByRole('button',{name,exact:true});
  await page.goto(qaUrl('/lessons/'));
  await button('Load authored example').click();
  const study=()=>page.getByRole('button',{name:/^Study:/}).click();
  const fixture=JSON.parse(fs.readFileSync(process.env.DD_LESSON_ROOT+'/lessons/example.json'));
  await study();
  await page.evaluate(()=>{window.originalPut=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(...args){if(this.name==='progress')throw new DOMException('Simulated full storage','QuotaExceededError');return window.originalPut.apply(this,args);};});
  await button('Start exercises').click();
  await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('Simulated full storage'));
  assert.equal(await button('Start exercises').count(),1);
  await page.evaluate(()=>{IDBObjectStore.prototype.put=window.originalPut;});
  await button('Start exercises').click();
  for (const e of fixture.lessons[0].exercises) {
   await page.getByRole('heading',{name:e.prompt,exact:true}).waitFor();
   await page.reload();await study();
   await page.getByRole('heading',{name:e.prompt,exact:true}).waitFor();
   if(e.type==='transfer'){
    await page.locator('#transfer-answer').fill(e.sampleAnswer);
    await page.waitForFunction(async()=>{const S=await import('./storage.js');return (await S.listRecords('progress')).some(p=>Object.values(p.writing).some(Boolean));});
    await page.reload();await study();assert.equal(await page.locator('#transfer-answer').inputValue(),e.sampleAnswer);
    await button('Reveal model and checklist').click();await button('Finish self-check').waitFor();await page.reload();await study();await button('Finish self-check').click();
   }else{
    const radio=page.locator('input[value="'+e.correctOptionId+'"]');await radio.focus();await page.keyboard.press('Space');
    await page.waitForFunction(async ({exerciseId,optionId})=>{const S=await import('./storage.js');return (await S.listRecords('progress')).some(p=>p.answers[exerciseId]?.optionId===optionId);},{exerciseId:e.exerciseId,optionId:e.correctOptionId});
    await page.waitForFunction(id=>document.activeElement?.value===id,e.correctOptionId);
    await page.reload();await study();assert.equal(await page.locator('input[value="'+e.correctOptionId+'"]').isChecked(),true);
    await button('Check answer').click();await button('Next exercise').waitFor();await page.reload();await study();await button('Next exercise').click();
   }
  }
  await page.getByRole('heading',{name:'Lesson complete',exact:true}).waitFor();
  await context.setOffline(true);await page.reload();await study();await page.getByRole('heading',{name:'Lesson complete',exact:true}).waitFor();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  assert.equal(calls,0);
  fs.writeFileSync(process.env.DD_QA_OUTPUT+'/persistence-ui-tests.json',JSON.stringify({status:'PASS',checks:['storage failure visible; advance rolled back; retry works','reload before each exercise','keyboard Space selects radio; focus restored','answer selection and checked state survive reload','transfer writing and revealed checklist survive reload','completed no-key lesson survives offline reload','390px emulation no overflow'],providerCalls:0,physicalDevice:false},null,2));
  console.log('PASS storage retry, player-stage reloads, radio keyboard/focus and offline completion; 0 provider calls');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
