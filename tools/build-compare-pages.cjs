#!/usr/bin/env node
/* Comparison pages (owner-approved 01/11): /vi/phan-biet/{a}-vs-{b}/
 * Hand-written distinguish content (data/comparisons.json). Each page:
 * H1 + diff table + right/wrong sentences + FAQ schema + 2-way links.
 * Owned by NO manifest (like cum-tu/collections): never wiped.
 * Run AFTER word+phrase builders. */
const fs = require('fs');
const path = require('path');
const core = require('./build-word-pages.cjs');

const REPO = path.join(__dirname, '..');
const OUT_DIR = path.join(REPO, 'vi', 'phan-biet');
const SITE = core.SITE;
const esc = core.escapeHtml;

function slugOf(s) {
  return String(s).normalize('NFC').toLowerCase().replace(/[^a-z0-9'\s-]/g, '').replace(/\s+/g, '-');
}/* P2 compare-link guard: only link terms that HAVE a built page (word manifest
 * or phrase manifest); others fall back to the app search deep-link. */
let BUILT_TERMS = null;
function builtTerms() {
  if (BUILT_TERMS === null) {
    BUILT_TERMS = new Set();
    try {
      const wm = JSON.parse(fs.readFileSync(path.join(REPO, 'docs', 'wordpages-manifest.json'), 'utf8'));
      for (const s of wm.slugs || []) BUILT_TERMS.add(s);
    } catch (e) {}
    try {
      const pm = JSON.parse(fs.readFileSync(path.join(REPO, 'docs', 'phrasepages-manifest.json'), 'utf8'));
      for (const e of pm.entries || []) BUILT_TERMS.add(e.slug);
    } catch (e) {}
  }
  return BUILT_TERMS;
}
function termHref(t) {
  const slug = slugOf(t);
  if (builtTerms().has(slug)) return `/vi/tu/${encodeURIComponent(slug)}/`;
  return `/?q=${encodeURIComponent(t)}`;
}

function pageHtml(p) {
  const slug = `${slugOf(p.a)}-vs-${slugOf(p.b)}`;
  const canonical = `${SITE}/vi/phan-biet/${slug}/`;
  const h1 = `Phân biệt ${p.a} và ${p.b}`;
  const desc = `${p.a} khác ${p.b} thế nào? ${p.diff} Câu đúng/sai, cách dùng IELTS/TOEIC — Dual Dictionary.`.slice(0, 160);
  const wrongRows = (p.wrong || []).map((w) =>
    `<li class="cmp-wrong">✗ <s>${esc(w)}</s> — đừng nói thế này</li>`).join('\n');
  const rightRows = (p.right || []).map((r) =>
    `<li class="cmp-right">✓ ${esc(r)}</li>`).join('\n');
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Article',
        headline: h1,
        description: desc,
        url: canonical,
        inLanguage: 'vi',
        about: [
          { '@type': 'DefinedTerm', name: p.a, url: `${SITE}${termHref(p.a)}` },
          { '@type': 'DefinedTerm', name: p.b, url: `${SITE}${termHref(p.b)}` },
        ],
      },
      {
        '@type': 'FAQPage',
        mainEntity: [
          {
            '@type': 'Question',
            name: `${p.a} và ${p.b} khác nhau thế nào?`,
            acceptedAnswer: { '@type': 'Answer', text: p.diff },
          },
          {
            '@type': 'Question',
            name: `Lỗi sai thường gặp giữa ${p.a} và ${p.b}?`,
            acceptedAnswer: { '@type': 'Answer', text: (p.wrong && p.wrong.length ? `Đừng nói: ${p.wrong.join('; ')}.` : `Hai từ dễ nhầm — xem câu đúng bên dưới.`) },
          },
        ],
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Trang chủ', item: `${SITE}/vi/` },
          { '@type': 'ListItem', position: 2, name: 'Phân biệt', item: `${SITE}/vi/phan-biet/` },
          { '@type': 'ListItem', position: 3, name: `${p.a} / ${p.b}`, item: canonical },
        ],
      },
    ],
  };
  return `<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="theme-color" content="#0f766e">
<title>${esc(h1)} — cách dùng đúng | Dual Dictionary</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${canonical}">
<meta name="robots" content="index, follow">
<meta property="og:type" content="article">
<meta property="og:locale" content="vi_VN">
<meta property="og:site_name" content="Dual Dictionary">
<meta property="og:url" content="${canonical}">
<meta property="og:title" content="${esc(h1)}">
<meta property="og:description" content="${esc(desc)}">
<link rel="stylesheet" href="/vi/blog/blog.css">
<link rel="stylesheet" href="/vi/tu/word.css">
<style>.cmp-table{width:100%;border-collapse:collapse;margin:14px 0}.cmp-table th,.cmp-table td{border:1px solid var(--line);padding:10px 14px;text-align:left;vertical-align:top}.cmp-table th{background:var(--soft)}.cmp-wrong{color:#991b1b}.cmp-right{color:#065f46}.cmp-links{display:flex;gap:10px;flex-wrap:wrap;margin:14px 0}</style>
<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
</head>
<body class="word-page">
<nav class="breadcrumb" aria-label="Breadcrumb"><a href="/vi/">Trang chủ</a> › <a href="/vi/tu/">Từ điển</a> › <a href="/vi/phan-biet/">Phân biệt</a> › <span aria-current="page">${esc(p.a)} / ${esc(p.b)}</span></nav>
<main class="page">
  <p class="word-kicker">Phân biệt từ dễ nhầm</p>
  <h1 style="font-size:2.2rem">${esc(h1)}</h1>
  <table class="cmp-table">
    <tr><th style="width:28%">Từ</th><th>Điểm khác biệt</th></tr>
    <tr><td><b>${esc(p.a)}</b></td><td rowspan="2">${esc(p.diff)}</td></tr>
    <tr><td><b>${esc(p.b)}</b></td></tr>
  </table>
  ${wrongRows ? `<h2>Lỗi sai thường gặp</h2>\n  <ul>\n${wrongRows}\n  </ul>` : ''}
  <h2>Câu đúng</h2>
  <ul>
${rightRows}
  </ul>
  <div class="cmp-links">
    <a class="related-chip" href="${termHref(p.a)}">Tra “${esc(p.a)}” →</a>
    <a class="related-chip" href="${termHref(p.b)}">Tra “${esc(p.b)}” →</a>
    <a class="related-chip" href="/vi/phan-biet/">Tất cả phân biệt →</a>
  </div>
</main>
<footer class="blog-footer"><p><a href="/vi/">Dual Dictionary</a> — từ điển &amp; công cụ học từ vựng offline-first cho người Việt.</p></footer>
</body>
</html>
`;
}

