#!/usr/bin/env node
/* Synonym/antonym pages (owner-approved 03/11): /vi/dong-nghia/{word}/
 * "Từ đồng nghĩa với {word} (+trái nghĩa)" + TL;DR 40-60 words + synonym links
 * (manifest-guarded, else /?q=) + antonyms + nuance + 2 EN-VI examples
 * + word-page link + hub + FAQ schema + Speakable. Owned by NO manifest: never wiped. */
const fs = require('fs');
const path = require('path');
const core = require('./build-word-pages.cjs');
const { navHtml } = require('./nav-partial.cjs');
const { blogLinksHtml } = require('./blog-links-lib.cjs');

const REPO = path.join(__dirname, '..');
const OUT_DIR = path.join(REPO, 'vi', 'dong-nghia');
const SITE = core.SITE;
const esc = core.escapeHtml;

function pageHtml(p, wordHref) {
  const canonical = `${SITE}/vi/dong-nghia/${p.word}/`;
  const h1 = `Từ đồng nghĩa với ${p.word}`;
  const synLinks = p.synonyms.map((s) => `<a class="related-chip" href="${wordHref(s)}">${esc(s)}</a>`).join('\n');
  const antLinks = p.antonyms.length
    ? p.antonyms.map((s) => `<a class="related-chip" href="${wordHref(s)}">${esc(s)}</a>`).join('\n')
    : '<p style="color:var(--muted)">Từ này là danh từ trừu tượng hoặc từ chức năng, không có trái nghĩa trực tiếp trong từ điển.</p>';
  const exRows = (p.examples || []).map(([en, vi]) =>
    `<li><span class="ex-en">${esc(en)}</span><br><span class="ex-vi">${esc(vi)}</span></li>`).join('\n');
  let nu = p.nuance;
  const wc = (s) => String(s).split(/\s+/).filter(Boolean).length;
  if (wc(nu) > 34) nu = nu.split(/\.\s/).slice(0, 2).join('. ').slice(0, 220);
  let tldr = `“${p.word}” có ${p.synonyms.length} từ đồng nghĩa phổ biến nhất là ${p.synonyms.slice(0, 3).join(', ')}${p.antonyms.length ? `; trái nghĩa thường gặp: ${p.antonyms.slice(0, 3).join(', ')}` : '; từ này không có trái nghĩa trực tiếp'}. ${nu}`;
  if (wc(tldr) < 40) tldr += ` Xem chi tiết từng từ đồng nghĩa, ví dụ song ngữ và cách phân biệt sắc thái trong bài.`;
  if (wc(tldr) > 60) tldr = tldr.split(/\s+/).slice(0, 60).join(' ') + '…';
  const desc = `${h1}${p.antonyms.length ? ' và trái nghĩa' : ''}: ${p.synonyms.slice(0, 4).join(', ')}. Phân biệt sắc thái + câu mẫu song ngữ EN–VI — Dual Dictionary.`.slice(0, 160);
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Article',
        headline: h1,
        description: desc,
        url: canonical,
        inLanguage: 'vi',
        about: { '@type': 'DefinedTerm', name: p.word, url: `${SITE}${wordHref(p.word)}` },
      },
      {
        '@type': 'WebPage',
        name: h1,
        url: canonical,
        inLanguage: 'vi',
        speakable: { '@type': 'SpeakableSpecification', cssSelector: ['.tldr'] },
      },
      {
        '@type': 'FAQPage',
        mainEntity: [
          {
            '@type': 'Question',
            name: `Từ đồng nghĩa với ${p.word} là gì?`,
            acceptedAnswer: { '@type': 'Answer', text: `Các từ đồng nghĩa phổ biến với “${p.word}”: ${p.synonyms.join(', ')}.` },
          },
          {
            '@type': 'Question',
            name: `Trái nghĩa với ${p.word} là gì?`,
            acceptedAnswer: { '@type': 'Answer', text: p.antonyms.length ? `Trái nghĩa thường gặp của “${p.word}”: ${p.antonyms.join(', ')}.` : `“${p.word}” không có trái nghĩa trực tiếp trong từ điển.` },
          },
          {
            '@type': 'Question',
            name: `Phân biệt ${p.word} với từ gần nghĩa?`,
            acceptedAnswer: { '@type': 'Answer', text: p.nuance },
          },
        ],
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Trang chủ', item: `${SITE}/vi/` },
          { '@type': 'ListItem', position: 2, name: 'Từ đồng nghĩa', item: `${SITE}/vi/dong-nghia/` },
          { '@type': 'ListItem', position: 3, name: p.word, item: canonical },
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
<title>${esc(h1)}${p.antonyms.length ? ' (kèm trái nghĩa)' : ''} | Dual Dictionary</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${canonical}">
<meta name="robots" content="index, follow">
<meta property="og:type" content="article">
<meta property="og:locale" content="vi_VN">
<meta property="og:site_name" content="Dual Dictionary">
<meta property="og:url" content="${canonical}">
<meta property="og:title" content="${esc(h1)}">
<meta property="og:description" content="${esc(desc)}">
<meta name="twitter:card" content="summary">
<meta name="twitter:title" content="${esc(h1)}">
<link rel="stylesheet" href="/vi/blog/blog.css">
<link rel="stylesheet" href="/vi/tu/word.css">
<style>.ex-en{font-weight:600}.ex-vi{color:var(--muted)}.tldr{background:var(--soft);border-left:4px solid var(--teal);border-radius:0 10px 10px 0;padding:12px 16px;font-size:1.02rem;line-height:1.7}</style>
<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
</head>
<body class="word-page">
${navHtml('dong-nghia')}
<nav class="breadcrumb" aria-label="Breadcrumb"><a href="/vi/">Trang chủ</a> › <a href="/vi/tu/">Từ điển</a> › <a href="/vi/dong-nghia/">Từ đồng nghĩa</a> › <span aria-current="page">${esc(p.word)}</span></nav>
<main class="page">
  <p class="word-kicker">Từ đồng nghĩa &amp; trái nghĩa</p>
  <h1 style="font-size:2.2rem">${esc(h1)}${p.antonyms.length ? ' (kèm trái nghĩa)' : ''}?</h1>
  <p class="tldr">${esc(tldr)}</p>
  <h2>Từ đồng nghĩa (${p.synonyms.length})</h2>
  <div class="cmp-links">
${synLinks}
  </div>
  <h2>Từ trái nghĩa${p.antonyms.length ? ` (${p.antonyms.length})` : ''}</h2>
  <div class="cmp-links">
${antLinks}
  </div>
  <h2>Phân biệt sắc thái</h2>
  <p>${esc(p.nuance)}</p>
  <h2>Câu mẫu</h2>
  <ul>
${exRows}
  </ul>
  <div class="cmp-links">
    <a class="related-chip" href="${wordHref(p.word)}">Tra “${esc(p.word)}” →</a>
    <a class="related-chip" href="/vi/dong-nghia/">Tất cả từ đồng nghĩa →</a>
  </div>
  ${blogLinksHtml(`/vi/dong-nghia/${p.slug}/`)}
</main>
<footer class="blog-footer"><p><a href="/vi/">Dual Dictionary</a> — từ điển &amp; công cụ học từ vựng offline-first cho người Việt.</p></footer>
</body>
</html>
`;
}

function main() {
  const data = JSON.parse(fs.readFileSync(path.join(REPO, 'data', 'synonyms.json'), 'utf8'));
  const pairs = data.pairs || [];
  let wordSlugs = new Set();
  try {
    const wm = JSON.parse(fs.readFileSync(path.join(REPO, 'docs', 'wordpages-manifest.json'), 'utf8'));
    for (const s of wm.slugs || []) wordSlugs.add(s);
  } catch (e) {}
  const wordHref = (w) => {
    const slug = String(w).toLowerCase();
    if (wordSlugs.has(slug)) return `/vi/tu/${encodeURIComponent(slug)}/`;
    return `/?q=${encodeURIComponent(w)}`;
  };
  fs.mkdirSync(OUT_DIR, { recursive: true });
  let deadLinks = 0;
  for (const p of pairs) {
    // Guard: every synonym/antonym must resolve to a manifest word page
    for (const s of [...p.synonyms, ...p.antonyms]) {
      if (!wordSlugs.has(String(s).toLowerCase())) { deadLinks++; }
    }
    const dir = path.join(OUT_DIR, p.word);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'index.html'), pageHtml(p, wordHref));
  }
  const rows = pairs.map((p) =>
    `    <li><a href="/vi/dong-nghia/${p.word}/">Từ đồng nghĩa với ${esc(p.word)} — ${esc(p.synonyms.slice(0, 4).join(', '))}</a></li>`).join('\n');
  const hubTitle = `${pairs.length} từ tiếng Anh + từ đồng nghĩa & trái nghĩa hay tra nhất`;
  const hubJsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'CollectionPage', name: hubTitle, url: `${SITE}/vi/dong-nghia/`, inLanguage: 'vi' },
      {
        '@type': 'ItemList',
        name: hubTitle,
        itemListElement: pairs.map((p, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          name: `Từ đồng nghĩa với ${p.word}`,
          url: `${SITE}/vi/dong-nghia/${p.word}/`,
        })),
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Trang chủ', item: `${SITE}/vi/` },
          { '@type': 'ListItem', position: 2, name: 'Đồng nghĩa' },
        ],
      },
    ],
  };
  fs.writeFileSync(path.join(OUT_DIR, 'index.html'), `<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="theme-color" content="#0f766e">
<title>${pairs.length} từ + từ đồng nghĩa &amp; trái nghĩa hay tra | Dual Dictionary</title>
<meta name="description" content="${pairs.length} từ tiếng Anh kèm từ đồng nghĩa, trái nghĩa, phân biệt sắc thái và câu mẫu song ngữ.">
<link rel="canonical" href="${SITE}/vi/dong-nghia/">
<meta name="robots" content="index, follow">
<meta property="og:type" content="website">
<meta property="og:locale" content="vi_VN">
<meta property="og:site_name" content="Dual Dictionary">
<meta property="og:url" content="${SITE}/vi/dong-nghia/">
<meta property="og:title" content="${pairs.length} từ + từ đồng nghĩa &amp; trái nghĩa hay tra | Dual Dictionary">
<meta name="twitter:card" content="summary">
<link rel="stylesheet" href="/vi/blog/blog.css">
<link rel="stylesheet" href="/vi/tu/word.css">
<script type="application/ld+json">${JSON.stringify(hubJsonLd)}</script>
</head>
<body class="word-page">
${navHtml('dong-nghia')}
<nav class="breadcrumb" aria-label="Breadcrumb"><a href="/vi/">Trang chủ</a> › <a href="/vi/tu/">Từ điển</a> › <span aria-current="page">Từ đồng nghĩa</span></nav>
<main class="page">
  <p class="word-kicker">Từ đồng nghĩa &amp; trái nghĩa</p>
  <h1 style="font-size:2.2rem">${pairs.length} từ + từ đồng nghĩa &amp; trái nghĩa hay tra</h1>
  <p style="color:var(--muted)">Mỗi từ 1 trang riêng: list đồng nghĩa link về trang từ, trái nghĩa, phân biệt sắc thái, câu mẫu song ngữ EN–VI. Tra không dấu vẫn ra đúng từ.</p>
  <ul class="hub-list" style="columns:2;gap:20px;padding-left:18px;line-height:2">
${rows}
  </ul>
</main>
<footer class="blog-footer"><p><a href="/vi/">Dual Dictionary</a> — từ điển &amp; công cụ học từ vựng offline-first cho người Việt.</p></footer>
</body>
</html>
`);
  const LM = new Date().toISOString().slice(0, 10);
  const urls = [`https://dualdictionary.netlify.app/vi/dong-nghia/`, ...pairs.map((p) => `https://dualdictionary.netlify.app/vi/dong-nghia/${p.word}/`)];
  fs.writeFileSync(path.join(REPO, 'vi', 'tu', 'sitemap', 'synonyms.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `  <url><loc>${u}</loc><lastmod>${LM}</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>`).join('\n')}\n</urlset>\n`);
  console.log(`SYNONYMS: ${pairs.length} pages + hub + sitemap (manifest-guard dead: ${deadLinks})`);
}

if (require.main === module) {
  main();
}
