#!/usr/bin/env node
/* AWL sublist pages (owner-approved 01/11): /vi/chu-de/awl-{1..10}/ + hub /vi/chu-de/.
 * Data: data/awl.json {words:{word:sublistNumber}}. Only words WITH a built page
 * (docs/wordpages-manifest.json slugs) are linked. IPA via docs/wordpages-qa.json
 * (same as collection builder), fallback data/ipa-en.json.
 * Owned by NO manifest: never wiped. Run AFTER word builder. */
const fs = require('fs');
const path = require('path');
const core = require('./build-word-pages.cjs');

const REPO = path.join(__dirname, '..');
const OUT_DIR = path.join(REPO, 'vi', 'chu-de');
const SITE = core.SITE;
const esc = core.escapeHtml;
const { navHtml } = require('./nav-partial.cjs');

/* Hand-written intros — one per sublist, each naming its own head words. */
const INTROS = {
  1: `Sublist 1 gồm các từ nền tảng nhất của Academic Word List như <b>data, research, evidence, analysis</b> và <b>method</b> — xuất hiện trong hầu hết mọi passage IELTS Reading, từ khoa học đến kinh tế. Nắm chắc nhóm này, bạn đọc lướt nhanh hơn, và bài Writing Task 2 có “chất học thuật” ngay từ câu thesis với những từ như <b>significant, factor</b> hay <b>indicate</b>.`,
  2: `Sublist 2 xoay quanh đánh giá và tác động: <b>impact, potential, primary, focus, achieve</b> cùng <b>evaluation, consequences</b>. Đây là nhóm từ “ghi điểm” trong IELTS Writing Task 2 khi bàn nguyên nhân–kết quả, và trong Reading khi tác giả nhận định về một chính sách hay công trình nghiên cứu (<b>survey, journal, conclusion</b>).`,
  3: `Sublist 3 là ngôn ngữ của lập luận: <b>framework, criteria, emphasis, demonstrate, ensure</b> cùng <b>justification, validity</b>. Học nhóm này giúp bạn viết Task 2 chặt chẽ hơn — đưa ra <b>criteria</b>, nhấn <b>emphasis</b> đúng chỗ, <b>demonstrate</b> quan điểm thay vì nói suông — và đọc hiểu các passage Reading dạng argumentative.`,
  4: `Sublist 4 gắn với tranh luận và số liệu: <b>debate, contrast, despite, hypothesis, statistics</b> cùng <b>apparent, overall</b>. Gặp dày đặc trong Reading dạng discuss both views và trong Writing Task 1 khi mô tả xu hướng (<b>output, summary, phase</b>). Các từ nối <b>despite</b> và <b>hence</b> trong nhóm này cũng là “vũ khí” gọn nhẹ cho bài viết.`,
  5: `Sublist 5 nói về thay đổi và thách thức: <b>challenge, conflict, transition, trend, sustainable</b> cùng <b>facilitate, fundamental</b>. Đây chính là từ vựng của các đề môi trường, đô thị hóa và công nghệ — những chủ đề “tủ” của IELTS Writing. Viết được một câu có <b>fundamental shift</b> hay <b>stable trend</b> là bài của bạn đã khác biệt.`,
  6: `Sublist 6 chứa các từ nối và trích dẫn học thuật: <b>furthermore, nevertheless, cited, abstract, explicit</b> cùng <b>rational, scope</b>. Thuộc nhóm này, bài Task 2 của bạn mạch lạc hơn hẳn nhờ liên từ chuẩn (<b>furthermore</b> thay vì lạm dụng moreover), còn khi đọc Reading bạn sẽ quen mắt với <b>cited, author, lecture</b> — dấu hiệu của nguồn trích dẫn.`,
  7: `Sublist 7 là từ vựng của khoa học và hiện tượng toàn cầu: <b>global, phenomenon, empirical, innovation, paradigm</b> cùng <b>dynamic, ultimate</b>. Đọc passage về khí hậu, y học hay vũ trụ mà không biết <b>empirical</b> hay <b>dynamic</b> thì rất dễ mất điểm True/False/Not Given. Nhóm này cũng cho bạn vốn từ “xịn” để viết về technology và environment.`,
  8: `Sublist 8 mang sắc thái mạnh: <b>crucial, bias, contemporary, inevitably, dramatic</b> cùng <b>radical, widespread</b>. Đây là nhóm từ tạo giọng điệu — phân biệt <b>crucial</b> với important, nhận ra <b>bias</b> của tác giả trong Reading, và thể hiện quan điểm dứt khoát trong Task 2 mà không cần dùng từ quá khó.`,
  9: `Sublist 9 trừu tượng và tinh tế hơn: <b>insights, inherent, ethical, controversy, conversely</b> cùng <b>protocol, qualitative</b>. Đúng chất các passage khó (band 7.5+) về triết học, tâm lý, luật pháp. Trong Task 2, dùng <b>conversely</b> để lật luận điểm hay <b>inherent</b> để chỉ bản chất vấn đề sẽ khiến giám khảo chú ý.`,
  10: `Sublist 10 là nhóm cuối — ít từ nhưng toàn “hàng hiếm”: <b>albeit, nonetheless, notwithstanding, whereby, likewise</b> cùng <b>integrity, intrinsic</b>. Phần lớn là từ nối và liên từ trang trọng — vũ khí trực tiếp cho tiêu chí Coherence &amp; Cohesion trong Writing. Thuộc nhóm này, bạn thay thế được cả chục cách nối câu đơn điệu.`,
};

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

