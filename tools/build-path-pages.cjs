#!/usr/bin/env node
/* Learning paths 07/11 (vượt top3): /vi/lo-trinh/{slug}/ — Course + HowTo schema.
 * 3 lộ trình từ data sẵn: A2→B1 (30 ngày), IELTS Core (chủ đề), TOEIC 500+ (văn phòng).
 * Dữ liệu: exam-tags (level), topics (chủ đề), toeic hubs — không data mới.
 */
const fs = require('fs'), path = require('path');
const REPO = path.join(__dirname, '..');
const OUT = path.join(REPO, 'vi', 'lo-trinh');
const SITE = 'https://dualdictionary.netlify.app';
const esc = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const { navHtml } = require('./nav-partial.cjs');

const PATHS = [
  {
    slug: 'a2-len-b1-30-ngay', name: 'Lộ trình A2 lên B1 trong 30 ngày',
    desc: 'Mỗi ngày 20 từ + 1 chủ điểm ngữ cảnh: 600 từ nền tảng giao tiếp độc lập trong 30 ngày.',
    days: [
      ['Ngày 1–5: chào hỏi & giới thiệu', 'Học 100 từ A2 giao tiếp đầu tiên: greet, introduce, family, work, daily. Tra từng từ, nghe audio, đặt 1 câu/ngày.', '/vi/trinh-do/a2/'],
      ['Ngày 6–10: mua sắm & ăn uống', 'Từ vựng chợ, giá cả, nhà hàng: price, order, bill, taste, menu. Shadowing 5 phút/ngày.', '/vi/luyen-shadowing/'],
      ['Ngày 11–15: công việc & học tập', 'Từ văn phòng cơ bản: meeting, report, deadline, task, colleague. Viết 3 câu/ngày.', '/vi/trinh-do/a2/'],
      ['Ngày 16–20: du lịch & di chuyển', 'Từ sân bay, khách sạn, hỏi đường: booking, luggage, ticket, map, direction.', '/vi/chu-de/travel/'],
      ['Ngày 21–25: sức khỏe & cảm xúc', 'Từ cơ thể, bệnh nhẹ, cảm xúc: headache, tired, happy, worry, advice.', '/vi/chu-de/health/'],
      ['Ngày 26–30: test & ôn tập', 'Làm test trình độ, ôn 100 từ sai nhiều nhất, chuyển sang B1.', '/vi/test-trinh-do/'],
    ],
  },
  {
    slug: 'ielts-core-theo-chu-de', name: 'Lộ trình IELTS Core theo 15 chủ đề',
    desc: 'Học từ vựng IELTS theo đúng chủ đề ra thi: mỗi chủ đề 60–120 từ, ví dụ viết tay Task 2.',
    days: [
      ['Tuần 1–2: môi trường & sức khỏe', 'environment, health: pollution, sustainable, symptom, treatment + collocations raise awareness.', '/vi/chu-de/environment/'],
      ['Tuần 3–4: giáo dục & công nghệ', 'education, technology: curriculum, device, breakthrough + phân biệt affect/effect.', '/vi/chu-de/education/'],
      ['Tuần 5–6: kinh tế & xã hội', 'economy, society: inflation, policy, urban + lỗi sai economists hay mắc.', '/vi/chu-de/government/'],
      ['Tuần 7–8: luyện đề Cam', 'Từ đã ra Cam 15–19: evidence, significant, theory, method + test trình độ.', '/vi/cambridge/'],
    ],
  },
  {
    slug: 'toeic-500-van-phong', name: 'Lộ trình TOEIC 500+ văn phòng',
    desc: 'Từ vựng văn phòng TOEIC Part 5–7: hợp đồng, email, họp hành, đi công tác.',
    days: [
      ['Tuần 1: email & thông báo', 'subject, attach, confirm, agenda + cụm make an appointment.', '/vi/tu/toeic/'],
      ['Tuần 2: hợp đồng & thanh toán', 'contract, invoice, payment, deadline + phân biệt ensure/insure.', '/vi/phan-biet/ensure-vs-insure/'],
      ['Tuần 3: họp & báo cáo', 'meeting, minutes, proposal, outcome + lỗi sai discussed about.', '/vi/loi-sai/'],
      ['Tuần 4: đề thi & test', 'Luyện Part 5–7, test từ vựng, ôn từ sai.', '/vi/toeic/'],
    ],
  },
];
function pageHtml(p) {
  const canonical = `${SITE}/vi/lo-trinh/${p.slug}/`;
  const steps = p.days.map((d) => ({ '@type': 'HowToStep', name: d[0], text: d[1] }));
  const jsonLd = { '@context': 'https://schema.org', '@graph': [
    { '@type': 'Course', name: p.name, description: p.desc, url: canonical, inLanguage: 'vi',
      provider: { '@type': 'Organization', name: 'Dual Dictionary', sameAs: `${SITE}/vi/` } },
    { '@type': 'HowTo', name: p.name, description: p.desc, inLanguage: 'vi', step: steps },
    { '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Trang chủ', item: `${SITE}/vi/` },
      { '@type': 'ListItem', position: 2, name: 'Lộ trình', item: `${SITE}/vi/lo-trinh/` },
      { '@type': 'ListItem', position: 3, name: p.name },
    ] },
  ] };
  const rows = p.days.map((d) => `<li><strong>${esc(d[0])}</strong><br>${esc(d[1])} <a href="${d[2]}">Học ngay →</a></li>`).join('\n');
  return `<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="theme-color" content="#0f766e">
<title>${esc(p.name)} | Dual Dictionary</title>
<meta name="description" content="${esc(p.desc)}">
<link rel="canonical" href="${canonical}">
<meta name="robots" content="index, follow">
<meta property="og:type" content="article">
<meta property="og:locale" content="vi_VN">
<meta property="og:site_name" content="Dual Dictionary">
<meta property="og:url" content="${canonical}">
<meta property="og:title" content="${esc(p.name)}">
<meta property="og:image" content="${SITE}/vi/images/og-default.jpg">
<meta property="og:image:width" content="1200">
<meta name="twitter:card" content="summary">
<link rel="stylesheet" href="/vi/blog/blog.css">
<link rel="stylesheet" href="/vi/tu/word.css">
<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
</head>
<body class="word-page">
${navHtml('tu')}
<nav class="breadcrumb" aria-label="Breadcrumb"><a href="/vi/">Trang chủ</a> › <a href="/vi/lo-trinh/">Lộ trình</a> › <span aria-current="page">${esc(p.name)}</span></nav>
<main class="page">
  <p class="word-kicker">Lộ trình học</p>
  <h1 style="font-size:2.2rem">${esc(p.name)}</h1>
  <p class="tldr">${esc(p.desc)}</p>
  <ol style="line-height:2">
${rows}
  </ol>
  <div class="cmp-links">
    <a class="related-chip" href="/vi/test-trinh-do/">Test trình độ trước khi bắt đầu →</a>
    <a class="related-chip" href="/vi/lo-trinh/">Tất cả lộ trình →</a>
  </div>
  <p style="color:var(--muted)">Biên soạn bởi <a href="/vi/tac-gia/">Nguyễn Quốc Anh</a></p>
</main>
<footer class="blog-footer"><p><a href="/vi/">Dual Dictionary</a> — từ điển &amp; công cụ học từ vựng offline-first cho người Việt.</p></footer>
</body>
</html>`;
}
function main() {
  fs.mkdirSync(OUT, { recursive: true });
  for (const p of PATHS) {
    fs.mkdirSync(path.join(OUT, p.slug), { recursive: true });
    fs.writeFileSync(path.join(OUT, p.slug, 'index.html'), pageHtml(p));
  }
  const hub = `<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="theme-color" content="#0f766e">
<title>Lộ trình học từ vựng A2–C1, IELTS, TOEIC | Dual Dictionary</title>
<meta name="description" content="3 lộ trình học từ vựng: A2 lên B1 trong 30 ngày, IELTS Core theo chủ đề, TOEIC 500+ văn phòng.">
<link rel="canonical" href="${SITE}/vi/lo-trinh/">
<meta name="robots" content="index, follow">
<meta property="og:type" content="website">
<meta property="og:locale" content="vi_VN">
<meta property="og:site_name" content="Dual Dictionary">
<meta name="twitter:card" content="summary">
<link rel="stylesheet" href="/vi/blog/blog.css">
<link rel="stylesheet" href="/vi/tu/word.css">
<script type="application/ld+json">{"@context":"https://schema.org","@graph":[{"@type":"CollectionPage","name":"Lộ trình học từ vựng","url":"${SITE}/vi/lo-trinh/","inLanguage":"vi"},{"@type":"BreadcrumbList","itemListElement":[{"@type":"ListItem","position":1,"name":"Trang chủ","item":"${SITE}/vi/"},{"@type":"ListItem","position":2,"name":"Lộ trình"}]}]}</script>
</head>
<body class="word-page">
${navHtml('tu')}
<nav class="breadcrumb" aria-label="Breadcrumb"><a href="/vi/">Trang chủ</a> › <span aria-current="page">Lộ trình</span></nav>
<main class="page">
  <p class="word-kicker">Học có lộ trình</p>
  <h1 style="font-size:2.2rem">Lộ trình học từ vựng</h1>
  <ul style="line-height:2">
${PATHS.map((p) => `    <li><a href="/vi/lo-trinh/${p.slug}/">${esc(p.name)}</a> — ${esc(p.desc)}</li>`).join('\n')}
  </ul>
</main>
<footer class="blog-footer"><p><a href="/vi/">Dual Dictionary</a> — từ điển &amp; công cụ học từ vựng offline-first cho người Việt.</p></footer>
</body>
</html>`;
  fs.writeFileSync(path.join(OUT, 'index.html'), hub);
  fs.mkdirSync(path.join(REPO, 'vi', 'tu', 'sitemap'), { recursive: true });
  const LM = new Date().toISOString().slice(0, 10);
  const urls = [`${SITE}/vi/lo-trinh/`, ...PATHS.map((p) => `${SITE}/vi/lo-trinh/${p.slug}/`)];
  fs.writeFileSync(path.join(REPO, 'vi', 'tu', 'sitemap', 'paths.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `  <url><loc>${u}</loc><lastmod>${LM}</lastmod><changefreq>monthly</changefreq><priority>0.8</priority></url>`).join('\n')}\n</urlset>\n`);
  // sitemap tool pages
  const toolUrls = [`${SITE}/vi/luyen-shadowing/`, `${SITE}/vi/widget-tra-tu/`, `${SITE}/vi/test-trinh-do/`, `${SITE}/vi/tac-gia/`];
  fs.writeFileSync(path.join(REPO, 'vi', 'tu', 'sitemap', 'tools.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${toolUrls.map((u) => `  <url><loc>${u}</loc><lastmod>${LM}</lastmod><changefreq>monthly</changefreq><priority>0.8</priority></url>`).join('\n')}\n</urlset>\n`);
  console.log(`PATHS: ${PATHS.length} + hub + 2 sitemaps`);
}
if (require.main === module) main();
