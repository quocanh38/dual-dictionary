#!/usr/bin/env node
/* Grammar hubs (owner task 03/11): /vi/ngu-phap/{slug}/ x10 + hub index
 * + regenerate grammar.xml (hub + 10 guides) + sitemap.xml registration.
 * Data: data/grammar.json {guides:[{slug,name,intro,rules[5],mistakes[5 {t,fix,slug|null}],sentences[5 {en,vi}]}]}.
 * mistakes[] with a slug get <a href="/vi/loi-sai/{slug}/"> ONLY if that page
 * exists on disk (verified at build time); slug:null or missing page renders
 * as plain text — never a dead link.
 * Conventions copied from tools/build-topic-pages.cjs: head/meta/CSS,
 * CollectionPage+ItemList+BreadcrumbList+FAQPage JSON-LD, TL;DR (.tldr) +
 * SpeakableSpecification, navHtml('ngu-phap'), hub filter search box.
 * Safe: only writes vi/ngu-phap/**, vi/tu/sitemap/grammar.xml,
 * data/grammar.json (input). Never touches vi/loi-sai/** or mistakes.json.
 * Run AFTER word/phrase/mistake builders (order irrelevant — links verified).
 */
const fs = require('fs');
const path = require('path');
const core = require('./build-word-pages.cjs');

const REPO = path.join(__dirname, '..');
const OUT_DIR = path.join(REPO, 'vi', 'ngu-phap');
const SITE = core.SITE;
const esc = core.escapeHtml;
const { navHtml } = require('./nav-partial.cjs');
const { blogLinksHtml } = require('./blog-links-lib.cjs');

function mistakeSlugExists(slug) {
  try {
    return fs.statSync(path.join(REPO, 'vi', 'loi-sai', slug, 'index.html')).isFile();
  } catch (e) { return false; }
}

const FILTER_JS = `<script>
(function () {
  var q = document.getElementById('hub-q');
  var count = document.getElementById('hub-count');
  var items = Array.prototype.slice.call(document.querySelectorAll('.hub-list li'));
  function apply() {
    var term = q.value.trim().toLowerCase(), shown = 0;
    for (var it of items) {
      var ok = !term || (it.textContent || '').toLowerCase().indexOf(term) !== -1;
      it.style.display = ok ? '' : 'none';
      if (ok) shown++;
    }
    count.textContent = 'Hiển thị ' + shown + '/' + items.length;
  }
  q.addEventListener('input', apply); q.addEventListener('change', apply);
  apply();
})();
</script>`;