function sublistPageHtml(n, words, ipa) {
  const count = words.length;
  const canonical = `${SITE}/vi/chu-de/awl-${n}/`;
  const h1 = `Từ vựng học thuật AWL Sublist ${n} (${count} từ)`;
  const sample = words.slice(0, 5).join(', ');
  const desc = `${count} từ AWL Sublist ${n} (${sample}…) kèm phiên âm, nghĩa tiếng Việt, ví dụ IELTS — Dual Dictionary.`.slice(0, 160);
  const rows = words.map((w) =>
    `    <li data-word="${esc(w)}"><a href="/vi/tu/${encodeURIComponent(w)}/">${esc(w)}</a>${ipa[w] ? ` <span class="hub-ipa">/${esc(ipa[w])}/</span>` : ''}</li>`).join('\n');
  const prev = n > 1 ? ` <a href="/vi/chu-de/awl-${n - 1}/">← Sublist ${n - 1}</a>` : '';
  const next = n < 10 ? ` <a href="/vi/chu-de/awl-${n + 1}/">Sublist ${n + 1} →</a>` : '';
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
        '@type': 'ItemList',
        name: `AWL Sublist ${n} — danh sách từ`,
        numberOfItems: count,
        itemListElement: words.map((w, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          name: w,
          item: `${SITE}/vi/tu/${encodeURIComponent(w)}/`,
        })),
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Trang chủ', item: `${SITE}/vi/` },
          { '@type': 'ListItem', position: 2, name: 'Chủ đề', item: `${SITE}/vi/chu-de/` },
          { '@type': 'ListItem', position: 3, name: `AWL Sublist ${n}`, item: canonical },
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
<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
</head>
<body class="word-page">
${navHtml('chu-de')}
<nav class="breadcrumb" aria-label="Breadcrumb"><a href="/vi/">Trang chủ</a> › <a href="/vi/chu-de/">Chủ đề</a> › <span aria-current="page">AWL Sublist ${n}</span></nav>
<main class="page">
  <p class="word-kicker">Academic Word List · Sublist ${n}/10</p>
  <h1 style="font-size:2.2rem">${esc(h1)}</h1>
  <p style="color:var(--muted)">${INTROS[n]}</p>
  <p style="margin:12px 0 0"><a href="/vi/chu-de/">Tất cả chủ đề →</a> · <a href="/vi/tu/ielts/">Bộ IELTS Core →</a>${prev} ·${next}</p>
  <div class="hub-filters">
    <input id="hub-q" type="search" placeholder="Tìm trong sublist này…" aria-label="Tìm trong sublist này">
    <span id="hub-count" aria-live="polite"></span>
  </div>
  <h2>Danh sách ${count} từ</h2>
  <ul class="hub-list" style="columns:3;gap:20px;padding-left:18px;line-height:2">
${rows}
  </ul>
