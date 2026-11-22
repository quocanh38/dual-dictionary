#!/usr/bin/env node
'use strict';

/**
 * IndexNow URL submission script for hocta.app (Bing, Yandex, Seznam, Naver & AI Search / GEO).
 *
 * Usage:
 *   node tools/indexnow-submit.cjs --all                  # Submit all URLs from sitemap.xml (in batches of 10,000)
 *   node tools/indexnow-submit.cjs --changed [git-range]  # Submit HTML URLs changed in git diff (default: HEAD~1..HEAD)
 *   node tools/indexnow-submit.cjs --urls <u1> <u2> ...   # Submit explicit URLs
 *   node tools/indexnow-submit.cjs --all --dry-run        # Preview without sending HTTP requests
 *
 * Options:
 *   --dry-run             Print summary without calling api.indexnow.org
 *   --endpoint <url>      Override IndexNow endpoint (default: https://api.indexnow.org/indexnow)
 *   --batch-size <n>      URLs per POST request (default: 10000, max: 10000)
 *   --skip-key-check      Skip live HTTP verification of https://hocta.app/<key>.txt before posting
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const HOST = 'hocta.app';
const ORIGIN = `https://${HOST}`;
const DEFAULT_ENDPOINT = 'https://api.indexnow.org/indexnow';
const MAX_BATCH = 10000;

const EXCLUDED_PREFIXES = [
  'docs/',
  'tools/',
  'tests/',
  'node_modules/',
  '.github/',
  'netlify/',
  'recover.html',
  'lessons/recover.html',
];

function discoverKey() {
  if (process.env.INDEXNOW_KEY) {
    return process.env.INDEXNOW_KEY.trim();
  }
  const entries = fs.readdirSync(ROOT);
  for (const name of entries) {
    if (!/^[a-f0-9]{32}\.txt$/i.test(name)) continue;
    const expected = name.slice(0, -4);
    const content = fs.readFileSync(path.join(ROOT, name), 'utf8').trim();
    if (content === expected) {
      return expected;
    }
  }
  throw new Error('Could not find IndexNow <32-hex>.txt verification file in repository root.');
}

function extractLocs(xml) {
  const locs = [];
  const re = /<loc>\s*([^<\s]+)\s*<\/loc>/gi;
  let m;
  while ((m = re.exec(xml)) !== null) {
    locs.push(m[1].trim());
  }
  return locs;
}

function collectSitemapUrls(sitemapPath, visited = new Set()) {
  const abs = path.resolve(sitemapPath);
  if (visited.has(abs) || !fs.existsSync(abs)) return [];
  visited.add(abs);

  const xml = fs.readFileSync(abs, 'utf8');
  const locs = extractLocs(xml);

  if (/<sitemapindex\b/i.test(xml)) {
    const out = [];
    for (const loc of locs) {
      if (!loc.startsWith(`${ORIGIN}/`)) continue;
      const rel = decodeURIComponent(loc.slice(ORIGIN.length + 1));
      const childPath = path.join(ROOT, rel);
      out.push(...collectSitemapUrls(childPath, visited));
    }
    return out;
  }

  return locs.filter((u) => u.startsWith(`${ORIGIN}/`));
}

function relHtmlToCanonicalUrl(relPath) {
  const norm = relPath.replace(/\\/g, '/').replace(/^\/+/, '');
  if (!norm.endsWith('.html')) return null;
  for (const prefix of EXCLUDED_PREFIXES) {
    if (norm === prefix || norm.startsWith(prefix)) return null;
  }
  if (!fs.existsSync(path.join(ROOT, norm))) return null;

  if (norm === 'index.html') return `${ORIGIN}/`;
  if (norm.endsWith('/index.html')) {
    return `${ORIGIN}/${norm.slice(0, -'index.html'.length)}`;
  }
  return `${ORIGIN}/${norm}`;
}

function collectChangedUrls(range) {
  const gitRange = range || 'HEAD~1..HEAD';
  let stdout = '';
  try {
    stdout = execFileSync(
      'git',
      ['diff', '--name-only', '--diff-filter=ACMR', gitRange],
      { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }
    );
  } catch (err) {
    console.warn(`[indexnow] git diff (${gitRange}) unavailable (${err.message.trim()}); falling back to 0 changed URLs.`);
    return { urls: [], keyJustAdded: false };
  }

  const files = stdout.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
  const keyFile = `${discoverKey()}.txt`;
  const keyJustAdded = files.includes(keyFile);

  const urls = [];
  for (const file of files) {
    const url = relHtmlToCanonicalUrl(file);
    if (url) urls.push(url);
  }
  return { urls: Array.from(new Set(urls)), keyJustAdded };
}

async function verifyLiveKey(key) {
  const keyLocation = `${ORIGIN}/${key}.txt`;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const res = await fetch(keyLocation, { headers: { 'user-agent': 'hocta-indexnow-submit/1.0' } });
      const text = (await res.text()).trim();
      if (res.ok && text === key) {
        console.log(`[indexnow] Verified live key at ${keyLocation}`);
        return true;
      }
      console.warn(`[indexnow] Attempt ${attempt}/4: ${keyLocation} returned HTTP ${res.status}`);
    } catch (err) {
      console.warn(`[indexnow] Attempt ${attempt}/4: failed to fetch ${keyLocation}: ${err.message}`);
    }
    if (attempt < 4) {
      await new Promise((r) => setTimeout(r, 3000 * attempt));
    }
  }
  return false;
}

async function submitBatch(endpoint, key, urlList, batchIdx, totalBatches) {
  const payload = {
    host: HOST,
    key,
    keyLocation: `${ORIGIN}/${key}.txt`,
    urlList,
  };

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'User-Agent': 'hocta-indexnow-submit/1.0',
    },
    body: JSON.stringify(payload),
  });

  const body = await res.text();
  if (res.status === 200 || res.status === 202) {
    console.log(`[indexnow] Batch ${batchIdx}/${totalBatches} (${urlList.length} URLs) -> HTTP ${res.status} OK`);
    return true;
  }

  throw new Error(
    `Batch ${batchIdx}/${totalBatches} failed with HTTP ${res.status}: ${body.slice(0, 300)}`
  );
}

function parseArgs(argv) {
  const args = {
    mode: null,
    range: null,
    urls: [],
    dryRun: false,
    skipKeyCheck: false,
    endpoint: DEFAULT_ENDPOINT,
    batchSize: MAX_BATCH,
  };

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--all') {
      args.mode = 'all';
    } else if (a === '--changed') {
      args.mode = 'changed';
      if (argv[i + 1] && !argv[i + 1].startsWith('--')) {
        args.range = argv[++i];
      }
    } else if (a === '--urls') {
      args.mode = 'urls';
      while (argv[i + 1] && !argv[i + 1].startsWith('--')) {
        args.urls.push(argv[++i]);
      }
    } else if (a === '--dry-run') {
      args.dryRun = true;
    } else if (a === '--skip-key-check') {
      args.skipKeyCheck = true;
    } else if (a === '--endpoint' && argv[i + 1]) {
      args.endpoint = argv[++i];
    } else if (a === '--batch-size' && argv[i + 1]) {
      args.batchSize = Math.min(MAX_BATCH, Math.max(1, Number(argv[++i]) || MAX_BATCH));
    }
  }

  if (!args.mode) args.mode = 'changed';
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const key = discoverKey();
  let urls = [];

  if (args.mode === 'all') {
    urls = Array.from(new Set(collectSitemapUrls(path.join(ROOT, 'sitemap.xml'))));
  } else if (args.mode === 'changed') {
    const { urls: changed, keyJustAdded } = collectChangedUrls(args.range);
    if (keyJustAdded) {
      console.log('[indexnow] IndexNow key file was just added in this commit -> submitting full sitemap.');
      urls = Array.from(new Set(collectSitemapUrls(path.join(ROOT, 'sitemap.xml'))));
    } else {
      urls = changed;
    }
  } else if (args.mode === 'urls') {
    urls = Array.from(new Set(args.urls.filter((u) => u.startsWith(`${ORIGIN}/`))));
  }

  if (urls.length === 0) {
    console.log('[indexnow] No public URLs to submit. Exiting cleanly.');
    return;
  }

  const totalBatches = Math.ceil(urls.length / args.batchSize);
  console.log(
    `[indexnow] Key: ${key} | Mode: ${args.mode} | URLs: ${urls.length} | Batches: ${totalBatches}${args.dryRun ? ' (DRY RUN)' : ''}`
  );
  console.log(`[indexnow] Sample URLs: ${urls.slice(0, 5).join(', ')}`);

  if (args.dryRun) {
    return;
  }

  if (!args.skipKeyCheck) {
    const ok = await verifyLiveKey(key);
    if (!ok) {
      throw new Error(`Live key verification failed at ${ORIGIN}/${key}.txt — aborting submission.`);
    }
  }

  for (let i = 0; i < totalBatches; i++) {
    const chunk = urls.slice(i * args.batchSize, (i + 1) * args.batchSize);
    await submitBatch(args.endpoint, key, chunk, i + 1, totalBatches);
  }
  console.log(`[indexnow] Done. Submitted ${urls.length} URLs to ${args.endpoint}.`);
}

main().catch((err) => {
  console.error(`[indexnow] Error: ${err.message}`);
  process.exit(1);
});
