// Browser integration smoke for BYOK AI flows. A local CORS-enabled fake provider
// exercises consent, payload boundaries, citation validation, cancellation, retry
// and the full Tutor path without spending real provider tokens.
const { chromium } = require('playwright-core');
const fs = require('fs'), http = require('http'), path = require('path'), assert = require('assert/strict');
const root = process.cwd(), requests = [];
const appServer = http.createServer((req, res) => {
  if (req.url.split('?')[0] === '/sw.js') return res.writeHead(404).end(); // Serve source directly in interactive tests; offline cache has its own smoke.
  let file = path.join(root, decodeURIComponent(req.url.split('?')[0]));
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  if (!fs.existsSync(file)) return res.writeHead(404).end();
  const mime = file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : file.endsWith('.html') ? 'text/html' : 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': mime }); res.end(fs.readFileSync(file));
});
const providerServer = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.writeHead(204).end();
  let body = '';
  req.on('data', chunk => body += chunk);
  req.on('end', () => {
    const call = JSON.parse(body); requests.push({ headers: req.headers, call });
    if (req.headers.authorization !== 'Bearer local-test-key') return reply(401, { error: 'invalid key' });
    const input = call.messages?.[1]?.content || '', instruction = call.messages?.[0]?.content || '';
    if (input.includes('delay-case')) return setTimeout(() => reply(200, completion({ strengths: ['Delayed'], improvements: [], next_step: 'Retry' })), 2500);
    if (input.includes('quota-case')) return reply(429, { error: 'quota' });
    if (input.includes('malformed-case')) return reply(200, completion({ strengths: 'wrong-shape' }));
    if (instruction.includes('Connection check')) return reply(200, completion({ status: 'ok' }));
    if (instruction.includes('Extract up to eight')) return reply(200, completion({ phrases: [{ phrase: 'carry out research', sourceSentence: 'Our team will carry out research into how students learn new vocabulary.', meaningVi: 'tiến hành nghiên cứu', selectionReason: 'A useful academic collocation.' }] }));
    if (instruction.includes('Create one realistic NEW situation')) return reply(200, completion({ prompt: JSON.parse(input).contextId === 'study' ? 'Describe how your team would study a new learning method.' : 'Your manager needs a market study. Explain your plan for the client.', contextId: JSON.parse(input).contextId }));
    if (instruction.includes('Evaluate natural, accurate phrase use')) {
      const answer = JSON.parse(input).answer;
      const quote = answer.slice(0, Math.min(answer.length, 26));
      return reply(200, completion({ verdict: 'incorrect', quote, issue: 'Verb tense', suggestion: 'Use the past form for a completed action.', explanation_vi: 'Dùng thì quá khứ cho hành động đã hoàn tất.', retry_prompt: 'Use the phrase in a different situation.' }));
    }
    if (instruction.includes('You are an English practice coach')) {
      const request = JSON.parse(input);
      const quote = request.response.includes('malformed-case') ? 'not a source quote' : request.response.slice(0, Math.min(16, request.response.length));
      return reply(200, completion({ strengths: ['You responded to the task.'], improvements: [{ quote, advice: 'Add one concrete supporting detail.' }], next_step: 'Revise one sentence.' }));
    }
    return reply(200, completion({ status: 'ok' }));
    function reply(status, data) { res.writeHead(status, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }); res.end(JSON.stringify(data)); }
  });
});
function completion(value) { return { choices: [{ message: { content: JSON.stringify(value) } }] }; }
(async () => {
  await Promise.all([new Promise(resolve => appServer.listen(0, '127.0.0.1', resolve)), new Promise(resolve => providerServer.listen(0, '127.0.0.1', resolve))]);
  const appBase = `http://127.0.0.1:${appServer.address().port}`, providerBase = `http://127.0.0.1:${providerServer.address().port}/v1`;
  if (process.argv.includes('--serve-only')) {
    console.log(`APP_URL=${appBase}`); console.log(`MOCK_PROVIDER_URL=${providerBase}`);
    setInterval(() => {}, 60_000);
    return;
  }
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } }), page = await context.newPage(), pageErrors = [];
    page.setDefaultTimeout(15000); page.on('pageerror', e => pageErrors.push(e.message));
    await page.goto(appBase); await page.locator('#onboarding-dialog').waitFor({ state: 'visible' }); await page.locator('#onboarding-dialog .dialog-close').click();
    if (await page.locator('#firstload-dialog').isVisible().catch(() => false)) {
      await page.locator('#chk-firstload-oxford').uncheck(); await page.locator('#btn-quickload').click();
      await page.getByRole('tab', { name: 'Wiktionary', exact: true }).waitFor({ timeout: 30000 });
    }
    await page.locator('#btn-advanced').click(); await page.locator('#adv-tab-learning').click();
    await page.locator('#adv-panel-learning > details > summary').first().click();
    await page.locator('#ai-provider').selectOption('compatible'); await page.locator('#ai-base-url').fill(providerBase); await page.locator('#ai-model').fill('mock-model'); await page.locator('#ai-api-key').fill('local-test-key');
    await page.locator('#btn-ai-test').click(); await page.getByText(/Connected to OpenAI-compatible endpoint \/ mock-model/).waitFor();
    await page.locator('#btn-advanced-close').click().catch(async () => page.locator('#advanced-dialog .dialog-close').click());

    await page.locator('.app-nav a[data-nav="reader"]').click();
    const article = 'Our team will carry out research into how students learn new vocabulary. We will collect examples and compare the results next week.';
    await page.locator('#reader-input').fill(article); await page.locator('#btn-reader-start').click(); await page.locator('#btn-tutor-start').click();
    await page.locator('#tutor-request-consent').waitFor(); assert.ok((await page.locator('#tutor-stage').innerText()).includes('Review the exact learner data'));
    await page.locator('#tutor-stage details > summary').click(); assert.equal(await page.locator('.tutor-payload-preview').innerText(), article);
    await page.locator('#tutor-request-consent').check(); await page.getByRole('button', { name: 'Agree and send request' }).click();
    await page.getByText('Live result · OpenAI-compatible endpoint / mock-model').waitFor(); await page.getByRole('heading', { name: 'carry out research' }).waitFor();
    await page.getByText('Meaning (VI): tiến hành nghiên cứu', { exact: true }).waitFor();
    await page.getByText('Why suggested: A useful academic collocation.', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Practise this phrase' }).click();
    await page.locator('#tutor-request-consent').waitFor(); await page.locator('#tutor-stage details > summary').click(); assert.match(await page.locator('.tutor-payload-preview').innerText(), /sourceSentence/);
    await page.locator('#tutor-request-consent').check(); await page.getByRole('button', { name: 'Agree and send request' }).click();
    await page.getByText(/Live AI prompt/).waitFor();
    const answer = 'I carry out research yesterday.';
    await page.locator('#tutor-stage textarea').fill(answer);
    await page.waitForFunction(async (answer) => {
      const { getTutorRecord } = await import('./js/db.js');
      return (await getTutorRecord(localStorage.getItem('dd-tutor-current')))?.answer === answer;
    }, answer);
    const beforeReload = requests.length;
    await page.reload();
    await page.locator('.app-nav a[data-nav="reader"]').click();
    if (await page.locator('#reader-input').isVisible()) {
      await page.locator('#reader-input').fill(article); await page.locator('#btn-reader-start').click();
    }
    await page.locator('#btn-tutor-start').click();
    await page.locator('#tutor-stage textarea').waitFor();
    assert.equal(await page.locator('#tutor-stage textarea').inputValue(), answer);
    assert.equal(requests.length, beforeReload, 'Reload must restore draft without calling provider');
    console.log('PASS Tutor draft and prompt survive reload with no automatic API call');

    // Drop the provider connection, then return quota and bad citations before recovery.
    for (const mode of ['network', 'quota', 'bad-quote', 'missing-quote', 'context-only']) {
      await page.route(`${providerBase}/**`, async route => {
        if (mode === 'network') return route.abort('internetdisconnected');
        if (mode === 'quota') return route.fulfill({ status: 429, contentType: 'application/json', body: '{}' });
        if (mode === 'context-only') return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(completion({verdict:'incorrect',quote:answer,issue:'Pronoun referent is unclear without context',suggestion:'Use a named object.'}))});
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(completion({ verdict: 'incorrect', quote: mode === 'missing-quote' ? '' : 'invented quote', suggestion: 'Fix this' })) });
      });
      await page.getByRole('button', { name: 'Get feedback' }).click();
      await page.locator('#tutor-request-consent').check();
      await page.getByRole('button', { name: 'Agree and send request' }).click();
      if (mode === 'context-only') {
        await page.getByRole('heading',{name:'The tutor is unsure',exact:true}).waitFor();
        assert.equal((await page.locator('#tutor-stage').innerText()).includes('Use a named object.'),false);
        await page.getByRole('button',{name:'Accept feedback',exact:true}).click();
        const rec=await page.evaluate(async()=>{const{getTutorRecord}=await import('./js/db.js');return getTutorRecord(localStorage.getItem('dd-tutor-current'));});
        assert.equal(rec.confirmedErrors.length,0,'Context-only feedback cannot become a confirmed language error');
        assert.match(await page.locator('#tutor-status').innerText(),/No language error was confirmed/);
        await page.unroute(`${providerBase}/**`);
        await page.getByRole('button',{name:'Revise this answer',exact:true}).click();
        assert.equal(await page.locator('#tutor-stage textarea').inputValue(),answer);
        console.log('PASS context-only guard: no forced correction, no confirmed error after accept');
        continue;
      }
      if (mode === 'missing-quote') {
        await page.getByRole('heading', { name: 'The tutor is unsure' }).waitFor();
        assert.equal(await page.getByRole('button', { name: 'Accept feedback', exact: true }).count(), 0);
        assert.equal((await page.locator('#tutor-stage').innerText()).includes('Fix this'), false);
      } else {
        await page.getByRole('button', { name: 'Retry feedback' }).waitFor();
        assert.match(await page.locator('#tutor-status').innerText(), mode === 'network' ? /Could not reach/ : mode === 'quota' ? /rate limit/ : /quote did not match/);
      }
      await page.unroute(`${providerBase}/**`);
      await page.getByRole('button', { name: mode === 'missing-quote' ? 'Request feedback again' : 'Retry feedback', exact: true }).click();
      assert.equal(await page.locator('#tutor-stage textarea').inputValue(), answer);
    }
    console.log('PASS provider network loss, 429 and invalid citation preserve draft and allow retry');

    let releaseDelayed;
    const delayed = new Promise(resolve => { releaseDelayed = resolve; });
    await page.route(`${providerBase}/**`, async route => {
      await delayed;
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(completion({ verdict: 'correct', quote: '' })) }).catch(() => {});
    });
    await page.getByRole('button', { name: 'Get feedback' }).click();
    await page.locator('#tutor-request-consent').check();
    await page.getByRole('button', { name: 'Agree and send request' }).click();
    await page.getByRole('button', { name: 'Cancel request', exact: true }).click();
    releaseDelayed(); await page.unroute(`${providerBase}/**`);
    assert.equal(await page.locator('#tutor-stage textarea').inputValue(), answer);
    assert.match(await page.locator('#tutor-status').innerText(), /Request cancelled/);
    console.log('PASS Tutor cancellation preserves answer and permits another request');
    await page.getByRole('button', { name: 'Get feedback' }).click();
    await page.locator('#tutor-request-consent').waitFor(); await page.locator('#tutor-stage details > summary').click(); assert.match(await page.locator('.tutor-payload-preview').innerText(), /I carry out research yesterday/);
    await page.locator('#tutor-request-consent').check(); await page.getByRole('button', { name: 'Agree and send request' }).click();
    await page.getByText(/Live AI feedback · OpenAI-compatible endpoint/).waitFor(); assert.equal(await page.locator('#tutor-stage blockquote').innerText(), 'I carry out research yesterday.'.slice(0, 26));
    assert.equal(await page.getByRole('button', { name: 'Save phrase to Vault' }).count(), 0);
    await page.getByRole('button', { name: 'Accept feedback' }).click();
    const callsBeforeNew = requests.length;
    await page.getByRole('button', { name: 'Try another situation', exact: true }).click();
    await page.locator('#tutor-request-consent').waitFor();
    assert.equal(requests.length, callsBeforeNew, 'New situation needs its own consent');
    await page.locator('#tutor-stage details > summary').click();
    const preview = JSON.parse(await page.locator('.tutor-payload-preview').innerText());
    assert.equal(preview.contextId, 'workplace');
    assert.deepEqual(preview.previousPrompts, ['Describe how your team would study a new learning method.']);
    assert.equal(JSON.stringify(preview).includes(answer), false, 'Previous answer is not sent to generate a situation');
    await page.getByRole('button', { name: 'Back without sending', exact: true }).click();
    await page.getByText(answer, { exact: true }).waitFor();
    assert.equal(requests.length, callsBeforeNew);
    await page.getByRole('button', { name: 'Try another situation', exact: true }).click();

    await page.locator('#tutor-request-consent').check();
    await page.getByRole('button', { name: 'Agree and send request' }).click();
    await page.getByText('Your manager needs a market study. Explain your plan for the client.', { exact: true }).waitFor();
    assert.equal(await page.locator('#tutor-stage textarea').inputValue(), '');
    await page.locator('#tutor-stage textarea').fill(answer);
    await page.getByRole('button', { name: 'Get feedback', exact: true }).click();
    await page.locator('#tutor-request-consent').check();
    await page.getByRole('button', { name: 'Agree and send request' }).click();
    await page.getByRole('button', { name: 'Accept feedback', exact: true }).click();
    await page.getByRole('button', { name: 'Save phrase to Vault', exact: true }).click();
    await page.getByText(/Saved to your Vault/).waitFor(); await page.getByRole('button', { name: /Practise: carry out research/ }).waitFor();
    const savedMeaning = await page.evaluate(async () => {
      const { allItems } = await import('./js/store.js');
      return (await allItems()).find(item => item.text === 'carry out research')?.dictionary?.definition;
    });
    assert.equal(savedMeaning, 'tiến hành nghiên cứu');


    await page.locator('#tutor-dialog .dialog-close').click();
    await page.locator('.app-nav a[data-nav="practice"]').click(); await page.locator('#offline-exam-lab > summary').click(); await page.locator('.offline-writing > summary').click();
    await page.locator('.offline-writing .ai-review > summary').click();
    const writing = 'This is my original writing response with a specific supporting detail.';
    await page.locator('#writing-input').fill(writing); await page.locator('#writing-ai-consent').check(); await page.locator('#btn-writing-ai-review').click();
    await page.locator('#writing-ai-feedback').getByText(/Live AI feedback/).waitFor();
    const writingRequest = requests.findLast(r => r.call.messages?.[0]?.content?.includes('English practice coach') && JSON.parse(r.call.messages[1].content).response === writing);
    assert.ok(writingRequest); assert.match(writingRequest.call.messages[1].content, /prompt/); assert.equal(writingRequest.call.messages[1].content.includes('audioData'), false);

    await page.locator('#writing-input').fill('delay-case'); await page.locator('#writing-ai-consent').check(); await page.locator('#btn-writing-ai-review').click();
    await page.locator('#btn-writing-ai-cancel').waitFor({ state: 'visible' }); await page.locator('#btn-writing-ai-cancel').click(); await page.getByText(/Request cancelled/).waitFor();
    assert.equal(await page.locator('#writing-ai-consent').isChecked(), false);
    await page.locator('#writing-input').fill('malformed-case response'); await page.locator('#writing-ai-consent').check(); await page.locator('#btn-writing-ai-review').click();
    await page.getByText(/unexpected format|quote did not match/).waitFor();

    await page.locator('.offline-speaking > summary').click();
    await page.locator('.offline-speaking .ai-review > summary').click();
    await page.locator('#speaking-notes').fill('My typed speaking notes only.'); await page.locator('#speaking-ai-consent').check(); await page.locator('#btn-speaking-ai-review').click();
    await page.locator('#speaking-ai-feedback').getByText(/Live AI feedback/).waitFor();
    const speakingRequest = requests.findLast(r => r.call.messages?.[0]?.content?.includes('English practice coach') && JSON.parse(r.call.messages[1].content).response === 'My typed speaking notes only.');
    assert.ok(speakingRequest); assert.equal(speakingRequest.call.messages[1].content.includes('audio'), false);
    assert.deepEqual(pageErrors, []);
    console.log('PASS: semantic gloss in Vault; missing-quote downgrade; new-context consent/cancel/generation; live-provider browser flow, per-request payload consent, Tutor accept/save/new scenario, Writing/Speaking attribution, citations, cancel/retry; no page errors');
    await context.close();
  } finally { await browser.close(); appServer.close(); providerServer.close(); }
})().catch(error => { console.error(error); appServer.close(); providerServer.close(); process.exit(1); });
