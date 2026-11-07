#!/usr/bin/env node
/* CEFR level hubs (07/11): /vi/trinh-do/{a2,b1,b2,c1}/ + hub index.
 * Data: data/exam-tags.json (cefr estimate per word) + wordpages-manifest.
 * Conventions from build-topic-pages.cjs: CollectionPage+ItemList+BreadcrumbList,
 * hub-filters search, IPA spans. Estimate labeled as ước tính, never official.
 * Run AFTER word builder. Registers trin-do.xml in sitemap (via sitemap-maint discovery).
 */
const fs = require('fs');
const path = require('path');
const core = require('./build-word-pages.cjs');

const REPO = path.join(__dirname, '..');
const OUT_DIR = path.join(REPO, 'vi', 'trinh-do');
const SITE = core.SITE;
const esc = core.escapeHtml;
const { navHtml } = require('./nav-partial.cjs');
const { hubListHtml } = require('./hub-lazy-lib.cjs');

const LEVELS = [
  { slug: 'a2', name: 'A2 Sơ cấp', en: 'Elementary', desc: 'từ vựng nền tảng giao tiếp hàng ngày' },
  { slug: 'b1', name: 'B1 Trung cấp', en: 'Intermediate', desc: 'từ vựng giao tiếp độc lập, đọc hiểu cơ bản' },
  { slug: 'b2', name: 'B2 Trung cao cấp', en: 'Upper-Intermediate', desc: 'từ vựng IELTS 5.0-6.5, viết luận và tranh luận' },
  { slug: 'c1', name: 'C1 Nâng cao', en: 'Advanced', desc: 'từ vựng học thuật, IELTS 7.0+, đọc báo và tài liệu chuyên ngành' },
];
const CEFR_UP = { A2: 'a2', B1: 'b1', B2: 'b2', C1: 'c1' };

function loadIpa() {
  const m = {};
  try {
    const ds = JSON.parse(fs.readFileSync(path.join(REPO, 'data', 'ipa-en.json'), 'utf8'));
    for (const [w, v] of Object.entries(ds)) m[w] = typeof v === 'string' ? v : (v && v.ipa) || '';
  } catch (e) {}
  return m;
}
const FILTER_JS = `<script>
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
})();</script>`;

function levelPageHtml(lv, words, ipa, maniSet) {
  const built = words.filter((w) => maniSet.has(w));
  const n = built.length;
  const canonical = `${SITE}/vi/trinh-do/${lv.slug}/`;
  const h1 = `Từ vựng tiếng Anh ${lv.name} (${n.toLocaleString('vi-VN')} từ)`;
  const sample = built.slice(0, 5).join(', ');
  const desc = `${n} từ vựng tiếng Anh trình độ ${lv.name} (${lv.en}) — ${lv.desc} (${sample}…). Kèm phiên âm IPA, nghĩa tiếng Việt, ví dụ thi thật.`.slice(0, 160);
  const wRows = built.map((w) =>
    `    <li data-word="${esc(w)}"><a href="/vi/tu/${encodeURIComponent(w)}/">${esc(w)}</a>${ipa[w] ? ` <span class="hub-ipa">/${esc(ipa[w])}/</span>` : ''}</li>`).join('\n');
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'CollectionPage', name: h1, description: desc, url: canonical, inLanguage: 'vi',
        isPartOf: { '@type': 'WebSite', name: 'Dual Dictionary', url: `${SITE}/vi/` } },
      { '@type': 'ItemList', name: h1,
        itemListElement: built.map((w, i) => ({ '@type': 'ListItem', position: i + 1, name: w, url: `${SITE}/vi/tu/${encodeURIComponent(w)}/` })) },
      { '@type': 'BreadcrumbList', itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Trang chủ', item: `${SITE}/vi/` },
        { '@type': 'ListItem', position: 2, name: 'Trình độ', item: `${SITE}/vi/trinh-do/` },
        { '@type': 'ListItem', position: 3, name: lv.name },
      ] },
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
<meta property="og:type" content="website">
<meta property="og:locale" content="vi_VN">
<meta property="og:site_name" content="Dual Dictionary">
<meta property="og:url" content="${canonical}">
<meta property="og:title" content="${esc(h1)}">
<meta property="og:image" content="https://dualdictionary.netlify.app/vi/images/og-default.jpg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="Dual Dictionary — từ điển Anh-Việt offline-first">
<meta name="twitter:card" content="summary">
<link rel="stylesheet" href="/vi/blog/blog.css">
<link rel="stylesheet" href="/vi/tu/word.css">
<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
</head>
<body class="word-page">
${navHtml('tu')}
<nav class="breadcrumb" aria-label="Breadcrumb"><a href="/vi/">Trang chủ</a> › <a href="/vi/tu/">Từ điển</a> › <a href="/vi/trinh-do/">Trình độ</a> › <span aria-current="page">${esc(lv.name)}</span></nav>
<main class="page">
  <p class="word-kicker">Từ vựng theo trình độ (ước tính)</p>
  <h1 style="font-size:2.2rem">${esc(h1)}</h1>
  <p style="color:var(--muted)">Trình độ ước tính suy từ NGSL/AWL/tần suất — tham khảo lộ trình học, không phải chứng nhận chính thức. Mỗi từ có trang riêng: phiên âm IPA, nghĩa tiếng Việt, ví dụ thi thật.</p>
  <p><input id="hub-q" type="search" placeholder="Lọc từ trong trang này…" aria-label="Lọc từ" style="width:100%;max-width:420px;padding:8px 12px;border:1px solid var(--line);border-radius:8px"> <span id="hub-count" style="color:var(--muted)"></span></p>
  ${hubListHtml(wRows.split('\n'), {cols:2})}
