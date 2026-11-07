#!/usr/bin/env node
/* Exam guides by test format: /vi/luyen-thi/{slug}/ x18 + hub index
 * + regenerate toeic-situations sitemap section (gop vao guides.xml).
 * Data: data/exam-guides.json {guides:[{slug,name,intro,words[],phrases[],deck}]} — all slugs verified.
 * Duplicates build-topic-pages.cjs conventions: head/meta/CSS/blog.css+word.css,
 * JSON-LD CollectionPage+ItemList+BreadcrumbList, navHtml('chu-de'), hub-filters
 * search box, footer, sitemap registration (idempotent).
 * Writes: 18 dirs under vi/luyen-thi/{slug}/ + vi/luyen-thi/index.html (hub index, own file),
 * sitemap exam-guides.xml, data/exam-guides.json (input).
 * Run AFTER word/phrase builders. Nav key 'luyen-thi'. Deck CTA per guide (ielts/toeic). */
const fs = require('fs');
const path = require('path');
const core = require('./build-word-pages.cjs');

const REPO = path.join(__dirname, '..');
const OUT_DIR = path.join(REPO, 'vi', 'luyen-thi');
const SITE = core.SITE;
const esc = core.escapeHtml;
const { navHtml } = require('./nav-partial.cjs');

function loadIpa() {
  const m = {};
  try {
    const qa = JSON.parse(fs.readFileSync(path.join(REPO, 'docs', 'wordpages-qa.json'), 'utf8'));
    for (const r of qa.ipa || []) if (r.word && r.ipa) m[r.word] = r.ipa;
  } catch (e) { /* fall through to dataset */ }
  try {
    const ds = JSON.parse(fs.readFileSync(path.join(REPO, 'data', 'ipa-en.json'), 'utf8'));
    for (const [w, v] of Object.entries(ds)) {
      if (!m[w]) m[w] = typeof v === 'string' ? v : (v && v.ipa) || '';
    }
  } catch (e) { /* optional */ }
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
})();
</script>`;

function guidePageHtml(t, ipa) {
  const isIELTS = t.deck !== 'toeic';
  const tag = isIELTS ? 'IELTS' : 'TOEIC';
  const n = t.words.length + t.phrases.length;
  const canonical = `${SITE}/vi/luyen-thi/${t.slug}/`;
  const h1 = `Từ vựng ${t.name} (${n} mục)`;
  const sample = t.words.slice(0, 5).join(', ');
  const desc = `${n} mục từ vựng ${t.name} (${sample}…) kèm phiên âm, nghĩa tiếng Việt, ví dụ thi viết tay — Dual Dictionary.`.slice(0, 160);
  const wRows = t.words.map((w) =>
    `    <li data-word="${esc(w)}"><a href="/vi/tu/${encodeURIComponent(w)}/">${esc(w)}</a>${ipa[w] ? ` <span class="hub-ipa">/${esc(ipa[w])}/</span>` : ''}</li>`).join('\n');
  const pRows = t.phrases.map((s) =>
    `    <li data-word="${esc(s.replace(/-/g, ' '))}"><a href="/vi/tu/${encodeURIComponent(s)}/">${esc(s.replace(/-/g, ' '))}</a></li>`).join('\n');
  const phraseSection = t.phrases.length ? `\n  <h2>Cụm từ (${t.phrases.length})</h2>\n  <ul class="hub-list" style="columns:2;gap:20px;padding-left:18px;line-height:2">\n${pRows}\n  </ul>` : '';
  const allItems = [
    ...t.words.map((w) => ({ '@type': 'ListItem', name: w, item: `${SITE}/vi/tu/${encodeURIComponent(w)}/` })),
    ...t.phrases.map((s) => ({ '@type': 'ListItem', name: s.replace(/-/g, ' '), item: `${SITE}/vi/tu/${encodeURIComponent(s)}/` })),
  ].map((o, i) => ({ '@type': 'ListItem', position: i + 1, ...o }));
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage',
        name: h1,
        description: desc,
        url: canonical,
        inLanguage: 'vi',
        isPartOf: { '@type': 'WebSite', name: 'Dual Dictionary', url: `${SITE}/vi/` },
      },
      { '@type': 'ItemList', name: `${t.name} — danh sách mục`, numberOfItems: n, itemListElement: allItems },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Trang chủ', item: `${SITE}/vi/` },
          { '@type': 'ListItem', position: 2, name: 'Luyện thi', item: `${SITE}/vi/luyen-thi/` },
          { '@type': 'ListItem', position: 3, name: t.name, item: canonical },
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
${navHtml('luyen-thi')}
<nav class="breadcrumb" aria-label="Breadcrumb"><a href="/vi/">Trang chủ</a> › <a href="/vi/luyen-thi/">Luyện thi</a> › <span aria-current="page">${esc(t.name)}</span></nav>
<main class="page">
  <p class="word-kicker">Từ vựng luyện thi</p>
  <h1 style="font-size:2.2rem">${esc(h1)}</h1>
  <p style="color:var(--muted)">${t.intro}</p>
  <p style="margin:12px 0 0"><a class="related-chip" style="text-decoration:none" href="/?deck=${t.deck === 'toeic' ? 'toeic' : 'ielts'}">${t.deck === 'toeic' ? '💼' : '🎯'} Luyện ${t.deck === 'toeic' ? 'TOEIC' : 'IELTS'} trong app ↗</a> <a href="/vi/luyen-thi/">Tất cả dạng bài →</a> · <a href="/vi/tu/toeic/">Bộ TOEIC Business →</a></p>
  <div class="hub-filters">
    <input id="hub-q" type="search" placeholder="Tìm trong chủ đề này…" aria-label="Tìm trong chủ đề này">
    <span id="hub-count" aria-live="polite"></span>
  </div>
  <h2>Danh sách ${t.words.length} từ</h2>
  <ul class="hub-list" style="columns:3;gap:20px;padding-left:18px;line-height:2">
${wRows}
  </ul>${phraseSection}
<p class="upd" style="color:var(--muted);font-size:.82rem;margin-top:24px;border-top:1px solid var(--line);padding-top:10px">Cập nhật nội dung: 07/11/2026 · <a href="/vi/cap-nhat/">Lịch sử cập nhật</a></p>
</main>
<footer class="blog-footer"><p><a href="/vi/">Dual Dictionary</a> — từ điển &amp; công cụ học từ vựng offline-first cho người Việt. Biên soạn bởi <a href="/vi/tac-gia/">Nguyễn Quốc Anh</a> · <a href="/vi/chinh-sach-noi-dung/">Chính sách nội dung</a></p></footer>
${FILTER_JS}
</body>
</html>
`;
}