function hubHtml(pairs) {
  const rows = pairs.map((p) => {
    const slug = `${slugOf(p.a)}-vs-${slugOf(p.b)}`;
    return `    <li data-word="${esc(slug)}"><a href="/vi/phan-biet/${slug}/">Phân biệt ${esc(p.a)} và ${esc(p.b)}</a></li>`;
  }).join('\n');
  return `<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="theme-color" content="#0f766e">
<title>Phân biệt từ dễ nhầm — 30 cặp IELTS/TOEIC | Dual Dictionary</title>
<meta name="description" content="30 cặp từ dễ nhầm (evidence/proof, affect/effect, balance sheet/income statement…) kèm câu đúng/sai và cách dùng IELTS/TOEIC.">
<link rel="canonical" href="${SITE}/vi/phan-biet/">
<meta name="robots" content="index, follow">
<link rel="stylesheet" href="/vi/blog/blog.css">
<link rel="stylesheet" href="/vi/tu/word.css">
</head>
<body class="word-page">
<nav class="breadcrumb" aria-label="Breadcrumb"><a href="/vi/">Trang chủ</a> › <a href="/vi/tu/">Từ điển</a> › <span aria-current="page">Phân biệt</span></nav>
<main class="page">
  <p class="word-kicker">Từ dễ nhầm</p>
  <h1 style="font-size:2.2rem">Phân biệt ${pairs.length} cặp từ dễ nhầm</h1>
  <p style="color:var(--muted)">Mỗi cặp 1 trang riêng: điểm khác biệt, lỗi sai thường gặp, câu đúng dùng được trong IELTS/TOEIC.</p>
  <ul class="hub-list" style="columns:2;gap:20px;padding-left:18px;line-height:2">
${rows}
  </ul>
</main>
<footer class="blog-footer"><p><a href="/vi/">Dual Dictionary</a> — từ điển &amp; công cụ học từ vựng offline-first cho người Việt.</p></footer>
</body>
</html>
`;
}

function main() {
  const data = JSON.parse(fs.readFileSync(path.join(REPO, 'data', 'comparisons.json'), 'utf8'));
  const pairs = data.pairs || [];
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const slugs = [];
  for (const p of pairs) {
    const slug = `${slugOf(p.a)}-vs-${slugOf(p.b)}`;
    slugs.push(slug);
    fs.writeFileSync(path.join(OUT_DIR, `${slug}.html`), pageHtml(p));
    // pretty URL: /vi/phan-biet/{slug}/ via dir + index
    const dir = path.join(OUT_DIR, slug);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'index.html'), pageHtml(p));
  }
  fs.writeFileSync(path.join(OUT_DIR, 'index.html'), hubHtml(pairs));
  // sitemap
  const LM = new Date().toISOString().slice(0, 10);
  const urls = [`https://dualdictionary.netlify.app/vi/phan-biet/`, ...slugs.map((s) => `https://dualdictionary.netlify.app/vi/phan-biet/${s}/`)];
  fs.writeFileSync(path.join(REPO, 'vi', 'tu', 'sitemap', 'compare.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `  <url><loc>${u}</loc><lastmod>${LM}</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>`).join('\n')}\n</urlset>\n`);
  console.log(`COMPARE: ${pairs.length} pages + hub + sitemap`);
}

if (require.main === module) {
  main();
}