<p class="upd" style="color:var(--muted);font-size:.82rem;margin-top:24px;border-top:1px solid var(--line);padding-top:10px">Cập nhật nội dung: 07/11/2026 · <a href="/vi/cap-nhat/">Lịch sử cập nhật</a></p>
</main>
${FILTER_JS}
<footer class="blog-footer"><p><a href="/vi/">Dual Dictionary</a> — từ điển &amp; công cụ học từ vựng offline-first cho người Việt. Biên soạn bởi <a href="/vi/tac-gia/">Nguyễn Quốc Anh</a> · <a href="/vi/chinh-sach-noi-dung/">Chính sách nội dung</a></p></footer>
</body>
</html>
`;
}

function main() {
  const tags = JSON.parse(fs.readFileSync(path.join(REPO, 'data', 'exam-tags.json'), 'utf8'));
  const mani = JSON.parse(fs.readFileSync(path.join(REPO, 'docs', 'wordpages-manifest.json'), 'utf8'));
  const maniSet = new Set(mani.slugs || []);
  const ipa = loadIpa();
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const counts = {};
  for (const lv of LEVELS) {
    const words = Object.entries(tags.words || {})
      .filter(([, v]) => CEFR_UP[v.cefr] === lv.slug)
      .map(([w]) => w).sort();
    counts[lv.slug] = words.filter((w) => maniSet.has(w)).length;
    fs.writeFileSync(path.join(OUT_DIR, lv.slug, 'index.html').replace(`/${lv.slug}/index`, `/${lv.slug}x`), ''); // noop guard
    fs.mkdirSync(path.join(OUT_DIR, lv.slug), { recursive: true });
    fs.writeFileSync(path.join(OUT_DIR, lv.slug, 'index.html'), levelPageHtml(lv, words, ipa, maniSet));
  }
  // hub index
  const hubRows = LEVELS.map((lv) =>
    `    <li><a href="/vi/trinh-do/${lv.slug}/">Từ vựng ${lv.name} (${lv.en}) — ${(counts[lv.slug] || 0).toLocaleString('vi-VN')} từ</a> — ${esc(lv.desc)}</li>`).join('\n');
  const hubJsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'CollectionPage', name: 'Từ vựng tiếng Anh theo trình độ A2–C1', url: `${SITE}/vi/trinh-do/`, inLanguage: 'vi' },
      { '@type': 'BreadcrumbList', itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Trang chủ', item: `${SITE}/vi/` },
        { '@type': 'ListItem', position: 2, name: 'Trình độ' },
      ] },
    ],
  };
  fs.writeFileSync(path.join(OUT_DIR, 'index.html'), `<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="theme-color" content="#0f766e">
<title>Từ vựng tiếng Anh theo trình độ A2–C1 | Dual Dictionary</title>
<meta name="description" content="Học từ vựng theo trình độ A2 sơ cấp, B1 trung cấp, B2 trung cao cấp, C1 nâng cao — kèm IPA, nghĩa Việt, ví dụ thi thật.">
<link rel="canonical" href="${SITE}/vi/trinh-do/">
<meta name="robots" content="index, follow">
<meta property="og:type" content="website">
<meta property="og:locale" content="vi_VN">
<meta property="og:site_name" content="Dual Dictionary">
<meta name="twitter:card" content="summary">
<link rel="stylesheet" href="/vi/blog/blog.css">
<link rel="stylesheet" href="/vi/tu/word.css">
<script type="application/ld+json">${JSON.stringify(hubJsonLd)}</script>
</head>
<body class="word-page">
${navHtml('tu')}
<nav class="breadcrumb" aria-label="Breadcrumb"><a href="/vi/">Trang chủ</a> › <a href="/vi/tu/">Từ điển</a> › <span aria-current="page">Trình độ</span></nav>
<main class="page">
  <p class="word-kicker">Học theo trình độ</p>
  <h1 style="font-size:2.2rem">Từ vựng tiếng Anh theo trình độ A2–C1</h1>
  <p style="color:var(--muted)">Chọn trình độ của bạn, học dần lên — mỗi từ có phiên âm, nghĩa Việt, ví dụ thi thật.</p>
  <ul style="line-height:2">
${hubRows}
  </ul>
</main>
<footer class="blog-footer"><p><a href="/vi/">Dual Dictionary</a> — từ điển &amp; công cụ học từ vựng offline-first cho người Việt. Biên soạn bởi <a href="/vi/tac-gia/">Nguyễn Quốc Anh</a> · <a href="/vi/chinh-sach-noi-dung/">Chính sách nội dung</a></p></footer>
</body>
</html>
`);
  // sitemap (own file; sitemap-maint discovers vi/*/sitemap/*.xml — write there too)
  const LM = new Date().toISOString().slice(0, 10);
  const urls = [`${SITE}/vi/trinh-do/`, ...LEVELS.map((lv) => `${SITE}/vi/trinh-do/${lv.slug}/`)];
  fs.mkdirSync(path.join(REPO, 'vi', 'tu', 'sitemap'), { recursive: true });
  fs.writeFileSync(path.join(REPO, 'vi', 'tu', 'sitemap', 'levels.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `  <url><loc>${u}</loc><lastmod>${LM}</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>`).join('\n')}\n</urlset>\n`);
  console.log(`LEVELS: ${LEVELS.map((l) => `${l.slug}=${counts[l.slug]}`).join(' ')} + hub + sitemap`);
}
if (require.main === module) main();