</main>
<footer class="blog-footer"><p><a href="/vi/">Dual Dictionary</a> — từ điển &amp; công cụ học từ vựng offline-first cho người Việt.</p></footer>
${FILTER_JS}
</body>
</html>
`;
}

function hubHtml(subs) {
  const total = subs.reduce((a, s) => a + s.words.length, 0);
  const canonical = `${SITE}/vi/chu-de/`;
  const h1 = `Chủ đề từ vựng: AWL 10 sublist + IELTS, TOEIC, giao tiếp`;
  const desc = `Học từ vựng theo chủ đề: 570 từ Academic Word List (10 sublist), bộ IELTS Core, TOEIC Business, giao tiếp, phân biệt từ dễ nhầm và lỗi sai.`;
  const subRows = subs.map((s) =>
    `    <li><a href="/vi/chu-de/awl-${s.n}/">AWL Sublist ${s.n} — ${s.words.length} từ (${esc(s.words.slice(0, 4).join(', '))}…)</a></li>`).join('\n');
  const topicLinks = [
    { name: 'Từ vựng IELTS Core — học thuật + tần suất cao', url: `${SITE}/vi/tu/ielts/` },
    { name: 'Cụm từ TOEIC Business + từ kinh doanh', url: `${SITE}/vi/tu/toeic/` },
    { name: 'Từ giao tiếp nền — NGSL top 1000', url: `${SITE}/vi/tu/giao-tiep/` },
    { name: 'Phân biệt từ dễ nhầm (IELTS/TOEIC)', url: `${SITE}/vi/phan-biet/` },
    { name: 'Lỗi sai thường gặp của người Việt', url: `${SITE}/vi/loi-sai/` },
    { name: 'Từ vựng đề Cambridge IELTS', url: `${SITE}/vi/cambridge/` },
  ];
  const itemList = {
    '@type': 'ItemList',
    name: h1,
    itemListElement: [
      ...subs.map((s, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: `AWL Sublist ${s.n} — ${s.words.length} từ`,
        url: `${SITE}/vi/chu-de/awl-${s.n}/`,
      })),
      ...topicLinks.map((t, i) => ({
        '@type': 'ListItem',
        position: subs.length + i + 1,
        name: t.name,
        url: t.url,
      })),
    ],
  };
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
          { '@type': 'ListItem', position: 2, name: 'Chủ đề', item: canonical },
        ],
      },
      itemList,
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
<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
</head>
<body class="word-page">
${navHtml('chu-de')}
<nav class="breadcrumb" aria-label="Breadcrumb"><a href="/vi/">Trang chủ</a> › <a href="/vi/tu/">Từ điển</a> › <span aria-current="page">Chủ đề</span></nav>
<main class="page">
  <p class="word-kicker">Học theo chủ đề</p>
  <h1 style="font-size:2.2rem">${esc(h1)}</h1>
  <p style="color:var(--muted)">Academic Word List (AWL) của Averil Coxhead gồm 570 word family chia thành 10 sublist theo tần suất — sublist 1 phổ biến nhất. Học hết 10 sublist (${total} từ có trang tra cứu) là phủ được phần lớn từ học thuật trong IELTS Reading và Writing Task 2.</p>
  <h2>AWL theo sublist (10)</h2>
  <ul class="hub-list" style="columns:1;gap:20px;padding-left:18px;line-height:2">
${subRows}
  </ul>
  <h2>Bộ từ theo mục tiêu</h2>
  <ul class="hub-list" style="columns:1;gap:20px;padding-left:18px;line-height:2">
    <li><a href="/vi/tu/ielts/">Từ vựng IELTS Core — học thuật + tần suất cao</a></li>
    <li><a href="/vi/tu/toeic/">Cụm từ TOEIC Business + từ kinh doanh</a></li>
    <li><a href="/vi/tu/giao-tiep/">Từ giao tiếp nền — NGSL top 1000</a></li>
  </ul>
  <h2>Kỹ năng &amp; đề thi thật</h2>
  <ul class="hub-list" style="columns:1;gap:20px;padding-left:18px;line-height:2">
    <li><a href="/vi/phan-biet/">Phân biệt từ dễ nhầm (IELTS/TOEIC)</a></li>
    <li><a href="/vi/loi-sai/">Lỗi sai thường gặp của người Việt</a></li>
    <li><a href="/vi/cambridge/">Từ vựng đề Cambridge IELTS</a></li>
  </ul>
</main>
<footer class="blog-footer"><p><a href="/vi/">Dual Dictionary</a> — từ điển &amp; công cụ học từ vựng offline-first cho người Việt.</p></footer>
</body>
</html>
`;
}

function main() {
  const awl = JSON.parse(fs.readFileSync(path.join(REPO, 'data', 'awl.json'), 'utf8'));
  const all = awl.words || {};
  const wm = JSON.parse(fs.readFileSync(path.join(REPO, 'docs', 'wordpages-manifest.json'), 'utf8'));
  const built = new Set(wm.slugs || []);
  const ipa = loadIpa();

  const subs = [];
  for (let n = 1; n <= 10; n++) {
    const words = Object.keys(all).filter((w) => all[w] === n && built.has(w)).sort();
    subs.push({ n, words });
  }
  fs.mkdirSync(OUT_DIR, { recursive: true });
  for (const s of subs) {
    const dir = path.join(OUT_DIR, `awl-${s.n}`);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'index.html'), sublistPageHtml(s.n, s.words, ipa));
  }
  fs.writeFileSync(path.join(OUT_DIR, 'index.html'), hubHtml(subs));

  // sitemap vi/tu/sitemap/topics.xml (hub + 10 sublists)
  const LM = new Date().toISOString().slice(0, 10);
  const urls = [`https://dualdictionary.netlify.app/vi/chu-de/`,
    ...subs.map((s) => `https://dualdictionary.netlify.app/vi/chu-de/awl-${s.n}/`)];
  fs.writeFileSync(path.join(REPO, 'vi', 'tu', 'sitemap', 'topics.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `  <url><loc>${u}</loc><lastmod>${LM}</lastmod><changefreq>monthly</changefreq><priority>0.8</priority></url>`).join('\n')}\n</urlset>\n`);

  // register topics.xml in sitemap.xml (idempotent)
  const smPath = path.join(REPO, 'sitemap.xml');
  let sm = fs.readFileSync(smPath, 'utf8');
  if (!sm.includes('sitemap/topics.xml')) {
    sm = sm.replace('</sitemapindex>',
      `  <sitemap>\n    <loc>https://dualdictionary.netlify.app/vi/tu/sitemap/topics.xml</loc>\n    <lastmod>${LM}</lastmod>\n  </sitemap>\n</sitemapindex>`);
    fs.writeFileSync(smPath, sm);
  }

  const total = subs.reduce((a, s) => a + s.words.length, 0);
  console.log(`AWL: ${subs.length} sublists, ${total} words + hub + sitemap (topics.xml)`);
}

if (require.main === module) {
  main();
}
