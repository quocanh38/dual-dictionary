#!/usr/bin/env node
/* P1 collection pages (owner-approved 01/11): 3 static tag pages for SEO
 * topical authority — /vi/tu/ielts/ /vi/tu/toeic/ /vi/tu/giao-tiep/.
 * Each: unique H1 + description + full link list (SEO) + deck CTA + hub links.
 * Owned by NO manifest (like cum-tu hub): neither builder wipes them.
 * Run AFTER both builders: node tools/build-collection-pages.cjs */
const fs = require('fs');
const path = require('path');
const core = require('./build-word-pages.cjs');
const { phraseSlug } = require('./build-phrase-pages.cjs');
const { navHtml } = require('./nav-partial.cjs');

const REPO = path.join(__dirname, '..');
const OUT_DIR = path.join(REPO, 'vi', 'tu');
const SITE = core.SITE;

const BIZ_WORDS = 'account bank balance invoice payment budget finance marketing sales contract meeting office shipping delivery order customer client employee manager payroll revenue profit audit tax loan credit stock share board quarter expense claim warranty supplier retail import export freight cargo warehouse inventory deadline overtime salary conference proposal dividend interest mortgage insurance premium booking memo agenda'.split(' ');

function pageHtml({ slug, h1, desc, intro, groups, deckCta }) {
  const canonical = `${SITE}/vi/tu/${slug}/`;
  const SSR_N = 300;
  const restByGroup = {};
  const sections = groups.map((g, gi) => {
    const all = g.items.map((it) =>
      `    <li data-word="${core.escapeHtml(it.slug)}"><a href="${it.href}">${core.escapeHtml(it.label)}</a>${it.ipa ? ` <span class="hub-ipa">/${core.escapeHtml(it.ipa)}/</span>` : ''}</li>`).join('\n');
    const shown = g.items.slice(0, SSR_N).map((it) =>
      `    <li data-word="${core.escapeHtml(it.slug)}"><a href="${it.href}">${core.escapeHtml(it.label)}</a>${it.ipa ? ` <span class="hub-ipa">/${core.escapeHtml(it.ipa)}/</span>` : ''}</li>`).join('\n');
    const rest = g.items.slice(SSR_N).map((it) =>
      `    <li data-word="${core.escapeHtml(it.slug)}"><a href="${it.href}">${core.escapeHtml(it.label)}</a>${it.ipa ? ` <span class="hub-ipa">/${core.escapeHtml(it.ipa)}/</span>` : ''}</li>`).join('\n');
    if (rest) restByGroup[gi] = rest;
    const more = g.items.length > SSR_N ? `\n  <p data-more-wrap="${gi}" style="margin:10px 0 0"><button type="button" data-more="${gi}" class="related-chip" style="cursor:pointer">Hiện thêm (${(g.items.length - SSR_N).toLocaleString('vi-VN')} mục còn lại)</button></p>` : '';
    return `  <h2>${core.escapeHtml(g.title)}</h2>\n  <ul class="hub-list" data-hub="${gi}" style="columns:3;gap:20px;padding-left:18px;line-height:2">\n${shown}\n  </ul>${more}`;
  }).join('\n');
  pageHtml.restByGroup = restByGroup;
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
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Trang chủ', item: `${SITE}/vi/` },
          { '@type': 'ListItem', position: 2, name: 'Từ điển', item: `${SITE}/vi/tu/` },
          { '@type': 'ListItem', position: 3, name: h1, item: canonical },
        ],
      },
    ],
  };
  return `<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${core.escapeHtml(h1)} | Dual Dictionary</title>
<meta name="description" content="${core.escapeHtml(desc)}">
<link rel="canonical" href="${canonical}">
<meta name="robots" content="index, follow">
<meta property="og:type" content="article">
<meta property="og:locale" content="vi_VN">
<meta property="og:site_name" content="Dual Dictionary">
<meta property="og:url" content="${canonical}">
<meta property="og:title" content="${core.escapeHtml(h1)}">
<meta property="og:description" content="${core.escapeHtml(desc)}">
<meta name="twitter:card" content="summary">
<meta name="twitter:title" content="${core.escapeHtml(h1)}">
<link rel="stylesheet" href="/vi/blog/blog.css">
<link rel="stylesheet" href="/vi/tu/word.css">
<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
</head>
<body class="word-page">
${navHtml(slug === 'giao-tiep' ? 'tu' : slug)}
<nav class="breadcrumb" aria-label="Breadcrumb"><a href="/vi/">Trang chủ</a> › <a href="/vi/tu/">Từ điển</a> › <span aria-current="page">${core.escapeHtml(h1)}</span></nav>
<main class="page">
  <p class="word-kicker">Bộ từ theo mục tiêu</p>
  <h1 style="font-size:2.2rem">${core.escapeHtml(h1)}</h1>
  <p style="color:var(--muted)">${intro}</p>
  <p style="margin:12px 0 0"><a class="related-chip" style="text-decoration:none" href="${deckCta.href}">${deckCta.label} ↗</a> <a href="/vi/tu/">Tất cả từ →</a> · <a href="/vi/tu/cum-tu/">Tất cả cụm →</a> · <a href="/vi/chu-de/">Chủ đề học thuật (AWL) →</a> · <a href="/vi/phan-biet/">Phân biệt dễ nhầm →</a> · <a href="/vi/loi-sai/">Lỗi sai thường gặp →</a></p>
  <div class="hub-filters">
    <input id="hub-q" type="search" placeholder="Tìm trong bộ này…" aria-label="Tìm trong bộ này">
    <span id="hub-count" aria-live="polite"></span>
  </div>
${sections}
</main>
<footer class="blog-footer"><p><a href="/vi/">Dual Dictionary</a> — từ điển &amp; công cụ học từ vựng offline-first cho người Việt.</p></footer>
<script>
(function () {
  var q = document.getElementById('hub-q');
  var count = document.getElementById('hub-count');
  function allItems() { return Array.prototype.slice.call(document.querySelectorAll('.hub-list li')); }
  function loadRest(gi, cb) {
    var ul = document.querySelector('ul[data-hub="' + gi + '"]');
    if (!ul || ul.dataset.full === '1') return cb && cb();
    /* link-check-safe: explicit per-group URL (no string concat), mirrors
     * the hub-rest-{gi}.js files the builder wrote. */
    var urls = {'0': 'hub-rest-0.js', '1': 'hub-rest-1.js', '2': 'hub-rest-2.js'};
    var s = document.createElement('script');
    s.src = urls[String(gi)] || ('hub-rest-' + '' + gi + '.js');
    s.onload = function () {
      var html = (window.__COLL_REST__ && window.__COLL_REST__[gi]) || '';
      if (html) ul.insertAdjacentHTML('beforeend', html);
      ul.dataset.full = '1';
      var w = document.querySelector('[data-more-wrap="' + gi + '"]');
      if (w) w.style.display = 'none';
      cb && cb();
    };
    s.onerror = function () { cb && cb(); };
    document.head.appendChild(s);
  }
  function apply() {
    var term = q.value.trim().toLowerCase();
    if (term) {
      // searching implies full lists: load all rests once, then filter
      var uls = Array.prototype.slice.call(document.querySelectorAll('ul[data-hub]'));
      var pending = uls.filter(function (u) { return u.dataset.full !== '1'; });
      if (pending.length && !window.__COLL_LOADING__) {
        window.__COLL_LOADING__ = true;
        var left = pending.length;
        pending.forEach(function (u) {
          loadRest(u.getAttribute('data-hub'), function () { if (--left === 0) { window.__COLL_LOADING__ = false; apply(); } });
        });
        return;
      }
      if (window.__COLL_LOADING__) return;
    }
    var shown = 0, items = allItems();
    for (var it of items) {
      var ok = !term || (it.dataset.word || '').indexOf(term) !== -1;
      it.style.display = ok ? '' : 'none';
      if (ok) shown++;
    }
    count.textContent = 'Hiển thị ' + shown + '/' + items.length;
  }
  document.querySelectorAll('[data-more]').forEach(function (b) {
    b.addEventListener('click', function () { loadRest(b.getAttribute('data-more'), apply); });
  });
  q.addEventListener('input', apply); q.addEventListener('change', apply);
  apply();
})();
</script>
</body>
</html>
`;
}

