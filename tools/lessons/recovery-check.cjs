// Fixture-only provider-routing regression. Both endpoints are intercepted;
// no real Baseten or Meta request is made.
const { openBrowser, qaUrl } = require('./browser-runtime.cjs');
const { chromium } = require('playwright-core');
const assert = require('node:assert/strict');
const fs = require('node:fs');

(async () => {
  const browser = await openBrowser(chromium);
  try {
    const context = await browser.newContext();
    const page = await context.newPage();
    const fixture = JSON.parse(fs.readFileSync(process.env.DD_LESSON_ROOT + '/lessons/example.json'));
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    let basetenCalls = 0;
    let metaCalls = 0;
    let metaModel;
    const basetenUrl = 'https://inference.baseten.co/v1/chat/completions';
    const metaUrl = 'https://api.meta.ai/v1/chat/completions';
    await page.route(basetenUrl, async (route) => {
      basetenCalls += 1;
      const request = route.request();
      const body = JSON.parse(request.postData());
      assert.equal(request.headers().authorization, 'Bearer baseten-placeholder');
      assert.equal(body.model, 'meta-models/muse-spark-open-1026');
      assert.equal(body.max_tokens, 65536);
      const selection = body.messages[0].content.includes('select exactly two');
      const content = selection
        ? JSON.stringify({ targets: fixture.lessons[0].targets })
        : 'incomplete JSON';
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          choices: [{ message: { content }, finish_reason: 'stop' }],
          usage: { prompt_tokens: 100, completion_tokens: 100, total_tokens: 200 },
        }),
      });
    });
    await page.route(metaUrl, async (route) => {
      metaCalls += 1;
      const request = route.request();
      const body = JSON.parse(request.postData());
      assert.equal(request.headers().authorization, 'Bearer meta-placeholder');
      assert.equal(body.reasoning_effort, 'medium');
      assert.equal(body.max_tokens, 65536);
      metaModel = body.model;
      const lesson = fixture.lessons[0];
      const content = JSON.stringify({
        title: 'Repaired with Meta',
        objective: lesson.objective,
        exercises: lesson.exercises,
      });
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          choices: [{ message: { content }, finish_reason: 'stop' }],
          usage: { prompt_tokens: 100, completion_tokens: 150, total_tokens: 250 },
        }),
      });
    });

    const button = (name) => page.getByRole('button', { name, exact: true });
    await page.goto(qaUrl('/lessons/#studio'));
    await page.getByText('Provider settings and request limit', { exact: true }).click();
    await page.locator('#studio-baseten-key').fill('baseten-placeholder');
    await page.locator('#studio-meta-key').fill('meta-placeholder');
    await page.locator('#studio-meta-model').selectOption('muse-spark-1.2');
    await button('Use authored source example').click();
    await page.waitForFunction(() => document.querySelector('#source-title')?.value.length > 0);
    await page.locator('#source-confirmed').check();
    await button('Create draft and inspect selection request').click();

    await page.locator('#request-consent').check();
    await button('Agree and send request').click();
    await button('Inspect exercise generation request').waitFor();
    assert.equal(basetenCalls, 1);

    await button('Inspect exercise generation request').click();
    await page.locator('#request-consent').check();
    await button('Agree and send request').click();
    await button('Inspect repair request').waitFor();
    await page.getByRole('heading', { name: 'Inspect before sending to Meta Model API', exact: true }).waitFor();
    assert.equal(basetenCalls, 2);
    assert.equal(metaCalls, 0);
    assert.equal(await button('Export approved pack').count(), 0);

    await page.locator('#repair-feedback').fill('The exercise response was malformed. Return complete JSON.');
    await button('Inspect repair request').click();
    await page.getByText('Provider: Meta Model API', { exact: false }).waitFor();
    await page.locator('#request-consent').check();
    await button('Agree and send request').click();
    await button('Download draft for review').waitFor();
    assert.equal(metaCalls, 1);
    assert.equal(metaModel, 'muse-spark-1.2');

    const saved = await page.evaluate(async () => {
      const store = await import('./storage.js');
      return { drafts: await store.listRecords('drafts'), usage: await store.listRecords('usage') };
    });
    assert.equal(saved.drafts[0].repairCount, 1);
    assert.equal(saved.drafts[0].pack.review.status, 'draft');
    assert.equal(saved.drafts[0].pack.generation.provider, 'Meta Model API');
    assert.deepEqual(saved.usage.map((row) => row.providerId), [
      'baseten-muse-spark-hackathon', 'baseten-muse-spark-hackathon', 'meta-model-api',
    ]);
    assert.equal(JSON.stringify(saved).includes('placeholder'), false);
    assert.deepEqual(errors, []);
    fs.writeFileSync(process.env.DD_QA_OUTPUT + '/recovery-tests.json', JSON.stringify({
      status: 'PASS',
      checks: [
        'Baseten creates selection and exercise drafts with its dedicated credential',
        'Meta model selection controls the single repair call and uses its own credential',
        'provider and model are recorded without retaining either key',
        'repaired lesson remains a draft and is not auto-approved',
      ],
      mockedProviderCalls: { baseten: basetenCalls, meta: metaCalls },
      metaModel,
      realProviderCalls: 0,
    }, null, 2));
    console.log('PASS Baseten creation and selectable Meta repair routing; 3 mocked calls, 0 real');
  } finally {
    await browser.close();
  }
})().catch((error) => { console.error(error); process.exit(1); });
