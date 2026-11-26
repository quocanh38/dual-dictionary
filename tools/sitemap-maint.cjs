#!/usr/bin/env node
/* Sitemap maintenance (owner-approved 02/11): truthful lastmod + tiered index.
 * Problem it fixes: every builder stamped <lastmod> = rebuild date, so Google
 * saw 11k+ pages "changed" on each deploy and wasted crawl budget rechecking
 * identical content. This script:
 *  1. Rewrites per-URL <lastmod> in every vi/tu/sitemap/*.xml from the file's
 *     REAL mtime (derived from the built HTML on disk, not today).
 *  2. Regenerates sitemap.xml as a TIERED index: Tier 1 (hubs/collections/
 *     SEO pages, priority signal via order + changefreq) first, bulk word/
 *     phrase chunks last, each with its newest contained lastmod.
 * Run AFTER all builders, BEFORE link-check. No deps. */
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..');
const SM_DIR = path.join(REPO, 'vi', 'tu', 'sitemap');
const SITE = 'https://hocta.app';

function fmt(d) { return new Date(d).toISOString().slice(0, 10); }
function mtime(p) { try { return fs.statSync(p).mtime; } catch (e) { return null; } }
/* Map a sitemap <loc> URL to its built HTML file on disk. */
function urlToFile(loc) {
  let rel = decodeURIComponent(loc.replace(SITE, '').replace(/^\/+/, ''));
  if (!rel) return path.join(REPO, 'index.html');
  const cands = [path.join(REPO, rel, 'index.html'), path.join(REPO, rel), path.join(REPO, rel + '.html')];
  for (const c of cands) { try { if (fs.statSync(c).isFile()) return c; } catch (e) {} }
  return null;
}

const TIER1 = ['collections.xml', 'viet-anh.xml', 'topics.xml', 'compare.xml', 'mistakes.xml', 'grammar.xml', 'prepositions.xml', 'collocations.xml', 'cambridge.xml', 'pronunciation.xml', 'synonyms.xml', 'exam-guides.xml'];
const TIER2 = ['words-ielts.xml', 'words-giao-tiep.xml', 'phrases-ielts.xml', 'phrases-toeic.xml'];

function isNoindexFile(hf) {
  if (!hf) return false;
  try {
    const head = fs.readFileSync(hf, 'utf8').slice(0, 4096);
    return /<meta\s+name=["']robots["'][^>]*content=["'][^"']*noindex/i.test(head);
  } catch (e) {
    return false;
  }
}

/* Seed seenUrls with sitemap-pages.xml so child sitemaps never duplicate core pages. */
const seenUrls = new Set();
const pagesXmlPath = path.join(REPO, 'sitemap-pages.xml');
if (fs.existsSync(pagesXmlPath)) {
  const pagesXml = fs.readFileSync(pagesXmlPath, 'utf8');
  for (const m of pagesXml.matchAll(/<loc>([^<]+)<\/loc>/g)) {
    seenUrls.add(m[1].trim());
  }
}

const allXml = fs.readdirSync(SM_DIR).filter((x) => x.endsWith('.xml'));
const tier3Files = allXml.filter((n) => !TIER1.includes(n) && !TIER2.includes(n)).sort();
const orderedFiles = [
  ...TIER1.filter((n) => allXml.includes(n)),
  ...TIER2.filter((n) => allXml.includes(n)),
  ...tier3Files,
];

let urlCount = 0, keptCount = 0, dedupedCount = 0, noindexCount = 0;
const tierInfo = {}; // xmlName -> { newest, count }

/* Pass 1: deduplicate in strict priority order (sitemap-pages -> Tier 1 -> Tier 2 -> Tier 3),
 * drop noindex pages, and stamp truthful per-URL <lastmod> from real file mtime. */
for (const f of orderedFiles) {
  const fp = path.join(SM_DIR, f);
  let xml = fs.readFileSync(fp, 'utf8');
  if (!/<urlset\b/.test(xml)) continue;
  let newest = 0, count = 0;
  xml = xml.replace(/[ \t]*<url>[\s\S]*?<\/url>[ \t]*\r?\n?/g, (block) => {
    const m = block.match(/<loc>([^<]+)<\/loc>/);
    if (!m) return block;
    const loc = m[1].trim();
    if (seenUrls.has(loc)) {
      dedupedCount++;
      return '';
    }
    const hf = urlToFile(loc);
    if (isNoindexFile(hf)) {
      noindexCount++;
      return '';
    }
    seenUrls.add(loc);
    const mt = hf ? mtime(hf) : null;
    count++; urlCount++;
    if (!mt) return block;
    newest = Math.max(newest, mt.getTime());
    keptCount++;
    if (/<lastmod>/.test(block)) return block.replace(/<lastmod>[^<]*<\/lastmod>/, `<lastmod>${fmt(mt)}</lastmod>`);
    return block.replace(/<\/loc>/, `</loc><lastmod>${fmt(mt)}</lastmod>`);
  });
  fs.writeFileSync(fp, xml);
  tierInfo[f] = { newest, count };
}

/* Pass 2: tiered sitemap.xml (omit sitemaps that became empty after deduplication). */
function entry(name) {
  const t = tierInfo[name];
  const lm = t && t.newest ? `\n    <lastmod>${fmt(t.newest)}</lastmod>` : '';
  return `  <sitemap>\n    <loc>${SITE}/vi/tu/sitemap/${name}</loc>${lm}\n  </sitemap>`;
}
const nonEmpty = (n) => tierInfo[n] && tierInfo[n].count > 0;
const t1Active = TIER1.filter(nonEmpty);
const t2Active = TIER2.filter(nonEmpty);
const t3Active = tier3Files.filter(nonEmpty);
const blocks = [
  '  <sitemap>\n    <loc>https://hocta.app/sitemap-pages.xml</loc>\n  </sitemap>',
  ...t1Active.map(entry),
  ...t2Active.map(entry),
  ...t3Active.map(entry),
];
fs.writeFileSync(path.join(REPO, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${blocks.join('\n')}\n</sitemapindex>\n`);
console.log(`SITEMAP-MAINT: ${urlCount} unique child urls truthful-lastmod (${keptCount} mapped), deduped ${dedupedCount}, dropped ${noindexCount} noindex, index tiered ${t1Active.length}T1/${t2Active.length}T2/${t3Active.length}T3`);
