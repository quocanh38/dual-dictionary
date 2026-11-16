#!/usr/bin/env node
/* Inject BlogPosting+BreadcrumbList+HowTo JSON-LD into hand-written blog posts (07/11).
 * - Article: headline/description/author/datePublished from existing meta
 * - HowTo: steps from H2 headings (how-to intent posts)
 * - BreadcrumbList: Trang chủ > Blog > {cat} > {post}
 * Idempotent: skips files already containing article or collection metadata.
 */
const fs = require('fs'), path = require('path');
const REPO = path.join(__dirname, '..');
const SITE = 'https://dualdictionary.netlify.app';
const BLOG = path.join(REPO, 'vi', 'blog');

function* walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    if (e.name === 'images' || e.name.startsWith('.')) continue;
    const p = path.join(d, e.name);
    if (e.isDirectory()) yield* walk(p);
    else if (e.name === 'index.html' && p !== path.join(BLOG, 'index.html')) yield p;
  }
}
const esc = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;');
let done = 0, skipped = 0;
for (const f of walk(BLOG)) {
  let h = fs.readFileSync(f, 'utf8');
  if (/"@type"\s*:\s*"(?:Article|BlogPosting|CollectionPage)"/.test(h)) { skipped++; continue; }
  const rel = path.relative(REPO, f).replace(/\\/g, '/').replace(/\/index\.html$/, '/');
  const url = `${SITE}/${rel}`;
  const parts = rel.split('/');
  const cat = parts[2] || 'blog';
  const mTitle = h.match(/<title>(.*?)<\/title>/s);
  const mDesc = h.match(/<meta name="description" content="([^"]*)"/);
  const mPub = h.match(/article:published_time"[^>]*content="([^"]+)"/) || h.match(/published_time[^>]*content="([^"]+)"/);
  const mMod = h.match(/article:modified_time"[^>]*content="([^"]+)"/);
  const lang = h.match(/<html[^>]*lang="([^"]+)"/i)?.[1] || 'vi';
  const title = (mTitle ? mTitle[1] : '').replace(/<[^>]+>/g, '').trim();
  const desc = (mDesc ? mDesc[1] : '').trim();
  const pub = mPub?.[1];
  const h2s = [...h.matchAll(/<h2[^>]*>(.*?)<\/h2>/gs)].map((m) => m[1].replace(/<[^>]+>/g, '').trim()).filter(Boolean).slice(0, 8);
  const catName = { ielts: 'IELTS', toeic: 'TOEIC', 'phuong-phap': 'Phương pháp', en: 'English' }[cat] || cat;
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BlogPosting',
        headline: title, description: desc, url, inLanguage: lang,
        author: { '@type': 'Person', '@id': `${SITE}/vi/tac-gia/#person`, name: 'Nguyễn Quốc Anh', url: `${SITE}/vi/tac-gia/` },
        publisher: { '@type': 'Organization', '@id': `${SITE}/#organization`, name: 'Dual Dictionary', url: `${SITE}/`, sameAs: ['https://github.com/quocanh38/dual-dictionary'] },
        datePublished: pub, dateModified: mMod?.[1] || pub,
        mainEntityOfPage: url,
      },
      ...(h2s.length >= 3 ? [{
        '@type': 'HowTo', name: title, description: desc, inLanguage: lang,
        step: h2s.map((s) => ({ '@type': 'HowToStep', name: s })),
      }] : []),
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Trang chủ', item: `${SITE}/vi/` },
          { '@type': 'ListItem', position: 2, name: 'Blog', item: `${SITE}/vi/blog/` },
          ...(parts[3] ? [
            { '@type': 'ListItem', position: 3, name: catName, item: `${SITE}/vi/blog/${cat}/` },
            { '@type': 'ListItem', position: 4, name: title },
          ] : [{ '@type': 'ListItem', position: 3, name: title }]),
        ],
      },
    ],
  };
  const tag = `<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>`;
  if (h.includes('</head>')) h = h.replace('</head>', `  ${tag}\n</head>`);
  else continue;
  fs.writeFileSync(f, h);
  done++;
}
console.log(`BLOG-SCHEMA: injected ${done}, skipped ${skipped}`);
