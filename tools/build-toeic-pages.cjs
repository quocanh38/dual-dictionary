#!/usr/bin/env node
/* TOEIC situation hubs: /vi/toeic/{slug}/ x12 + hub index /vi/toeic/ (index.html overwrite)
 * + regenerate toeic-situations sitemap section (gop vao topics.xml).
 * Data: data/toeic-situations.json {topics:[{slug,name,intro,words[],phrases[]}]} — all slugs verified.
 * Duplicates build-topic-pages.cjs conventions: head/meta/CSS/blog.css+word.css,
 * JSON-LD CollectionPage+ItemList+BreadcrumbList, navHtml('chu-de'), hub-filters
 * search box, footer, sitemap registration (idempotent).
 * Writes: 12 dirs under vi/toeic/{slug}/ + vi/toeic/index.html (hub index, own file),
 * topics.xml rewrite (topics + toeic dirs), data/toeic-situations.json (input).
 * Run AFTER word/phrase builders. Nav key 'toeic' (reuse existing nav). Links to /vi/tu/toeic/ master. */
const fs = require('fs');
const path = require('path');
const core = require('./build-word-pages.cjs');

const REPO = path.join(__dirname, '..');
const OUT_DIR = path.join(REPO, 'vi', 'toeic');
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

function topicPageHtml(t, ipa) {
  const n = t.words.length + t.phrases.length;
  const canonical = `${SITE}/vi/toeic/${t.slug}/`;
  const h1 = `Từ vựng TOEIC tình huống ${t.name} (${n} mục)`;
  const sample = t.words.slice(0, 5).join(', ');
  const desc = `${n} mục từ vựng TOEIC tình huống ${t.name} (${sample}…) kèm phiên âm, nghĩa tiếng Việt, ví dụ công sở viết tay — Dual Dictionary.`.slice(0, 160);
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
          { '@type': 'ListItem', position: 2, name: 'TOEIC theo tình huống', item: `${SITE}/vi/toeic/` },
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
${navHtml('toeic')}
<nav class="breadcrumb" aria-label="Breadcrumb"><a href="/vi/">Trang chủ</a> › <a href="/vi/toeic/">TOEIC theo tình huống</a> › <span aria-current="page">${esc(t.name)}</span></nav>
<main class="page">
  <p class="word-kicker">Từ vựng TOEIC theo tình huống</p>
  <h1 style="font-size:2.2rem">${esc(h1)}</h1>
  <p style="color:var(--muted)">${t.intro}</p>
  <p style="margin:12px 0 0"><a href="/vi/toeic/">Tất cả tình huống →</a> · <a href="/vi/tu/toeic/">Bộ TOEIC Business (161 cụm + từ kinh doanh) →</a></p>
  <div class="hub-filters">
    <input id="hub-q" type="search" placeholder="Tìm trong chủ đề này…" aria-label="Tìm trong chủ đề này">
    <span id="hub-count" aria-live="polite"></span>
  </div>
  <h2>Danh sách ${t.words.length} từ</h2>
  <ul class="hub-list" style="columns:3;gap:20px;padding-left:18px;line-height:2">
${wRows}
  </ul>${phraseSection}
</main>
<footer class="blog-footer"><p><a href="/vi/">Dual Dictionary</a> — từ điển &amp; công cụ học từ vựng offline-first cho người Việt.</p></footer>
${FILTER_JS}
</body>
</html>
`;
}

/* Hub index /vi/toeic/ (standalone file, own route — no patch of other hubs).
 * Lists 12 situation hubs + link to master /vi/tu/toeic/. JSON-LD CollectionPage+ItemList+Breadcrumb. */
function writeHubIndex(topics, ipa) {
  const canonical = `${SITE}/vi/toeic/`;
  const rows = topics.map((t) =>
    `    <li><a href="/vi/toeic/${t.slug}/">TOEIC tình huống ${esc(t.name)} — ${t.words.length + t.phrases.length} mục (${esc(t.words.slice(0, 4).join(', '))}…)</a></li>`).join('\n');
  const items = topics.map((t, i) => ({ '@type': 'ListItem', position: i + 1, name: `TOEIC ${t.name}`, item: `${SITE}/vi/toeic/${t.slug}/` }));
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'CollectionPage', name: 'TOEIC theo tình huống (12 hub)', description: 'Từ vựng TOEIC Business theo 12 tình huống công sở — Dual Dictionary.', url: canonical, inLanguage: 'vi', isPartOf: { '@type': 'WebSite', name: 'Dual Dictionary', url: `${SITE}/vi/` } },
      { '@type': 'ItemList', name: 'TOEIC theo tình huống', numberOfItems: topics.length, itemListElement: items },
      { '@type': 'BreadcrumbList', itemListElement: [ { '@type': 'ListItem', position: 1, name: 'Trang chủ', item: `${SITE}/vi/` }, { '@type': 'ListItem', position: 2, name: 'TOEIC theo tình huống', item: canonical } ] },
    ],
  };
  const html = `<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>TOEIC theo tình huống (12 hub) | Dual Dictionary</title>
<meta name="description" content="12 hub từ vựng TOEIC theo tình huống công sở: họp, email, văn phòng, tuyển dụng, hóa đơn, giao hàng, công tác, khách hàng, hợp đồng, tiếp thị, tài chính, báo cáo — Dual Dictionary.">
<link rel="canonical" href="${canonical}">
<meta name="robots" content="index, follow">
<meta property="og:type" content="article">
<meta property="og:locale" content="vi_VN">
<meta property="og:site_name" content="Dual Dictionary">
<meta property="og:url" content="${canonical}">
<meta property="og:title" content="TOEIC theo tình huống (12 hub)">
<meta property="og:description" content="12 hub từ vựng TOEIC theo tình huống công sở: họp, email, văn phòng, tuyển dụng, hóa đơn, giao hàng, công tác, khách hàng, hợp đồng, tiếp thị, tài chính, báo cáo.">
<link rel="stylesheet" href="/vi/blog/blog.css">
<link rel="stylesheet" href="/vi/tu/word.css">
<script type="application/ld+json">${JSON.stringify(jsonLd)}</` + `script>
</head>
<body class="word-page">
${navHtml('toeic')}
<nav class="breadcrumb" aria-label="Breadcrumb"><a href="/vi/">Trang chủ</a> › <span aria-current="page">TOEIC theo tình huống</span></nav>
<main class="page">
  <p class="word-kicker">Từ vựng TOEIC theo tình huống</p>
  <h1 style="font-size:2.2rem">TOEIC theo tình huống (12 hub)</h1>
  <p style="color:var(--muted)">161 cụm TOEIC Business + từ kinh doanh, chia vào 12 tình huống công sở hay gặp nhất trong đề: họp, email, văn phòng, tuyển dụng, hóa đơn/thanh toán, giao hàng, công tác, chăm sóc khách hàng, hợp đồng, tiếp thị, tài chính, báo cáo. Muốn xem toàn bộ không chia hub: <a href="/vi/tu/toeic/">Bộ TOEIC Business →</a>.</p>
  <ul class="hub-list" style="columns:1;gap:20px;padding-left:18px;line-height:2">
${rows}
  </ul>
</main>
<footer class="blog-footer"><p><a href="/vi/">Dual Dictionary</a> — từ điển &amp; công cụ học từ vựng offline-first cho người Việt.</p></footer>
</body>
</html>
`;
  fs.writeFileSync(path.join(OUT_DIR, 'index.html'), html);
}

function main() {
  const data = JSON.parse(fs.readFileSync(path.join(REPO, 'data', 'toeic-situations.json'), 'utf8'));
  const topics = data.topics || [];
  if (topics.length !== 12) throw new Error(`expected 12 toeic hubs, got ${topics.length}`);
  const ipa = loadIpa();

  fs.mkdirSync(OUT_DIR, { recursive: true });
  for (const t of topics) {
    const dir = path.join(OUT_DIR, t.slug);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'index.html'), topicPageHtml(t, ipa));
  }
  writeHubIndex(topics, ipa);

  // regenerate topics.xml: keep IELTS topics + append 12 toeic hub urls (single file, no new sitemap registration)
  const chuDeDir = path.join(REPO, 'vi', 'chu-de');
  let ieltsUrls = [];
  try {
    const tdata = JSON.parse(fs.readFileSync(path.join(REPO, 'data', 'topics.json'), 'utf8'));
    const awlDirs = fs.readdirSync(chuDeDir, { withFileTypes: true })
      .filter((d) => d.isDirectory() && /^awl-\d+$/.test(d.name))
      .map((d) => d.name)
      .sort((a, b) => parseInt(a.slice(4), 10) - parseInt(b.slice(4), 10));
    ieltsUrls = [`https://dualdictionary.netlify.app/vi/chu-de/`,
      ...awlDirs.map((d) => `https://dualdictionary.netlify.app/vi/chu-de/${d}/`),
      ...(tdata.topics || []).map((t) => `https://dualdictionary.netlify.app/vi/chu-de/${t.slug}/`)];
  } catch (e) { ieltsUrls = []; }
  const LM = new Date().toISOString().slice(0, 10);
  const toeicUrls = [`https://dualdictionary.netlify.app/vi/toeic/`,
    ...topics.map((t) => `https://dualdictionary.netlify.app/vi/toeic/${t.slug}/`)];
  const urls = [...ieltsUrls, ...toeicUrls];
  fs.mkdirSync(path.join(REPO, 'vi', 'tu', 'sitemap'), { recursive: true });
  fs.writeFileSync(path.join(REPO, 'vi', 'tu', 'sitemap', 'topics.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `  <url><loc>${u}</loc><lastmod>${LM}</lastmod><changefreq>monthly</changefreq><priority>0.8</priority></url>`).join('\n')}\n</urlset>\n`);

  // sitemap.xml registration (idempotent — topics.xml already registered by IELTS builder)
  const smPath = path.join(REPO, 'sitemap.xml');
  let sm = fs.readFileSync(smPath, 'utf8');
  if (!sm.includes('sitemap/topics.xml')) {
    sm = sm.replace('</sitemapindex>',
      `  <sitemap>\n    <loc>https://dualdictionary.netlify.app/vi/tu/sitemap/topics.xml</loc>\n    <lastmod>${LM}</lastmod>\n  </sitemap>\n</sitemapindex>`);
    fs.writeFileSync(smPath, sm);
  }

  const total = topics.reduce((a, t) => a + t.words.length + t.phrases.length, 0);
  console.log(`TOEIC-HUBS: ${topics.length} hubs, ${total} items + hub index + sitemap (${urls.length} urls, ${toeicUrls.length} toeic)`);
}

if (require.main === module) {
  main();
}
