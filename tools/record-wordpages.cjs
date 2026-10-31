#!/usr/bin/env node
// Append the word-pages batch-1 release row to docs/deployment.md (idempotent: skips if already present).
const fs = require('fs');
const path = require('path');
const f = path.join(__dirname, '..', 'docs', 'deployment.md');
let t = fs.readFileSync(f, 'utf8');
if (t.includes('Word pages batch 1')) {
  console.log('already recorded - skip');
  process.exit(0);
}
const anchor = '## Health-check procedure (every deploy)';
if (!t.includes(anchor)) { console.error('anchor not found'); process.exit(1); }
const row = `| Word pages batch 1 (DOL-style per-word landing pages) | 6abb80ec3014482454d13c36 | 2026-09-29 | **Per-word SEO pages: 2,000 most frequent English words each get a static page at /vi/tu/{word}/** (idea adopted from tudien.dolenglish.vn). Each page: headword + IPA (data/ipa-en.json) + part-of-speech + Vietnamese senses rendered from the OVDP mdx through the same mtd marker conventions as the app entry renderer (* pos, @ domain, - sense, ! idiom, (xem) crossrefs become real links), related-words chips (family match, freq-sorted, junk-filtered), CTA deep-link /?q={word} into the offline app, JSON-LD DefinedTerm + BreadcrumbList, canonical/og/twitter meta. Hub page /vi/tu/ lists all 2,000; main sitemap.xml became a sitemapindex (sitemap-pages.xml + vi/tu/sitemap/words-001.xml with 2,000 URLs). Generator: tools/build-word-pages.cjs (Node, reuses js/mdict.js; re-runnable; WORD_LIMIT env to scale batch 2+). vi/ landing and vi/blog/ hub link to the dictionary section. SW untouched: /vi/* already excluded from precache, pages served fresh. Total new HTML ≈ 9.8 MB. Git commit 42747e4 pushed to netlify git (5cd639d..42747e4). | ✔ live: /vi/tu/ 200, /vi/tu/thank/ 200 (IPA+POS+senses+related+CTA verified), sitemap index + chunk 2000 URLs 200, sitemap-pages 200, /vi/ links out. |
`;
t = t.replace(anchor, row + '\n' + anchor);
fs.writeFileSync(f, t);
console.log('deployment.md updated');
