#!/usr/bin/env node
/* Cambridge vocab pages (owner-approved 01/11): /vi/cambridge/cam-{book}-test-{n}/
 * Vocab LISTS only (no passage text — copyright). Words/phrases all have
 * built pages (verified). Owned by NO manifest: never wiped. */
const fs = require('fs');
const path = require('path');
const core = require('./build-word-pages.cjs');

const REPO = path.join(__dirname, '..');
const OUT_DIR = path.join(REPO, 'vi', 'cambridge');
const SITE = core.SITE;
const esc = core.escapeHtml;
const { navHtml } = require('./nav-partial.cjs');

function pageHtml(p) {
  const slug = `cam-${p.book}-test-${p.test}`;
  const canonical = `${SITE}/vi/cambridge/${slug}/`;
  const h1 = `Từ vựng ${p.title}`;
  const desc = `Bộ ${(p.words || []).length} từ + ${(p.phrases || []).length} cụm hay gặp trong đề Cam ${p.book} Test ${p.test} (${p.skill}) — nghĩa, phát âm, ví dụ thi và bài luyện.`.slice(0, 160);
  const wRows = (p.words || []).map((w) => `    <li data-word="${esc(w)}"><a href="/vi/tu/${encodeURIComponent(w)}/">${esc(w)}</a></li>`).join('\n');
  const pRows = (p.phrases || []).map((s) => `    <li data-word="${esc(s)}"><a href="/vi/tu/${encodeURIComponent(s)}/">${esc(s.replace(/-/g, ' '))}</a></li>`).join('\n');
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage',
        name: h1,
        description: desc,
        url: canonical,
        inLanguage: 'vi',
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Trang chủ', item: `${SITE}/vi/` },
          { '@type': 'ListItem', position: 2, name: 'Cambridge', item: `${SITE}/vi/cambridge/` },
          { '@type': 'ListItem', position: 3, name: `Cam ${p.book} Test ${p.test}`, item: canonical },
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
<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
</head>
<body class="word-page">
${navHtml('cambridge')}
<nav class="breadcrumb" aria-label="Breadcrumb"><a href="/vi/">Trang chủ</a> › <a href="/vi/tu/">Từ điển</a> › <a href="/vi/cambridge/">Cambridge</a> › <span aria-current="page">Cam ${p.book} Test ${p.test}</span></nav>
<main class="page">
  <p class="word-kicker">Từ vựng đề thi thật · ${esc(p.skill)}</p>
  <h1 style="font-size:2.2rem">${esc(h1)}</h1>
  <p style="color:var(--muted)">Bộ từ/cụm hay gặp trong đề Cam ${p.book} Test ${p.test} (${esc(p.skill)}). Bấm từng từ để xem nghĩa, phát âm, ví dụ thi. Chỉ liệt kê từ vựng — không sao chép đề thi.</p>
  <div class="hub-filters">
    <input id="hub-q" type="search" placeholder="Tìm trong bộ này…" aria-label="Tìm trong bộ này">
    <span id="hub-count" aria-live="polite"></span>
  </div>
  <h2>Từ đơn (${(p.words || []).length})</h2>
  <ul class="hub-list" style="columns:3;gap:20px;padding-left:18px;line-height:2">
${wRows}
  </ul>
  <h2>Cụm từ (${(p.phrases || []).length})</h2>
  <ul class="hub-list" style="columns:3;gap:20px;padding-left:18px;line-height:2">
${pRows}
  </ul>
</main>
<footer class="blog-footer"><p><a href="/vi/">Dual Dictionary</a> — từ điển &amp; công cụ học từ vựng offline-first cho người Việt. Biên soạn bởi <a href="/vi/tac-gia/">Nguyễn Quốc Anh</a> · <a href="/vi/chinh-sach-noi-dung/">Chính sách nội dung</a></p></footer>
<script>
(function () {
  var q = document.getElementById('hub-q');
  var count = document.getElementById('hub-count');
  var items = Array.prototype.slice.call(document.querySelectorAll('.hub-list li'));
  function apply() {
    var term = q.value.trim().toLowerCase(), shown = 0;
    for (var it of items) {
      var ok = !term || (it.dataset.word || '').indexOf(term) !== -1;
      it.style.display = ok ? '' : 'none';
      if (ok) shown++;
    }
    count.textContent = 'Hiển thị ' + shown + '/' + items.length;
  }
  q.addEventListener('input', apply); q.addEventListener('change', apply);
  apply();
})();
</script>
</body>
</html>
`;
}

function main() {
  const cam = JSON.parse(fs.readFileSync(path.join(REPO, 'data', 'cambridge.json'), 'utf8'));
  const papers = cam.papers || [];
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const slugs = [];
  for (const p of papers) {
    const slug = `cam-${p.book}-test-${p.test}`;
    slugs.push({ slug, p });
    const dir = path.join(OUT_DIR, slug);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'index.html'), pageHtml(p));
  }
  const rows = slugs.map(({ slug, p }) => `    <li><a href="/vi/cambridge/${slug}/">Từ vựng Cam ${p.book} Test ${p.test} (${esc(p.skill)}) — ${(p.words || []).length} từ + ${(p.phrases || []).length} cụm</a></li>`).join('\n');
  const books = papers.map((p) => p.book);
  const range = `Cam ${Math.min(...books)}-${Math.max(...books)}`;
  const hubTitle = `Từ vựng đề Cambridge IELTS — ${range} | Dual Dictionary`;
  const hubDesc = `Bộ từ vựng hay gặp trong đề thi IELTS Cambridge ${range.replace('Cam ', '')} theo từng test — nghĩa, phát âm, ví dụ thi và bài luyện.`;
  const itemList = {
    '@type': 'ItemList',
    name: hubTitle,
    itemListElement: slugs.map(({ slug, p }, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: `Từ vựng ${p.title}`,
      url: `${SITE}/vi/cambridge/${slug}/`,
    })),
  };
  const hubJsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'CollectionPage', name: hubTitle, description: hubDesc, url: `${SITE}/vi/cambridge/`, inLanguage: 'vi' },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Trang chủ', item: `${SITE}/vi/` },
          { '@type': 'ListItem', position: 2, name: 'Cambridge', item: `${SITE}/vi/cambridge/` },
        ],
      },
      itemList,
    ],
  };
  fs.writeFileSync(path.join(OUT_DIR, 'index.html'), `<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="theme-color" content="#0f766e">
<title>${esc(hubTitle)}</title>
<meta name="description" content="${esc(hubDesc)}">
<link rel="canonical" href="${SITE}/vi/cambridge/">
<meta name="robots" content="index, follow">
<meta property="og:type" content="website">
<meta property="og:locale" content="vi_VN">
<meta property="og:site_name" content="Dual Dictionary">
<meta property="og:url" content="${SITE}/vi/cambridge/">
<meta property="og:title" content="${esc(hubTitle)}">
<meta name="twitter:card" content="summary">
<link rel="stylesheet" href="/vi/blog/blog.css">
<link rel="stylesheet" href="/vi/tu/word.css">
<script type="application/ld+json">${JSON.stringify(hubJsonLd)}</script>
</head>
<body class="word-page">
${navHtml('cambridge')}
<nav class="breadcrumb" aria-label="Breadcrumb"><a href="/vi/">Trang chủ</a> › <a href="/vi/tu/">Từ điển</a> › <span aria-current="page">Cambridge</span></nav>
<main class="page">
  <p class="word-kicker">Đề thi thật</p>
  <h1 style="font-size:2.2rem">Từ vựng đề Cambridge IELTS</h1>
  <p style="color:var(--muted)">Từ vựng hay gặp theo từng đề thi thật Cambridge ${esc(range)}. Chỉ liệt kê từ vựng — không sao chép đề thi.</p>
  <p style="margin:12px 0 0"><a href="/vi/chu-de/">Chủ đề học thuật (AWL) →</a> · <a href="/vi/tu/ielts/">Bộ IELTS Core →</a> · <a href="/vi/phan-biet/">Phân biệt dễ nhầm →</a> · <a href="/vi/loi-sai/">Lỗi sai thường gặp →</a></p>
  <ul class="hub-list" style="columns:1;gap:20px;padding-left:18px;line-height:2">
${rows}
  </ul>
</main>
<footer class="blog-footer"><p><a href="/vi/">Dual Dictionary</a> — từ điển &amp; công cụ học từ vựng offline-first cho người Việt. Biên soạn bởi <a href="/vi/tac-gia/">Nguyễn Quốc Anh</a> · <a href="/vi/chinh-sach-noi-dung/">Chính sách nội dung</a></p></footer>
</body>
</html>
`);
  const LM = new Date().toISOString().slice(0, 10);
  const urls = [`https://dualdictionary.netlify.app/vi/cambridge/`, ...slugs.map(({ slug }) => `https://dualdictionary.netlify.app/vi/cambridge/${slug}/`)];
  fs.writeFileSync(path.join(REPO, 'vi', 'tu', 'sitemap', 'cambridge.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `  <url><loc>${u}</loc><lastmod>${LM}</lastmod><changefreq>monthly</changefreq><priority>0.8</priority></url>`).join('\n')}\n</urlset>\n`);
  console.log(`CAMBRIDGE: ${papers.length} papers + hub + sitemap`);
}

if (require.main === module) {
  main();
}
