#!/usr/bin/env node
/* Preposition pages (owner-approved 02/11): /vi/gioi-tu/{slug}/
 * "{Word} đi với giới từ gì?" + 1-line answer (tldr, snippet-quotable) + explain
 * + 2-3 hand-written EN examples with VI translation + mistake cross-link
 * + word-page link (manifest guard, else /?q=) + hub link + FAQ schema.
 * Owned by NO manifest: never wiped. */
const fs = require('fs');
const path = require('path');
const core = require('./build-word-pages.cjs');
const { navHtml } = require('./nav-partial.cjs');

const REPO = path.join(__dirname, '..');
const OUT_DIR = path.join(REPO, 'vi', 'gioi-tu');
const SITE = core.SITE;
const esc = core.escapeHtml;

function pageHtml(p, wordHref, slugToHead) {
  const canonical = `${SITE}/vi/gioi-tu/${p.slug}/`;
  const h1 = `${p.head} đi với giới từ gì?`;
  const desc = `${p.answer} Giải thích + câu mẫu song ngữ EN–VI — Dual Dictionary.`.slice(0, 160);
  const exRows = (p.examples || []).map(([en, vi]) =>
    `<li><span class="ex-en">${esc(en)}</span><br><span class="ex-vi">${esc(vi)}</span></li>`).join('\n');
  const mistakeHtml = p.mistakeSlug
    ? `<h2>Lỗi sai thường gặp</h2>\n  <p>Nhiều người viết sai cụm này — xem phân tích: <a href="/vi/loi-sai/${p.mistakeSlug}/">lỗi sai thường gặp →</a></p>`
    : '';
  const relatedHtml = (p.related || []).length
    ? `<p>Dễ nhầm: ${p.related.map((s) => `<a class="related-chip" href="/vi/gioi-tu/${s}/">${esc(slugToHead[s] || s)} →</a>`).join(' ')}</p>`
    : '';
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Article',
        headline: h1,
        description: desc,
        url: canonical,
        inLanguage: 'vi',
        about: { '@type': 'DefinedTerm', name: p.head, url: `${SITE}${wordHref(p.linkWord)}` },
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
            name: `${p.head} đi với giới từ gì?`,
            acceptedAnswer: { '@type': 'Answer', text: p.answer },
          },
          {
            '@type': 'Question',
            name: `Đặt câu với ${p.head} đúng giới từ?`,
            acceptedAnswer: { '@type': 'Answer', text: (p.examples || []).map(([en]) => en).join(' ') },
          },
        ],
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Trang chủ', item: `${SITE}/vi/` },
          { '@type': 'ListItem', position: 2, name: 'Giới từ', item: `${SITE}/vi/gioi-tu/` },
          { '@type': 'ListItem', position: 3, name: p.head, item: canonical },
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
<title>${esc(h1)} | Dual Dictionary</title>
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
<style>.ex-en{font-weight:600}.ex-vi{color:var(--muted)}.tldr{background:var(--soft);border-left:4px solid var(--teal);border-radius:0 10px 10px 0;padding:12px 16px;font-size:1.02rem;line-height:1.7}</style>
<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
</head>
<body class="word-page">
${navHtml('gioi-tu')}
<nav class="breadcrumb" aria-label="Breadcrumb"><a href="/vi/">Trang chủ</a> › <a href="/vi/tu/">Từ điển</a> › <a href="/vi/gioi-tu/">Giới từ</a> › <span aria-current="page">${esc(p.head)}</span></nav>
<main class="page">
  <p class="word-kicker">Giới từ đi kèm</p>
  <h1 style="font-size:2.2rem">${esc(p.head)} đi với giới từ gì?</h1>
  <p class="tldr"><strong>${esc(p.answer)}</strong></p>
  <p>${esc(p.explain)}</p>
  <h2>Câu mẫu</h2>
  <ul>
