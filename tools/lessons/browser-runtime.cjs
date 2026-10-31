const fs = require('node:fs');
const path = require('node:path');

// CDP must point to a dedicated QA browser. Always create isolated contexts;
// never reuse or alter the browser's existing user context.
async function openBrowser(chromium, env = process.env) {
  const mode = env.DD_CDP_ENDPOINT ? 'cdp' : env.DD_BROWSER_HEADED === '1' ? 'headed' : 'headless';
  let browser;
  try {
    if (mode === 'cdp') {
      const url = new URL(env.DD_CDP_ENDPOINT);
      if (!['http:', 'https:', 'ws:', 'wss:'].includes(url.protocol) ||
          !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) || url.username || url.password) {
        throw new Error('CDP requires a loopback endpoint without credentials');
      }
      browser = await chromium.connectOverCDP(url.href);
    } else {
      browser = await chromium.launch({channel: 'chrome', headless: mode === 'headless'});
    }
  } catch (cause) {
    if (env.DD_QA_OUTPUT) {
      fs.mkdirSync(env.DD_QA_OUTPUT, {recursive: true});
      fs.writeFileSync(path.join(env.DD_QA_OUTPUT, 'browser-startup.json'), JSON.stringify({
        status: 'BLOCKED', mode, reason: 'Browser startup failed; no browser assertions ran.',
        fallback: 'Use DD_BROWSER_HEADED=1 or DD_CDP_ENDPOINT with a dedicated local QA Chrome; otherwise record manual Chrome UI evidence separately.'
      }, null, 2));
    }
    throw new Error(`Browser ${mode} startup failed; suite is BLOCKED, not PASS. Use headed Chrome or a dedicated loopback CDP browser.`, {cause});
  }
  if (env.DD_QA_OUTPUT) {
    fs.mkdirSync(env.DD_QA_OUTPUT, {recursive: true});
    fs.writeFileSync(path.join(env.DD_QA_OUTPUT, 'browser-startup.json'), JSON.stringify({
      status: 'STARTED', mode, note: 'Browser started; suite results are recorded separately.'
    }, null, 2));
  }
  const contexts = [];
  return {
    async newContext(options) {
      const context = await browser.newContext(options);
      contexts.push(context);
      return context;
    },
    async close() {
      try { for (const context of contexts) await context.close(); }
      finally { await browser.close(); } // CDP close disconnects this client.
    }
  };
}
function qaUrl(pathname, env = process.env) {
  const base = new URL(env.DD_QA_BASE_URL || 'http://127.0.0.1:8765');
  if (base.protocol !== 'http:' || !['localhost','127.0.0.1','[::1]'].includes(base.hostname) ||
      base.username || base.password || base.pathname !== '/' || base.search || base.hash) {
    throw new Error('QA base URL must be a loopback HTTP origin without credentials or a path');
  }
  const target = new URL(pathname, base);
  if (target.origin !== base.origin) throw new Error('QA navigation must stay on the local origin');
  return target.href;
}
module.exports = {openBrowser, qaUrl};