/* Hub index /vi/luyen-thi/ (standalone file, own route — no patch of other hubs).
 * Lists 18 exam guides (10 IELTS + 8 TOEIC). JSON-LD CollectionPage+ItemList+Breadcrumb. */
function writeHubIndex(guides, ipa) {
  const canonical = `${SITE}/vi/luyen-thi/`;
  const rows = guides.map((t) =>
    `    <li><a href="/vi/luyen-thi/${t.slug}/">${t.deck !== 'toeic' ? 'IELTS' : 'TOEIC'} ${esc(t.name)} — ${t.words.length + t.phrases.length} mục (${esc(t.words.slice(0, 4).join(', '))}…)</a></li>`).join('\n');
  const items = guides.map((t, i) => ({ '@type': 'ListItem', position: i + 1, name: `${t.deck !== 'toeic' ? 'IELTS' : 'TOEIC'} ${t.name}`, item: `${SITE}/vi/luyen-thi/${t.slug}/` }));
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'CollectionPage', name: 'Luyện thi IELTS & TOEIC theo dạng bài (18 guide)', description: 'Từ vựng luyện thi theo đúng dạng bài: Writing Task 2, Speaking, Reading, TOEIC Part 5-6-7, Listening — Dual Dictionary.', url: canonical, inLanguage: 'vi', isPartOf: { '@type': 'WebSite', name: 'Dual Dictionary', url: `${SITE}/vi/` } },
      { '@type': 'ItemList', name: 'Luyện thi theo dạng bài', numberOfItems: guides.length, itemListElement: items },
      { '@type': 'BreadcrumbList', itemListElement: [ { '@type': 'ListItem', position: 1, name: 'Trang chủ', item: `${SITE}/vi/` }, { '@type': 'ListItem', position: 2, name: 'Luyện thi', item: canonical } ] },
    ],
  };
  const html = `<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Luyện thi IELTS & TOEIC theo dạng bài (18 guide) | Dual Dictionary</title>
<meta name="description" content="18 guide từ vựng luyện thi theo dạng bài: Writing Task 2, Speaking, Reading, TOEIC Part 5-6-7, Listening — Dual Dictionary.">
<link rel="canonical" href="${canonical}">
<meta name="robots" content="index, follow">
<meta property="og:type" content="article">
<meta property="og:locale" content="vi_VN">
<meta property="og:site_name" content="Dual Dictionary">
<meta property="og:url" content="${canonical}">
<meta property="og:title" content="Luyện thi IELTS & TOEIC theo dạng bài (18 guide)">
<meta property="og:description" content="18 guide từ vựng luyện thi theo dạng bài: Writing Task 2, Speaking, Reading, TOEIC Part 5-6-7, Listening.">
<link rel="stylesheet" href="/vi/blog/blog.css">
<link rel="stylesheet" href="/vi/tu/word.css">
<script type="application/ld+json">${JSON.stringify(jsonLd)}</` + `script>
</head>
<body class="word-page">
${navHtml('luyen-thi')}
<nav class="breadcrumb" aria-label="Breadcrumb"><a href="/vi/">Trang chủ</a> › <span aria-current="page">Luyện thi</span></nav>
<main class="page">
  <p class="word-kicker">Từ vựng luyện thi</p>
  <h1 style="font-size:2.2rem">Luyện thi IELTS & TOEIC theo dạng bài (18 guide)</h1>
  <p style="color:var(--muted)">10 guide IELTS (Writing Task 2, Speaking, Reading) + 8 guide TOEIC (Part 5-6-7, Listening) — từ vựng gom đúng dạng bài ra thi, kèm ví dụ viết tay và nút luyện trong app.</p>
  <ul class="hub-list" style="columns:1;gap:20px;padding-left:18px;line-height:2">
${rows}
  </ul>
</main>
<footer class="blog-footer"><p><a href="/vi/">Dual Dictionary</a> — từ điển &amp; công cụ học từ vựng offline-first cho người Việt. Biên soạn bởi <a href="/vi/tac-gia/">Nguyễn Quốc Anh</a> · <a href="/vi/chinh-sach-noi-dung/">Chính sách nội dung</a></p></footer>
</body>
</html>
`;
  fs.writeFileSync(path.join(OUT_DIR, 'index.html'), html);
}

