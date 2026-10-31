const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {openBrowser,qaUrl} = require('./browser-runtime.cjs');
(async () => {
  assert.equal(qaUrl('/lessons/#studio', {DD_QA_BASE_URL:'http://127.0.0.1:8877'}), 'http://127.0.0.1:8877/lessons/#studio');
  for (const origin of ['https://example.com','http://localhost/path','http://u:p@localhost']) assert.throws(()=>qaUrl('/lessons/',{DD_QA_BASE_URL:origin}),/loopback/);
  assert.throws(()=>qaUrl('https://example.com'),/local origin/);
  for (const env of [{}, {DD_BROWSER_HEADED:'1'}, {DD_CDP_ENDPOINT:'http://127.0.0.1:9222'}]) {
    const events=[];
    const browser={newContext:async options=>{events.push(['context',options]);return {close:async()=>events.push('context-close')};},close:async()=>events.push('browser-close')};
    const chromium={launch:async options=>{events.push(['launch',options]);return browser;},connectOverCDP:async url=>{events.push(['cdp',url]);return browser;}};
    const result=await openBrowser(chromium,env);
    assert.equal(events[0][0],env.DD_CDP_ENDPOINT?'cdp':'launch');
    if (!env.DD_CDP_ENDPOINT) assert.equal(events[0][1].headless,!env.DD_BROWSER_HEADED);
    await result.newContext({viewport:{width:390,height:844}});
    await result.close();
    assert.deepEqual(events.slice(-2),['context-close','browser-close']);
  }
  const output=fs.mkdtempSync(path.join(os.tmpdir(),'dd-browser-runtime-'));
  try {
    await assert.rejects(openBrowser({launch:async()=>{throw new Error('EPERM');}}, {DD_QA_OUTPUT:output}),/BLOCKED, not PASS/);
    assert.equal(JSON.parse(fs.readFileSync(path.join(output,'browser-startup.json'))).status,'BLOCKED');
    let connections=0;
    await assert.rejects(openBrowser({connectOverCDP:async()=>{connections++;}}, {DD_CDP_ENDPOINT:'https://example.com'}),/BLOCKED/);
    assert.equal(connections,0);
  } finally { fs.rmSync(output,{recursive:true,force:true}); }
  console.log('PASS browser mode selection, isolated context cleanup, fail-closed CDP and truthful startup evidence (mocked; not browser QA)');
})().catch(error=>{console.error(error);process.exitCode=1;});