async function main() {
  const examTags = JSON.parse(fs.readFileSync(path.join(REPO, 'data', 'exam-tags.json'), 'utf8'));
  const wm = JSON.parse(fs.readFileSync(path.join(REPO, 'docs', 'wordpages-manifest.json'), 'utf8'));
  const pm = JSON.parse(fs.readFileSync(path.join(REPO, 'docs', 'phrasepages-manifest.json'), 'utf8'));
  const qa = JSON.parse(fs.readFileSync(path.join(REPO, 'docs', 'wordpages-qa.json'), 'utf8'));
  const ipaByWord = {};
  for (const r of qa.ipa || []) if (r.ipa) ipaByWord[r.word] = r.ipa;
  const wordSet = new Set(wm.slugs || []);
  const phraseBySlug = {};
  for (const e of pm.entries || []) phraseBySlug[e.slug] = e.phrase;

  const wUrl = (w) => `/vi/tu/${encodeURIComponent(w)}/`;
  const pUrl = (s) => `/vi/tu/${encodeURIComponent(s)}/`;
  const wItem = (w) => ({ slug: w, label: w, href: wUrl(w), ipa: ipaByWord[w] || '' });
  const pItem = (s) => ({ slug: s, label: phraseBySlug[s] || s.replace(/-/g, ' '), href: pUrl(s), ipa: '' });

  const ieltsWords = Object.keys(examTags.words || {}).filter((w) => (examTags.words[w].tags || []).includes('ielts') && wordSet.has(w)).sort();
  const gtWords = Object.keys(examTags.words || {}).filter((w) => (examTags.words[w].tags || []).includes('giao-tiep') && wordSet.has(w)).sort();
  const toeicPhrases = Object.keys(examTags.phrases || {}).filter((s) => (examTags.phrases[s].tags || []).includes('toeic') && phraseBySlug[s]).sort();
  const ieltsPhrases = Object.keys(examTags.phrases || {}).filter((s) => (examTags.phrases[s].tags || []).includes('ielts') && phraseBySlug[s]).sort();
  const bizWords = BIZ_WORDS.filter((w) => wordSet.has(w)).sort();

  const pages = [
    {
      slug: 'ielts',
      h1: `2263 từ vựng IELTS Core — học thuật + tần suất cao`,
      desc: `Bộ 2263 từ vựng IELTS Core (AWL + NGSL top 2000) kèm phiên âm Anh-Mỹ/Anh-Anh, nghĩa tiếng Việt, ví dụ thi viết tay và bài luyện trong app Dual Dictionary.`,
      intro: `Bộ từ IELTS Core gồm <b>${ieltsWords.length.toLocaleString('vi-VN')} từ đơn</b> (thuộc Academic Word List của Coxhead hoặc NGSL top 2000) và <b>${ieltsPhrases.length} cụm học thuật</b>. Mỗi từ có trang riêng: phiên âm Mỹ + Anh, nghĩa thi lên đầu, ví dụ IELTS viết tay. Học xong bấm nút luyện để chạy deck IELTS Core trong app — miễn phí, offline.`,
      groups: [
        { title: `Từ đơn IELTS (${ieltsWords.length})`, items: ieltsWords.map(wItem) },
        ...(ieltsPhrases.length ? [{ title: `Cụm học thuật (${ieltsPhrases.length})`, items: ieltsPhrases.map(pItem) }] : []),
      ],
      deckCta: { href: '/?deck=ielts', label: '🎯 Luyện IELTS Core' },
    },
    {
      slug: 'toeic',
      h1: `Cụm từ TOEIC Business — 161 cụm công sở + từ kinh doanh`,
      desc: `Bộ 161 cụm từ TOEIC Business (bank account, balance sheet, cash flow…) + 44 từ kinh doanh kèm nghĩa tiếng Việt, ví dụ công sở viết tay và bài luyện trong app Dual Dictionary.`,
      intro: `Bộ TOEIC Business gồm <b>${toeicPhrases.length} cụm từ công sở</b> (tài chính, ngân hàng, văn phòng, thuế) và <b>${bizWords.length} từ kinh doanh lõi</b>. Mỗi cụm có trang riêng: nghĩa Việt biên soạn tay, cấu trúc đi kèm, ví dụ Part 7 viết tay. Học xong bấm nút luyện để chạy deck TOEIC mix (5 từ + 5 cụm mỗi lượt) trong app.`,
      groups: [
        { title: `Cụm TOEIC (${toeicPhrases.length})`, items: toeicPhrases.map(pItem) },
        { title: `Từ kinh doanh (${bizWords.length})`, items: bizWords.map(wItem) },
      ],
      deckCta: { href: '/?deck=toeic', label: '💼 Luyện TOEIC Business' },
    },
    {
      slug: 'giao-tiep',
      h1: `742 từ giao tiếp nền — NGSL top 1000`,
      desc: `Bộ 742 từ giao tiếp nền (NGSL top 1000, tần suất cao) kèm phiên âm, nghĩa tiếng Việt và ví dụ — nền tảng trước khi học IELTS/TOEIC.`,
      intro: `Bộ giao tiếp gồm <b>${gtWords.length} từ nền</b> thuộc NGSL top 1000 với tần suất phụ đề top 2K — nghe là gặp, nói là dùng. Mỗi từ có trang riêng: phiên âm Mỹ + Anh, ví dụ song ngữ. Học chắc bộ này rồi hẵng lên IELTS Core.`,
      groups: [{ title: `Từ giao tiếp (${gtWords.length})`, items: gtWords.map(wItem) }],
      deckCta: { href: '/?deck=ngsl1', label: '🎯 Luyện bộ giao tiếp' },
    },
  ];

  for (const p of pages) {
    const dir = path.join(OUT_DIR, p.slug);
    fs.mkdirSync(dir, { recursive: true });
    const html = pageHtml(p);
    fs.writeFileSync(path.join(dir, 'index.html'), html);
    /* Rest rows -> external hub-rest-{gi}.js (crawl-triage: SSR shell only). */
    const rest = pageHtml.restByGroup || {};
    for (const [gi, rows] of Object.entries(rest)) {
      fs.writeFileSync(path.join(dir, `hub-rest-${gi}.js`), `window.__COLL_REST__=window.__COLL_REST__||{};window.__COLL_REST__[${gi}]=${JSON.stringify(rows)};`);
    }
    console.log(`COLLECTION: /vi/tu/${p.slug}/ — ${p.groups.map((g) => g.items.length).join('+')} items`);
  }
}

if (require.main === module) {
  main().catch((e) => { console.error('FATAL:', e); process.exit(1); });
}
module.exports = { BIZ_WORDS };
