#!/usr/bin/env node
/* coverage-smoke.js — v118 A1 health check (runbook sibling of live-smoke.js).
 * Opens PRODUCTION (or any baseUrl) ×3 attempts; every attempt must PASS:
 *   1. home loads clean (0 pageerror);
 *   2. Reader paste → the coverage card renders with a % + the status line
 *      carries "% known/% đã biết";
 *   3. classify stays inside the interactive budget (< 250ms on the sample);
 *   4. the 3-way highlight paints fresh-word spans; toggle OFF clears them.
 * Needs playwright-core (NODE_PATH or local node_modules) + system Chrome.
 * Run: node tools/coverage-smoke.js [baseUrl]
 */
const { chromium } = require('playwright-core');
const BASE = (process.argv[2] || 'https://dualdictionary.netlify.app').replace(/\/$/, '');

const SAMPLE = ('The quick brown fox jumps over the lazy dog. '.repeat(6) +
  'She said that they would come back home when the rain stopped falling over the quiet town. ' +
  'Beautiful cats are running along the long garden wall every single morning of the week. ').repeat(4);

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  let fail = 0;
  for (let attempt = 1; attempt <= 3; attempt++) {
    console.log(`== attempt ${attempt}/3`);
    fail = 0;
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    try {
      await page.goto(BASE + '/', { waitUntil: 'load', timeout: 30000 });
      await page.waitForTimeout(2500);
      await page.evaluate(() => { document.getElementById('onboarding-dialog')?.close(); localStorage.setItem('onboarded', '1'); });

      // 2–4: the reader coverage pass
      await page.goto(BASE + '/#/reader', { waitUntil: 'load', timeout: 30000 });
      await page.waitForTimeout(1000);
      await page.fill('#reader-input', SAMPLE);
      await page.click('#btn-reader-start');
      await page.waitForSelector('#cov-card:not(.hidden)', { timeout: 20000 });
      const cov = await page.evaluate(() => ({
        pct: document.querySelector('.cov-pct')?.textContent || '',
        status: document.getElementById('reader-msg')?.textContent || '',
        ms: Number(document.documentElement.dataset.covMs || 0),
        fresh: document.querySelectorAll('#reader-text .rw.cov-n').length,
      }));
      const t = (name, cond, extra) => { if (!cond) { fail++; console.log(`FAIL ${name}${extra ? ' — ' + extra : ''}`); } };
      t('cov pct rendered', /^\d+%$/.test(cov.pct), cov.pct);
      t('status line carries %', /%\s*(known|đã biết)/.test(cov.status), cov.status);
      t('classify < 250ms', cov.ms > 0 && cov.ms < 250, cov.ms + 'ms');
      t('fresh-word highlight painted', cov.fresh > 0, 'fresh=' + cov.fresh);
      await page.evaluate(() => document.getElementById('btn-cov-hl').click());
      await page.waitForTimeout(300);
      const off = await page.evaluate(() => document.querySelectorAll('#reader-text .rw.cov-k, #reader-text .rw.cov-l, #reader-text .rw.cov-n').length);
      t('toggle off clears classes', off === 0, 'left=' + off);
      t('0 pageerror', errors.length === 0, errors.join(' | '));
      if (fail === 0) console.log('ALL PASS (attempt ' + attempt + ')');
    } catch (e) {
      fail++;
      console.log('FAIL attempt crashed —', String(e).slice(0, 200));
    }
    await ctx.close();
    if (fail > 0) { console.log(`attempt ${attempt} FAILED`); break; }
  }
  await browser.close();
  process.exit(fail === 0 ? 0 : 1);
})().catch((e) => { console.error('coverage-smoke crashed:', e); process.exit(1); });