${exRows}
  </ul>
  ${mistakeHtml}
  ${relatedHtml}
  <div class="cmp-links">
    <a class="related-chip" href="${wordHref(p.linkWord)}">Tra “${esc(p.linkWord)}” →</a>
    <a class="related-chip" href="/vi/gioi-tu/">Tất cả giới từ →</a>
  </div>
</main>
<footer class="blog-footer"><p><a href="/vi/">Dual Dictionary</a> — từ điển &amp; công cụ học từ vựng offline-first cho người Việt.</p></footer>
</body>
</html>
`;
}

function main() {
  const data = JSON.parse(fs.readFileSync(path.join(REPO, 'data', 'prepositions.json'), 'utf8'));
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
  const slugToHead = {};
  for (const p of pairs) slugToHead[p.slug] = p.head;
  fs.mkdirSync(OUT_DIR, { recursive: true });
  for (const p of pairs) {
    const dir = path.join(OUT_DIR, p.slug);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'index.html'), pageHtml(p, wordHref, slugToHead));
  }
  const rows = pairs.map((p) =>
    `    <li><a href="/vi/gioi-tu/${p.slug}/">${esc(p.head)} đi với giới từ gì? — ${esc(p.answer)}</a></li>`).join('\n');
  const hubTitle = `${pairs.length} cặp từ + giới từ tiếng Anh hay nhầm`;
  const hubJsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'CollectionPage', name: hubTitle, url: `${SITE}/vi/gioi-tu/`, inLanguage: 'vi' },
      {
        '@type': 'ItemList',
        name: hubTitle,
        itemListElement: pairs.map((p, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          name: `${p.head} đi với giới từ gì?`,
          url: `${SITE}/vi/gioi-tu/${p.slug}/`,
        })),
      },
    ],
  };
  fs.writeFileSync(path.join(OUT_DIR, 'index.html'), `<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="theme-color" content="#0f766e">
<title>${pairs.length} cặp từ + giới từ tiếng Anh hay nhầm | Dual Dictionary</title>
<meta name="description" content="${pairs.length} cặp từ + giới từ tiếng Anh người Việt hay nhầm: đáp án 1 dòng, giải thích và câu mẫu song ngữ.">
<link rel="canonical" href="${SITE}/vi/gioi-tu/">
<meta name="robots" content="index, follow">
<link rel="stylesheet" href="/vi/blog/blog.css">
<link rel="stylesheet" href="/vi/tu/word.css">
<script type="application/ld+json">${JSON.stringify(hubJsonLd)}</script>
</head>
<body class="word-page">
${navHtml('gioi-tu')}
<nav class="breadcrumb" aria-label="Breadcrumb"><a href="/vi/">Trang chủ</a> › <a href="/vi/tu/">Từ điển</a> › <span aria-current="page">Giới từ</span></nav>
<main class="page">
  <p class="word-kicker">Giới từ đi kèm</p>
  <h1 style="font-size:2.2rem">${pairs.length} cặp từ + giới từ tiếng Anh hay nhầm</h1>
  <p style="color:var(--muted)">Mỗi cặp 1 trang riêng: đáp án 1 dòng, giải thích, câu mẫu song ngữ EN–VI.</p>
  <ul class="hub-list" style="columns:2;gap:20px;padding-left:18px;line-height:2">
${rows}
  </ul>
</main>
<footer class="blog-footer"><p><a href="/vi/">Dual Dictionary</a> — từ điển &amp; công cụ học từ vựng offline-first cho người Việt.</p></footer>
</body>
</html>
`);
  const LM = new Date().toISOString().slice(0, 10);
  const urls = [`https://dualdictionary.netlify.app/vi/gioi-tu/`, ...pairs.map((p) => `https://dualdictionary.netlify.app/vi/gioi-tu/${p.slug}/`)];
  fs.writeFileSync(path.join(REPO, 'vi', 'tu', 'sitemap', 'prepositions.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `  <url><loc>${u}</loc><lastmod>${LM}</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>`).join('\n')}\n</urlset>\n`);
  console.log(`PREPOSITIONS: ${pairs.length} pages + hub + sitemap`);
}

if (require.main === module) {
  main();
}