function guidePageHtml(g) {
  const canonical = `${SITE}/vi/ngu-phap/${g.slug}/`;
  const h1 = `${g.name} — quy tắc + lỗi sai thường gặp`;
  const desc = `${g.name}: 5 quy tắc ngắn gọn, 5 lỗi sai người Việt hay mắc và 5 câu đúng song ngữ — Dual Dictionary.`.slice(0, 160);
  const tldr = `Tóm tắt: ${g.rules[0]} Xem 5 quy tắc, 5 lỗi điển hình và 5 câu đúng song ngữ bên dưới.`;
  const ruleRows = g.rules.map((r) => `    <li>${esc(r)}</li>`).join('\n');
  const mistRows = g.mistakes.map((m, i) => {
    const body = `\u274C \u201C${esc(m.t)}\u201D \u2192 ${esc(m.fix)}`;
    const inner = (m.slug && mistakeSlugExists(m.slug))
      ? `<a href="/vi/loi-sai/${encodeURIComponent(m.slug)}/">${body} \u2192</a>`
      : `<span class="mist-text">${body}</span>`;
    return `    <li id="loi-${i + 1}">${inner}</li>`;
  }).join('\n');
  const sentRows = g.sentences.map((s) => `    <li><span class="sent-en">${esc(s.en)}</span> — <span class="sent-vi">${esc(s.vi)}</span></li>`).join('\n');
  const itemList = g.mistakes.map((m, i) => ({
    '@type': 'ListItem',
    position: i + 1,
    name: `\u0110\u1EEBng n\u00F3i \u201C${m.t}\u201D \u2192 ${m.fix}`,
    url: (m.slug && mistakeSlugExists(m.slug)) ? `${SITE}/vi/loi-sai/${m.slug}/` : `${canonical}#loi-${i + 1}`,
  }));
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
      { '@type': 'ItemList', name: `${g.name} — lỗi sai điển hình`, numberOfItems: g.mistakes.length, itemListElement: itemList },
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
            name: `Quy tắc chính của ${g.name} là gì?`,
            acceptedAnswer: { '@type': 'Answer', text: g.rules.join(' ') },
          },
          {
            '@type': 'Question',
            name: `Lỗi ${g.name} nào người Việt hay mắc nhất?`,
            acceptedAnswer: { '@type': 'Answer', text: g.mistakes.map((m) => `\u201C${m.t}\u201D \u2192 ${m.fix}.`).join(' ') },
          },
          {
            '@type': 'Question',
            name: `Câu mẫu đúng của ${g.name}?`,
            acceptedAnswer: { '@type': 'Answer', text: g.sentences.map((s) => s.en).join(' ') },
          },
        ],
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Trang chủ', item: `${SITE}/vi/` },
          { '@type': 'ListItem', position: 2, name: 'Ngữ pháp', item: `${SITE}/vi/ngu-phap/` },
          { '@type': 'ListItem', position: 3, name: g.name, item: canonical },
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
<meta name="twitter:card" content="summary">
<meta name="twitter:title" content="${esc(h1)}">
<link rel="stylesheet" href="/vi/blog/blog.css">
<link rel="stylesheet" href="/vi/tu/word.css">
<style>.tldr{background:var(--soft);border-left:4px solid var(--teal);border-radius:0 10px 10px 0;padding:12px 16px;font-size:1.02rem;line-height:1.7}.mist-text{color:#991b1b}.sent-en{color:#065f46;font-weight:600}.hub-list li{margin:4px 0}</style>
<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
</head>
<body class="word-page">
${navHtml('ngu-phap')}
<nav class="breadcrumb" aria-label="Breadcrumb"><a href="/vi/">Trang chủ</a> › <a href="/vi/ngu-phap/">Ngữ pháp</a> › <span aria-current="page">${esc(g.name)}</span></nav>
<main class="page">
  <p class="word-kicker">Ngữ pháp theo lỗi sai</p>
  <h1 style="font-size:2.2rem">${esc(h1)}</h1>
  <p class="tldr">${esc(tldr)}</p>
  <p style="color:var(--muted)">${esc(g.intro)}</p>
  <h2>5 quy tắc ngắn gọn</h2>
  <ol>
${ruleRows}
  </ol>
  <h2>5 lỗi sai điển hình</h2>
  <ul class="hub-list" style="padding-left:18px;line-height:2">
${mistRows}
  </ul>
  <h2>5 câu đúng song ngữ</h2>
  <ul style="padding-left:18px;line-height:2">
${sentRows}
  </ul>
  <div class="cmp-links">
    <a class="related-chip" href="/vi/ngu-phap/">Tất cả chủ điểm ngữ pháp →</a>
    <a class="related-chip" href="/vi/loi-sai/">Tất cả lỗi sai →</a>
  </div>
  ${blogLinksHtml(`/vi/ngu-phap/${g.slug}/`)}
</main>
<footer class="blog-footer"><p><a href="/vi/">Dual Dictionary</a> — từ điển &amp; công cụ học từ vựng offline-first cho người Việt.</p></footer>
</body>
</html>
`;
}

function hubIndexHtml(guides) {
  const canonical = `${SITE}/vi/ngu-phap/`;
  const title = `${guides.length} chủ điểm ngữ pháp theo lỗi sai thường gặp`;
  const desc = `Ngữ pháp tiếng Anh theo 10 chủ điểm (${guides.map((g) => g.name).join(', ')}) — mỗi chủ điểm 5 quy tắc, 5 lỗi sai và 5 câu đúng song ngữ.`;
  const rows = guides.map((g) =>
    `    <li><a href="/vi/ngu-phap/${g.slug}/">${esc(g.name)} — quy tắc + lỗi sai thường gặp</a> <span style="color:var(--muted)">(${esc(g.mistakes[0].t)}…)</span></li>`).join('\n');
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'CollectionPage', name: title, url: canonical, inLanguage: 'vi' },
      {
        '@type': 'ItemList',
        name: title,
        itemListElement: guides.map((g, i) => ({
          '@type': 'ListItem', position: i + 1, name: `${g.name} — quy tắc + lỗi sai thường gặp`, url: `${SITE}/vi/ngu-phap/${g.slug}/`,
        })),
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Trang chủ', item: `${SITE}/vi/` },
          { '@type': 'ListItem', position: 2, name: 'Ngữ pháp' },
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
<title>${esc(title)} | Dual Dictionary</title>
<meta name="description" content="${esc(desc.slice(0, 160))}">
<link rel="canonical" href="${canonical}">
<meta name="robots" content="index, follow">
<meta property="og:type" content="website">
<meta property="og:locale" content="vi_VN">
<meta property="og:site_name" content="Dual Dictionary">
<meta property="og:url" content="${canonical}">
<meta property="og:title" content="${esc(title)} | Dual Dictionary">
<meta name="twitter:card" content="summary">
<link rel="stylesheet" href="/vi/blog/blog.css">
<link rel="stylesheet" href="/vi/tu/word.css">
<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
</head>
<body class="word-page">
${navHtml('ngu-phap')}
<nav class="breadcrumb" aria-label="Breadcrumb"><a href="/vi/">Trang chủ</a> › <span aria-current="page">Ngữ pháp</span></nav>
<main class="page">
  <p class="word-kicker">Ngữ pháp theo lỗi sai</p>
  <h1 style="font-size:2.2rem">${esc(title)}</h1>
  <p style="color:var(--muted)">Học ngữ pháp từ chính lỗi người Việt hay mắc — mỗi chủ điểm 5 quy tắc ngắn gọn, 5 lỗi điển hình link sang trang lỗi sai, 5 câu đúng song ngữ.</p>
  <div class="hub-filters">
    <input id="hub-q" type="search" placeholder="Tìm chủ điểm…" aria-label="Tìm chủ điểm ngữ pháp">
    <span id="hub-count" aria-live="polite"></span>
  </div>
  <ul class="hub-list" style="columns:1;gap:20px;padding-left:18px;line-height:2">
${rows}
  </ul>
</main>
<footer class="blog-footer"><p><a href="/vi/">Dual Dictionary</a> — từ điển &amp; công cụ học từ vựng offline-first cho người Việt.</p></footer>
${FILTER_JS}
</body>
</html>
`;
}