function main() {
  const data = JSON.parse(fs.readFileSync(path.join(REPO, 'data', 'exam-guides.json'), 'utf8'));
  const guides = data.guides || [];
  if (guides.length !== 18) throw new Error(`expected 18 exam guides, got ${guides.length}`);
  const ipa = loadIpa();

  fs.mkdirSync(OUT_DIR, { recursive: true });
  for (const t of guides) {
    const dir = path.join(OUT_DIR, t.slug);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'index.html'), guidePageHtml(t, ipa));
  }
  writeHubIndex(guides, ipa);

  // sitemap exam-guides.xml (own file) + sitemap.xml registration (idempotent)
  const LM = new Date().toISOString().slice(0, 10);
  const urls = [`https://dualdictionary.netlify.app/vi/luyen-thi/`,
    ...guides.map((g) => `https://dualdictionary.netlify.app/vi/luyen-thi/${g.slug}/`)];
  fs.mkdirSync(path.join(REPO, 'vi', 'tu', 'sitemap'), { recursive: true });
  fs.writeFileSync(path.join(REPO, 'vi', 'tu', 'sitemap', 'exam-guides.xml'),
    `<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\">\n${urls.map((u) => `  <url><loc>${u}</loc><lastmod>${LM}</lastmod><changefreq>monthly</changefreq><priority>0.8</priority></url>`).join('\n')}\n</urlset>\n`);
  const smPath = path.join(REPO, 'sitemap.xml');
  let sm = fs.readFileSync(smPath, 'utf8');
  if (!sm.includes('exam-guides.xml')) {
    sm = sm.replace('</sitemapindex>',
      `  <sitemap>\n    <loc>https://dualdictionary.netlify.app/vi/tu/sitemap/exam-guides.xml</loc>\n    <lastmod>${LM}</lastmod>\n  </sitemap>\n</sitemapindex>`);
    fs.writeFileSync(smPath, sm);
  }

  const total = guides.reduce((a, t) => a + t.words.length + t.phrases.length, 0);
  console.log(`EXAM-GUIDES: ${guides.length} guides, ${total} items + hub index + sitemap (${urls.length} urls)`);
}

if (require.main === module) {
  main();
}
