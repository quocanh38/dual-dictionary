#!/usr/bin/env node
/* Common-mistake pages (owner-approved 01/11): /vi/loi-sai/{slug}/
 * 1 mistake + why + 3 right sentences + link to word page + FAQ schema.
 * Owned by NO manifest: never wiped. */
const fs = require('fs');
const path = require('path');
const core = require('./build-word-pages.cjs');
const { navHtml } = require('./nav-partial.cjs');
const { blogLinksHtml } = require('./blog-links-lib.cjs');

const REPO = path.join(__dirname, '..');
const OUT_DIR = path.join(REPO, 'vi', 'loi-sai');
const SITE = core.SITE;
const esc = core.escapeHtml;

function slugOf(s) {
  return String(s).normalize('NFC').toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'loi-sai';
}

function pageHtml(m, wordHref) {
  const slug = slugOf(m.mistake);
  const canonical = `${SITE}/vi/loi-sai/${slug}/`;
  const h1 = `Đừng nói “${m.mistake}” — cách dùng đúng`;
  const desc = `Vì sao “${m.mistake}” là sai? Cách dùng đúng của “${m.word}” kèm câu mẫu IELTS/TOEIC — Dual Dictionary.`.slice(0, 160);
  const rightRows = (m.right || []).map((r) => `<li class="cmp-right">✓ ${esc(r)}</li>`).join('\n');
  /* Snippet box (02/11): TL;DR under H1 — states the CORRECT form in one line
   * (snippet-quotable) + why + example. Clean <p>, SpeakableSpecification. */
  const firstRight = (m.right || [])[0] || '';
  const firstClean = firstRight.replace(/\.+$/, '');
  const tldr = `Đáp án: thay “${m.mistake}” bằng cách dùng đúng của “${m.word}”${firstClean ? ` — ví dụ: ${firstClean}.` : ''} ${m.diff || ''}`.trim();
  const tldrWords = tldr.split(/\s+/);
  const tldrShort = tldrWords.length > 60 ? tldrWords.slice(0, 60).join(' ') + '…' : tldr;
  const tldrHtml = `<p class="tldr">${esc(tldrShort)}</p>`;
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Article',
        headline: h1,
        description: desc,
        url: canonical,
        inLanguage: 'vi',
        about: { '@type': 'DefinedTerm', name: m.word, url: `${SITE}${wordHref(m.word)}` },
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
            name: `Vì sao “${m.mistake}” là sai?`,
            acceptedAnswer: { '@type': 'Answer', text: m.diff || `Cách dùng đúng của “${m.word}” — xem câu đúng bên dưới.` },
          },
          {
            '@type': 'Question',
            name: `Cách dùng đúng của “${m.word}” là gì?`,
            acceptedAnswer: { '@type': 'Answer', text: (m.right || []).join(' ') || `Tra chi tiết tại trang từ “${m.word}”.` },
          },
        ],
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Trang chủ', item: `${SITE}/vi/` },
          { '@type': 'ListItem', position: 2, name: 'Lỗi sai', item: `${SITE}/vi/loi-sai/` },
          { '@type': 'ListItem', position: 3, name: m.mistake, item: canonical },
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
<meta property="og:image" content="https://dualdictionary.netlify.app/vi/images/og-default.jpg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="Dual Dictionary — từ điển Anh-Việt offline-first">
<meta name="twitter:card" content="summary">
<meta name="twitter:title" content="${esc(h1)}">
<link rel="stylesheet" href="/vi/blog/blog.css">
<link rel="stylesheet" href="/vi/tu/word.css">
<style>.cmp-wrong{color:#991b1b}.cmp-right{color:#065f46}.tldr{background:var(--soft);border-left:4px solid var(--teal);border-radius:0 10px 10px 0;padding:12px 16px;font-size:1.02rem;line-height:1.7}</style>
<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
</head>
<body class="word-page">
${navHtml('loi-sai')}
<nav class="breadcrumb" aria-label="Breadcrumb"><a href="/vi/">Trang chủ</a> › <a href="/vi/tu/">Từ điển</a> › <a href="/vi/loi-sai/">Lỗi sai</a> › <span aria-current="page">${esc(m.mistake)}</span></nav>
<main class="page">
  <p class="word-kicker">Lỗi sai thường gặp</p>
  <h1 style="font-size:2.2rem">Đừng nói <s>“${esc(m.mistake)}”</s></h1>
  ${tldrHtml}
  <p>${esc(m.diff || `Cách dùng đúng của “${m.word}” — xem câu đúng bên dưới.`)}</p>
  <h2>Câu đúng</h2>
  <ul>
${rightRows || `<li>Tra chi tiết tại trang từ “${esc(m.word)}”.</li>`}
  </ul>
  <div class="cmp-links">
    <a class="related-chip" href="${wordHref(m.word)}">Tra “${esc(m.word)}” →</a>
    <a class="related-chip" href="/vi/loi-sai/">Tất cả lỗi sai →</a>
  </div>
  ${blogLinksHtml(`/vi/loi-sai/${slug}/`)}
<p class="upd" style="color:var(--muted);font-size:.82rem;margin-top:24px;border-top:1px solid var(--line);padding-top:10px">Cập nhật nội dung: 07/11/2026 · <a href="/vi/cap-nhat/">Lịch sử cập nhật</a></p>
</main>
<footer class="blog-footer"><p><a href="/vi/">Dual Dictionary</a> — từ điển &amp; công cụ học từ vựng offline-first cho người Việt. Biên soạn bởi <a href="/vi/tac-gia/">Nguyễn Quốc Anh</a> · <a href="/vi/chinh-sach-noi-dung/">Chính sách nội dung</a></p></footer>
</body>
</html>
`;
}

function main() {
  const data = JSON.parse(fs.readFileSync(path.join(REPO, 'data', 'mistakes.json'), 'utf8'));
  const pairs = (data.pairs || []);
  // word link guard: phrase mistakes (contain space) -> phrase slug page
  let phraseSlugs = new Set();
  try {
    const pm = JSON.parse(fs.readFileSync(path.join(REPO, 'docs', 'phrasepages-manifest.json'), 'utf8'));
    for (const e of pm.entries || []) phraseSlugs.add(e.slug);
  } catch (e) {}
  const wordHref = (w) => {
    const slug = String(w).toLowerCase().replace(/\s+/g, '-');
    if (phraseSlugs.has(slug)) return `/vi/tu/${encodeURIComponent(slug)}/`;
    return `/vi/tu/${encodeURIComponent(w)}/`;
  };
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const slugs = [];
  const seen = new Set();
  for (const m of pairs) {
    let slug = slugOf(m.mistake);
    let i = 2;
    while (seen.has(slug)) slug = `${slugOf(m.mistake)}-${i++}`;
    seen.add(slug);
    slugs.push(slug);
    const dir = path.join(OUT_DIR, slug);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'index.html'), pageHtml(m, wordHref));
  }
  const rows = pairs.map((m, i) => `    <li><a href="/vi/loi-sai/${slugs[i]}/">Đừng nói “${esc(m.mistake)}” (${esc(m.word)})</a></li>`).join('\n');
  const hubTitle = `${pairs.length} lỗi sai tiếng Anh thường gặp`;
  const hubJsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'CollectionPage', name: hubTitle, url: `${SITE}/vi/loi-sai/`, inLanguage: 'vi' },
      {
        '@type': 'ItemList',
        name: hubTitle,
        itemListElement: pairs.map((m, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          name: `Đừng nói “${m.mistake}” (${m.word})`,
          url: `${SITE}/vi/loi-sai/${slugs[i]}/`,
        })),
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Trang chủ', item: `${SITE}/vi/` },
          { '@type': 'ListItem', position: 2, name: 'Lỗi sai' },
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
<title>${pairs.length} lỗi sai tiếng Anh thường gặp | Dual Dictionary</title>
<meta name="description" content="${pairs.length} lỗi sai tiếng Anh người Việt hay mắc kèm cách dùng đúng và câu mẫu IELTS/TOEIC.">
<link rel="canonical" href="${SITE}/vi/loi-sai/">
<meta name="robots" content="index, follow">
<meta property="og:type" content="website">
<meta property="og:locale" content="vi_VN">
<meta property="og:site_name" content="Dual Dictionary">
<meta property="og:url" content="${SITE}/vi/loi-sai/">
<meta property="og:title" content="${pairs.length} lỗi sai tiếng Anh thường gặp | Dual Dictionary">
<meta name="twitter:card" content="summary">
<link rel="stylesheet" href="/vi/blog/blog.css">
<link rel="stylesheet" href="/vi/tu/word.css">
<script type="application/ld+json">${JSON.stringify(hubJsonLd)}</script>
</head>
<body class="word-page">
${navHtml('loi-sai')}
<nav class="breadcrumb" aria-label="Breadcrumb"><a href="/vi/">Trang chủ</a> › <a href="/vi/tu/">Từ điển</a> › <span aria-current="page">Lỗi sai</span></nav>
<main class="page">
  <p class="word-kicker">Lỗi sai thường gặp</p>
  <h1 style="font-size:2.2rem">${pairs.length} lỗi sai tiếng Anh thường gặp</h1>
  <p style="color:var(--muted)">Mỗi lỗi 1 trang riêng: vì sao sai, cách dùng đúng, câu mẫu IELTS/TOEIC. Gõ không dấu như &quot;an evidence dung hay sai&quot; vẫn ra đúng lỗi.</p>
  <ul class="hub-list" style="columns:2;gap:20px;padding-left:18px;line-height:2">
${rows}
  </ul>
</main>
<footer class="blog-footer"><p><a href="/vi/">Dual Dictionary</a> — từ điển &amp; công cụ học từ vựng offline-first cho người Việt. Biên soạn bởi <a href="/vi/tac-gia/">Nguyễn Quốc Anh</a> · <a href="/vi/chinh-sach-noi-dung/">Chính sách nội dung</a></p></footer>
</body>
</html>
`);
  const LM = new Date().toISOString().slice(0, 10);
  const urls = [`https://dualdictionary.netlify.app/vi/loi-sai/`, ...slugs.map((s) => `https://dualdictionary.netlify.app/vi/loi-sai/${s}/`)];
  fs.writeFileSync(path.join(REPO, 'vi', 'tu', 'sitemap', 'mistakes.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `  <url><loc>${u}</loc><lastmod>${LM}</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>`).join('\n')}\n</urlset>\n`);
  console.log(`MISTAKES: ${pairs.length} pages + hub + sitemap`);
}

if (require.main === module) {
  main();
}
