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
const SITE = 'https://dualdictionary.netlify.app';

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

let urlCount = 0, keptCount = 0;
const tierInfo = {}; // xmlName -> { newest, count }

/* Pass 1: per-URL lastmod from real file mtime (chunk + topical sitemaps). */
for (const f of fs.readdirSync(SM_DIR).filter((x) => x.endsWith('.xml') && x !== 'index.xml' && x !== 'phrases-index.xml')) {
  const fp = path.join(SM_DIR, f);
  let xml = fs.readFileSync(fp, 'utf8');
  let newest = 0, count = 0;
  xml = xml.replace(/<url>[\s\S]*?<\/url>/g, (block) => {
    const m = block.match(/<loc>([^<]+)<\/loc>/);
    if (!m) return block;
    const hf = urlToFile(m[1]);
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

/* Pass 2: tiered sitemap.xml. Tier 1 = crawl-priority (hubs, collections, SEO
 * clusters, topics). Tier 2 = topical tag sitemaps. Tier 3 = bulk chunks. */
const TIER1 = ['collections.xml', 'topics.xml', 'compare.xml', 'mistakes.xml', 'prepositions.xml', 'collocations.xml', 'cambridge.xml', 'pronunciation.xml', 'synonyms.xml'];
const TIER2 = ['words-ielts.xml', 'words-giao-tiep.xml', 'phrases-ielts.xml', 'phrases-toeic.xml'];
function entry(name) {
  const t = tierInfo[name];
  const lm = t && t.newest ? `\n    <lastmod>${fmt(t.newest)}</lastmod>` : '';
  return `  <sitemap>\n    <loc>${SITE}/vi/tu/sitemap/${name}</loc>${lm}\n  </sitemap>`;
}
const tier3 = Object.keys(tierInfo).filter((n) => !TIER1.includes(n) && !TIER2.includes(n)).sort();
const blocks = [
  '  <sitemap>\n    <loc>https://dualdictionary.netlify.app/sitemap-pages.xml</loc>\n  </sitemap>',
  '  <sitemap>\n    <loc>https://dualdictionary.netlify.app/vi/tu/sitemap/index.xml</loc>\n  </sitemap>',
  '  <sitemap>\n    <loc>https://dualdictionary.netlify.app/vi/tu/sitemap/phrases-index.xml</loc>\n  </sitemap>',
  ...TIER1.filter((n) => tierInfo[n]).map(entry),
  ...TIER2.filter((n) => tierInfo[n]).map(entry),
  ...tier3.map(entry),
];
fs.writeFileSync(path.join(REPO, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${blocks.join('\n')}\n</sitemapindex>\n`);
console.log(`SITEMAP-MAINT: ${urlCount} urls truthful-lastmod (${keptCount} mapped), index tiered ${TIER1.length}T1/${TIER2.length}T2/${tier3.length}T3`);