function main() {
  const data = JSON.parse(fs.readFileSync(path.join(REPO, 'data', 'grammar.json'), 'utf8'));
  const guides = data.guides || [];
  if (guides.length !== 10) throw new Error(`expected 10 guides, got ${guides.length}`);
  for (const g of guides) {
    if (!g.slug || !g.name || (g.rules || []).length !== 5) throw new Error(`guide ${g.slug}: need slug+name+5 rules`);
    if ((g.mistakes || []).length !== 5) throw new Error(`guide ${g.slug}: need 5 mistakes`);
    if ((g.sentences || []).length !== 5) throw new Error(`guide ${g.slug}: need 5 sentences`);
    for (const m of g.mistakes) {
      if (m.slug && !mistakeSlugExists(m.slug)) throw new Error(`guide ${g.slug}: loi-sai slug missing on disk: ${m.slug}`);
    }
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  for (const g of guides) {
    const dir = path.join(OUT_DIR, g.slug);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'index.html'), guidePageHtml(g));
  }
  fs.writeFileSync(path.join(OUT_DIR, 'index.html'), hubIndexHtml(guides));

  // grammar.xml: hub + 10 guides
  const LM = new Date().toISOString().slice(0, 10);
  const urls = [`https://dualdictionary.netlify.app/vi/ngu-phap/`,
    ...guides.map((g) => `https://dualdictionary.netlify.app/vi/ngu-phap/${g.slug}/`)];
  fs.writeFileSync(path.join(REPO, 'vi', 'tu', 'sitemap', 'grammar.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `  <url><loc>${u}</loc><lastmod>${LM}</lastmod><changefreq>monthly</changefreq><priority>0.8</priority></url>`).join('\n')}\n</urlset>\n`);

  // sitemap.xml registration (idempotent)
  const smPath = path.join(REPO, 'sitemap.xml');
  let sm = fs.readFileSync(smPath, 'utf8');
  if (!sm.includes('sitemap/grammar.xml')) {
    sm = sm.replace('</sitemapindex>',
      `  <sitemap>\n    <loc>https://dualdictionary.netlify.app/vi/tu/sitemap/grammar.xml</loc>\n    <lastmod>${LM}</lastmod>\n  </sitemap>\n</sitemapindex>`);
    fs.writeFileSync(smPath, sm);
  }

  const linked = guides.reduce((a, g) => a + g.mistakes.filter((m) => m.slug).length, 0);
  console.log(`GRAMMAR: ${guides.length} hubs + hub index + sitemap (${urls.length} urls), mistakes linked ${linked}/50`);
}

if (require.main === module) {
  main();
}
