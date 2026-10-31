#!/usr/bin/env node
/* Audit a hand-written phrase batch against its corpus, built pages, manifest,
 * sitemap and inbound internal links. Read-only; does not rebuild or edit pages.
 *
 * Usage:
 *   node tools/audit-phrase-batch.cjs --from 146 --to 178
 *   node tools/audit-phrase-batch.cjs --batch 146-178
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const REPO = path.resolve(__dirname, '..');
const SITE = 'https://dualdictionary.netlify.app';
const args = process.argv.slice(2);
function arg(name) {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
}

function parseRange() {
  const batch = arg('--batch');
  if (batch) {
    const m = /^(\d+)-(\d+)$/.exec(batch);
    if (!m) throw new Error('--batch must use FROM-TO, for example 146-178');
    return [Number(m[1]), Number(m[2])];
  }
  const from = Number(arg('--from'));
  const to = Number(arg('--to'));
  if (!Number.isInteger(from) || !Number.isInteger(to)) {
    throw new Error('Specify --from N --to N or --batch N-N');
  }
  return [from, to];
}

// Keep this in sync with phraseSlug() in build-phrase-pages.cjs.
function phraseSlug(phrase) {
  return String(phrase).normalize('NFC').toLowerCase()
    .replace(/[^a-z0-9'’\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/[\/\\:*?"<>|]/g, '-')
    .replace(/\.{2,}/g, '.')
    .replace(/\.+$/, '');
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(path.join(REPO, file), 'utf8'));
}

function htmlText(value) {
  return value.replace(/<[^>]*>/g, '')
    .replace(/&amp;/gi, '&').replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'").replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>').replace(/&nbsp;/gi, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/\s+/g, ' ').trim();
}

function phraseEntries(from, to) {
  const entries = [];
  for (let n = from; n <= to; n++) {
    const file = path.join(REPO, 'data', 'vi-phrase-defs', `vi-phrase-defs-${n}.json`);
    if (!fs.existsSync(file)) throw new Error(`Missing corpus file: ${path.relative(REPO, file)}`);
    const rows = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!Array.isArray(rows)) throw new Error(`${path.basename(file)} must contain a JSON array`);
    for (const row of rows) entries.push({ ...row, batch: n });
  }
  return entries;
}

function sitemapUrls() {
  const indexPath = path.join(REPO, 'vi', 'tu', 'sitemap', 'phrases-index.xml');
  const index = fs.readFileSync(indexPath, 'utf8');
  const urls = new Set();
  const chunkPaths = [...index.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => {
    const u = new URL(m[1]);
    return path.join(REPO, decodeURIComponent(u.pathname.replace(/^\//, '')));
  });
  if (!chunkPaths.length) throw new Error('Phrase sitemap index has no chunk URLs');
  for (const file of chunkPaths) {
    if (!fs.existsSync(file)) throw new Error(`Sitemap chunk is missing: ${path.relative(REPO, file)}`);
    const xml = fs.readFileSync(file, 'utf8');
    for (const m of xml.matchAll(/<loc>(.*?)<\/loc>/g)) urls.add(new URL(m[1]).pathname);
  }
  return urls;
}

function htmlFiles() {
  const r = spawnSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '--', '*.html'], {
    cwd: REPO, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
  });
  if (r.error || r.status !== 0) throw new Error(r.error?.message || r.stderr || 'git ls-files failed');
  return [...new Set(r.stdout.split(/\r?\n/).filter(Boolean))];
}

function countInbound(targets) {
  const refs = new Map([...targets].map((slug) => [
    `/vi/tu/${slug}/`, { count: 0, sources: new Set() },
  ]));
  const hrefRe = /\bhref\s*=\s*(["'])(.*?)\1/gi;
  let scannedPages = 0;
  for (const rel of htmlFiles()) {
    const full = path.join(REPO, rel);
    let html;
    try { html = fs.readFileSync(full, 'utf8'); } catch { continue; }
    scannedPages++;
    const sourcePath = '/' + rel.replace(/\\/g, '/').replace(/\/index\.html$/i, '/');
    const base = new URL(sourcePath.endsWith('/') ? sourcePath : sourcePath + '/', SITE);
    let m;
    while ((m = hrefRe.exec(html))) {
      const href = m[2].replace(/&amp;/g, '&').trim();
      let u;
      try { u = new URL(href, base); } catch { continue; }
      if (u.origin !== SITE || u.pathname === sourcePath) continue;
      const key = u.pathname.endsWith('/') ? u.pathname : u.pathname + '/';
      const target = refs.get(key);
      if (target) {
        target.count++;
        target.sources.add(rel.replace(/\\/g, '/'));
      }
    }
    hrefRe.lastIndex = 0;
  }
  return { refs, scannedPages };
}

function main() {
  const [from, to] = parseRange();
  if (from < 1 || to < from) throw new Error('Batch range must be positive and FROM <= TO');
  const entries = phraseEntries(from, to);
  const manifest = readJson('docs/phrasepages-manifest.json');
  const manifestEntries = new Map((manifest.entries || []).map((row) => [row.slug, row]));
  const sitemap = sitemapUrls();
  const issues = [];
  const targets = new Set();
  let dataReady = 0, pagesFound = 0, manifestHand = 0, sitemapFound = 0;
  let canonicalOk = 0, h1Ok = 0, renderedExamplesOk = 0;

  for (const entry of entries) {
    const phrase = String(entry.phrase || '').trim();
    const slug = phraseSlug(phrase);
    if (!phrase || !slug) { issues.push(`batch ${entry.batch}: empty phrase/slug`); continue; }
    if (targets.has(slug)) issues.push(`${slug}: duplicate slug in selected corpus batches`);
    targets.add(slug);

    const senses = Array.isArray(entry.senses) ? entry.senses : [];
    const sourcePairs = senses.flatMap((sense) => Array.isArray(sense.ex) ? sense.ex : [])
      .filter((pair) => Array.isArray(pair) && pair.length >= 2 && pair[0] && pair[1]);
    const contentOk = Boolean(entry.note && senses.length && senses.every((sense) => sense.m && sense.pat) && sourcePairs.length >= 2);
    if (contentOk) dataReady++;
    else issues.push(`${slug}: corpus needs note, senses with meaning/pattern, and >=2 complete bilingual examples`);

    const relPage = `vi/tu/${slug}/index.html`;
    const file = path.join(REPO, relPage);
    if (!fs.existsSync(file)) { issues.push(`${slug}: built page is missing`); continue; }
    pagesFound++;
    const html = fs.readFileSync(file, 'utf8');
    const manifestEntry = manifestEntries.get(slug);
    if (manifestEntry && manifestEntry.hand === true) manifestHand++;
    else issues.push(`${slug}: manifest does not mark page hand-written`);

    const urlPath = `/vi/tu/${slug}/`;
    if (sitemap.has(urlPath)) sitemapFound++;
    else issues.push(`${slug}: URL is missing from phrase sitemap`);

    const canonical = /<link\s+rel=["']canonical["']\s+href=["']([^"']+)["']/i.exec(html)?.[1];
    if (canonical === SITE + urlPath) canonicalOk++;
    else issues.push(`${slug}: canonical is missing or not self-referencing`);

    const titleCount = [...html.matchAll(/<title\b[^>]*>[\s\S]*?<\/title>/gi)].length;
    const h1s = [...html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)];
    if (titleCount === 1 && h1s.length === 1 && htmlText(h1s[0][1]).toLowerCase() === phrase.toLowerCase()) h1Ok++;
    else issues.push(`${slug}: expected one title and one H1 matching the phrase`);

    const enExamples = [...html.matchAll(/class=["']mtd-ex-en["']/g)].length;
    const viExamples = [...html.matchAll(/class=["']mtd-ex-vi["']/g)].length;
    if (enExamples >= sourcePairs.length && viExamples >= sourcePairs.length) renderedExamplesOk++;
    else issues.push(`${slug}: rendered bilingual examples (${enExamples} EN/${viExamples} VI) do not cover ${sourcePairs.length} corpus pairs`);
  }

  const { refs, scannedPages } = countInbound(targets);
  let inboundCovered = 0, inboundTotal = 0, minInbound = Infinity, maxInbound = 0;
  const uniqueSources = new Set();
  for (const [slug, ref] of refs) {
    if (ref.count > 0) inboundCovered++;
    else issues.push(`${slug}: no inbound internal link from another HTML page`);
    inboundTotal += ref.count;
    minInbound = Math.min(minInbound, ref.count);
    maxInbound = Math.max(maxInbound, ref.count);
    for (const source of ref.sources) uniqueSources.add(source);
  }

  const n = targets.size;
  console.log(`Phrase batch audit: ${from}-${to}`);
  console.log(`Corpus entries: ${entries.length} · unique pages: ${n} · HTML scanned: ${scannedPages}`);
  console.log(`Content ready: ${dataReady}/${n} · page: ${pagesFound}/${n} · hand manifest: ${manifestHand}/${n} · sitemap: ${sitemapFound}/${n}`);
  console.log(`Canonical: ${canonicalOk}/${pagesFound} · title/H1: ${h1Ok}/${pagesFound} · bilingual examples: ${renderedExamplesOk}/${pagesFound}`);
  console.log(`Inbound links: ${inboundCovered}/${n} pages · ${inboundTotal} links · ${uniqueSources.size} source pages · per-page ${n ? `${minInbound}-${maxInbound}` : 'n/a'}`);
  if (issues.length) {
    console.log(`ISSUES: ${issues.length}`);
    for (const issue of issues.slice(0, 50)) console.log(`- ${issue}`);
    if (issues.length > 50) console.log(`… ${issues.length - 50} additional issues`);
    process.exitCode = 1;
  } else {
    console.log('ALL CHECKS PASS');
  }
}

try { main(); } catch (error) { console.error(`AUDIT FAILED: ${error.message}`); process.exitCode = 1; }
