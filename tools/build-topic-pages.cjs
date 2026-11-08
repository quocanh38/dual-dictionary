#!/usr/bin/env node
/* IELTS topic hubs (owner-approved 02/11): /vi/chu-de/{slug}/ x15 + patch hub index
 * + regenerate topics.xml (10 awl + 15 topic).
 * Data: data/topics.json {topics:[{slug,name,intro,words[],phrases[]}]} — all slugs verified.
 * Conventions copied from tools/build-awl-pages.cjs: head/meta/CSS/blog.css+word.css,
 * JSON-LD CollectionPage+ItemList+BreadcrumbList, navHtml('chu-de'), hub-filters
 * search box, footer, sitemap registration (idempotent).
 * Safe: never touches vi/chu-de/awl-*. Only: 15 topic dirs, hub index.html patch,
 * topics.xml rewrite (awl dirs discovered from OUT_DIR), data/topics.json (input).
 * Run AFTER word/phrase builders (and after awl builder — order irrelevant). */
const fs = require('fs');
const path = require('path');
const core = require('./build-word-pages.cjs');

const REPO = path.join(__dirname, '..');
const OUT_DIR = path.join(REPO, 'vi', 'chu-de');
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
  const canonical = `${SITE}/vi/chu-de/${t.slug}/`;
  const h1 = `Từ vựng IELTS chủ đề ${t.word} (${n} từ)`;
  const sample = t.words.slice(0, 5).join(', ');
  const desc = `${n} từ vựng IELTS chủ đề ${t.word} (${sample}…) kèm phiên âm, nghĩa tiếng Việt, ví dụ thi thật — Dual Dictionary.`.slice(0, 160);
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
      { '@type': 'ItemList', name: `${t.word} — danh sách từ`, numberOfItems: n, itemListElement: allItems },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Trang chủ', item: `${SITE}/vi/` },
          { '@type': 'ListItem', position: 2, name: 'Chủ đề', item: `${SITE}/vi/chu-de/` },
          { '@type': 'ListItem', position: 3, name: t.word, item: canonical },
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
${navHtml('chu-de')}
<nav class="breadcrumb" aria-label="Breadcrumb"><a href="/vi/">Trang chủ</a> › <a href="/vi/chu-de/">Chủ đề</a> › <span aria-current="page">${esc(t.word)}</span></nav>
<main class="page">
  <p class="word-kicker">Từ vựng IELTS theo chủ đề</p>
  <h1 style="font-size:2.2rem">${esc(h1)}</h1>
  <p style="color:var(--muted)">${t.intro}</p>
  <p style="margin:12px 0 0"><a href="/vi/chu-de/">Tất cả chủ đề →</a> · <a href="/vi/tu/ielts/">Bộ IELTS Core →</a></p>
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

/* Patch hub index: insert "IELTS theo chủ đề (15)" section BEFORE the AWL
 * sublist list (user intent first: thi theo chủ đề, AWL là tham khảo sâu).
 * Idempotent via marker comment. */
function patchHubIndex(topics) {
  const p = path.join(OUT_DIR, 'index.html');
  let html = fs.readFileSync(p, 'utf8');
  if (html.includes('<!-- ielts-topics -->')) {
    // refresh + REORDER (02/11 UX): IELTS topics go BEFORE AWL sublists.
    // strip old section first, then insert fresh at the new anchor.
    html = html.replace(/<!-- ielts-topics -->[\s\S]*?<!-- \/ielts-topics -->\n?/, '');
  }
  const anchor = '  <h2>AWL theo sublist (10)</h2>';
  if (!html.includes(anchor)) throw new Error('hub index anchor not found — awl builder changed?');
  const rows = topics.map((t) =>
    `    <li><a href="/vi/chu-de/${t.slug}/">Từ vựng IELTS chủ đề ${esc(t.word)} — ${t.words.length + t.phrases.length} từ (${esc(t.words.slice(0, 4).join(', '))}…)</a></li>`).join('\n');
  const section = `<!-- ielts-topics -->\n  <h2>IELTS theo chủ đề (15)</h2>\n  <p style="color:var(--muted)">Học từ vựng theo đúng chủ đề ra thi — mỗi chủ đề 60–120 từ/cụm hay gặp trong đề IELTS thật, kèm ví dụ viết tay. Muốn đào sâu từ học thuật theo tần suất, xem 10 sublist AWL bên dưới.</p>\n  <ul class="hub-list" style="columns:1;gap:20px;padding-left:18px;line-height:2">\n${rows}\n  </ul>\n  <!-- /ielts-topics -->\n  ${anchor}`;
  html = html.replace(anchor, section);
  // also extend hub H1/desc? keep AWL H1 (stable); widen intro paragraph slightly
  fs.writeFileSync(p, html);
  return 'patched(new)';
}

function main() {
  const data = JSON.parse(fs.readFileSync(path.join(REPO, 'data', 'topics.json'), 'utf8'));
  const topics = data.topics || [];
  if (topics.length !== 15) throw new Error(`expected 15 topics, got ${topics.length}`);
  const ipa = loadIpa();

  fs.mkdirSync(OUT_DIR, { recursive: true });
  for (const t of topics) {
    const dir = path.join(OUT_DIR, t.slug);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'index.html'), topicPageHtml(t, ipa));
  }
  const hubStatus = patchHubIndex(topics);

  // regenerate topics.xml: hub + awl-* dirs found in OUT_DIR + 15 topics
  const awlDirs = fs.readdirSync(OUT_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory() && /^awl-\d+$/.test(d.name))
    .map((d) => d.name)
    .sort((a, b) => parseInt(a.slice(4), 10) - parseInt(b.slice(4), 10));
  const LM = new Date().toISOString().slice(0, 10);
  const urls = [`https://dualdictionary.netlify.app/vi/chu-de/`,
    ...awlDirs.map((d) => `https://dualdictionary.netlify.app/vi/chu-de/${d}/`),
    ...topics.map((t) => `https://dualdictionary.netlify.app/vi/chu-de/${t.slug}/`)];
  fs.writeFileSync(path.join(REPO, 'vi', 'tu', 'sitemap', 'topics.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `  <url><loc>${u}</loc><lastmod>${LM}</lastmod><changefreq>monthly</changefreq><priority>0.8</priority></url>`).join('\n')}\n</urlset>\n`);

  // sitemap.xml registration (idempotent — same as awl builder)
  const smPath = path.join(REPO, 'sitemap.xml');
  let sm = fs.readFileSync(smPath, 'utf8');
  if (!sm.includes('sitemap/topics.xml')) {
    sm = sm.replace('</sitemapindex>',
      `  <sitemap>\n    <loc>https://dualdictionary.netlify.app/vi/tu/sitemap/topics.xml</loc>\n    <lastmod>${LM}</lastmod>\n  </sitemap>\n</sitemapindex>`);
    fs.writeFileSync(smPath, sm);
  }

  const total = topics.reduce((a, t) => a + t.words.length + t.phrases.length, 0);
  console.log(`TOPICS: ${topics.length} hubs, ${total} items + hub index ${hubStatus} + sitemap (${urls.length} urls, ${awlDirs.length} awl)`);
}

if (require.main === module) {
  main();
}
