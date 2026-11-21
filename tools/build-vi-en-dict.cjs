#!/usr/bin/env node
/**
 * Builds the Vietnamese -> English reverse dictionary index (data/vi-en-index.json)
 * and the /vi/viet-anh/ interactive SEO page from the canonical /vi/tu/ pages.
 *
 * Output schema (data/vi-en-index.json):
 *   {
 *     "v": 1,
 *     "count": <number>,
 *     "items": [
 *       // [headword, slug, viGloss, tagsStr, ipa]
 *       // tagsStr is space-separated e.g. "C1 IELTS AWL" or "B1 NGSL PHRASE"
 *     ]
 *   }
 */
const fs = require('fs');
const path = require('path');
const { navHtml } = require('./nav-partial.cjs');

const ROOT = path.resolve(__dirname, '..');
const TU_DIR = path.join(ROOT, 'vi', 'tu');
const OUT_JSON = path.join(ROOT, 'data', 'vi-en-index.json');
const OUT_HTML = path.join(ROOT, 'vi', 'viet-anh', 'index.html');

function decodeEntities(str) {
  return String(str || '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanSense(raw) {
  let s = decodeEntities(raw.replace(/<[^>]+>/g, ' '));
  // Strip noisy dictionary metalanguage prefixes while keeping real meaning
  s = s.replace(/^\((?:trang trọng|thông tục|khẩu ngữ|từ lóng|số nhiều|kỹ thuật|y học|pháp lý|kinh tế|nghĩa bóng|nghĩa đen|cũ|văn học)[^)]*\)\s*/i, '');
  if (s.length > 68) s = s.slice(0, 66).trim() + '…';
  return s.trim();
}

function buildIndex() {
  const dirs = fs.readdirSync(TU_DIR, { withFileTypes: true }).filter((d) => d.isDirectory());
  const items = [];

  for (const d of dirs) {
    if (['cum-tu', 'ielts', 'toeic'].includes(d.name)) continue;
    const htmlPath = path.join(TU_DIR, d.name, 'index.html');
    if (!fs.existsSync(htmlPath)) continue;
    const html = fs.readFileSync(htmlPath, 'utf8');

    // Skip pure inflection redirect pages so results show canonical lemmas & phrases
    if (html.includes('entry-lemma-note')) continue;

    const h1Match = html.match(/<h1>([^<]+)<\/h1>/);
    if (!h1Match) continue;
    const head = decodeEntities(h1Match[1]);
    if (!head) continue;

    const senses = [...html.matchAll(/<div class="mtd-sense">([\s\S]*?)<\/div>/g)]
      .map((m) => cleanSense(m[1]))
      .filter((s) => s && /[a-zA-ZÀ-ỹ]/.test(s));

    if (!senses.length) continue;

    // Pick up to 2 distinct Vietnamese senses
    const pickedSenses = [];
    for (const s of senses) {
      if (!pickedSenses.includes(s)) pickedSenses.push(s);
      if (pickedSenses.length >= 2) break;
    }
    const viGloss = pickedSenses.join(' · ').slice(0, 88);

    // Extract IPA
    const ipaMatch = html.match(/class="ipa-ame"[^>]*>([^<]+)<\/span>/);
    let ipa = ipaMatch ? decodeEntities(ipaMatch[1]).replace(/^Mỹ\s*/i, '').trim() : '';

    // Extract tags (CEFR, IELTS, TOEIC, AWL, NGSL, PHRASE)
    const tags = [];
    const cefrMatch = html.match(/<span class="chip chip-cefr"[^>]*>~?([A-C][12])<\/span>/);
    if (cefrMatch) tags.push(cefrMatch[1]);
    if (html.includes('Từ học thuật (AWL)') || html.includes('AWL Sublist')) tags.push('AWL');
    if (html.includes('>IELTS Core<')) tags.push('IELTS');
    if (html.includes('>TOEIC<') || html.includes('TOEIC Business')) tags.push('TOEIC');
    if (html.includes('Học chính (NGSL')) tags.push('NGSL');
    if (head.includes(' ')) tags.push('PHRASE');

    // Prioritize entries that have useful learning tags or multi-word phrases,
    // and filter out obscure off-list noise words without tags unless they have clear Vietnamese glosses.
    const isOffList = html.includes('chip-off');
    if (isOffList && !tags.length) continue;

    items.push([head, d.name, viGloss, tags.join(' '), ipa]);
  }

  // Sort: tagged learning words (AWL / IELTS / NGSL / CEFR) first, then alphabetical
  const rankOf = (row) => {
    const t = row[3];
    let score = 0;
    if (t.includes('IELTS')) score += 4;
    if (t.includes('AWL')) score += 3;
    if (t.includes('NGSL')) score += 3;
    if (t.includes('PHRASE')) score += 2;
    return -score;
  };
  items.sort((a, b) => rankOf(a) - rankOf(b) || a[0].localeCompare(b[0]));

  const payload = { v: 1, count: items.length, items };
  fs.writeFileSync(OUT_JSON, JSON.stringify(payload));
  console.log(`Wrote ${OUT_JSON}: ${items.length} entries (${(fs.statSync(OUT_JSON).size / 1024).toFixed(1)} KB)`);
  return payload;
}

function buildHtmlPage(payload) {
  const curatedTopics = [
    { q: 'đánh giá', label: 'đánh giá (evaluate / assess)' },
    { q: 'bền vững', label: 'bền vững (sustain / sustainable)' },
    { q: 'tiết kiệm', label: 'tiết kiệm (economical / save)' },
    { q: 'giải quyết', label: 'giải quyết (resolve / deal with)' },
    { q: 'ảnh hưởng', label: 'ảnh hưởng (affect / impact)' },
    { q: 'duy trì', label: 'duy trì (maintain / keep up)' },
    { q: 'từ bỏ', label: 'từ bỏ (abandon / give up)' },
    { q: 'cạn kiệt', label: 'cạn kiệt (run out of / exhaust)' },
    { q: 'đồng ý', label: 'đồng ý (agree / approve)' },
    { q: 'thúc đẩy', label: 'thúc đẩy (promote / boost)' },
  ];

  const jsonld = JSON.stringify({
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebPage',
        name: 'Từ điển Việt–Anh theo trình độ & ngữ cảnh (IELTS / TOEIC / Giao tiếp) | HọcTA',
        url: 'https://hocta.app/vi/viet-anh/',
        inLanguage: 'vi',
        description: `Tra từ điển Việt–Anh với ${payload.count.toLocaleString('vi-VN')} từ và cụm từ tiếng Anh chọn lọc, kèm phiên âm IPA, nhãn CEFR (A2–C1), IELTS Core, AWL và phrasal verbs.`
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Trang chủ', item: 'https://hocta.app/vi/' },
          { '@type': 'ListItem', position: 2, name: 'Từ điển', item: 'https://hocta.app/vi/tu/' },
          { '@type': 'ListItem', position: 3, name: 'Từ điển Việt–Anh', item: 'https://hocta.app/vi/viet-anh/' }
        ]
      }
    ]
  }).replace(/<\//g, '<\\/');

  const html = `<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Từ điển Việt–Anh theo trình độ &amp; ngữ cảnh (IELTS / TOEIC / Giao tiếp) | HọcTA</title>
<meta name="description" content="Tra từ điển Việt–Anh với ${payload.count.toLocaleString('vi-VN')} từ và cụm từ tiếng Anh chọn lọc. Gõ tiếng Việt (có dấu hoặc không dấu) để tìm từ tiếng Anh đúng trình độ CEFR B1–C1, IELTS Academic, AWL và cụm động từ.">
<link rel="canonical" href="https://hocta.app/vi/viet-anh/">
<meta name="robots" content="index, follow">
<meta property="og:type" content="website">
<meta property="og:locale" content="vi_VN">
<meta property="og:site_name" content="HọcTA">
<meta property="og:url" content="https://hocta.app/vi/viet-anh/">
<meta property="og:title" content="Từ điển Việt–Anh theo trình độ &amp; ngữ cảnh | HọcTA">
<meta property="og:description" content="Đang viết câu tiếng Anh mà bí từ? Gõ nghĩa tiếng Việt để tìm ngay từ đơn và cụm từ tiếng Anh chuẩn theo cấp độ B1–C1, IELTS, TOEIC.">
<meta property="og:image" content="https://hocta.app/vi/images/og-default.jpg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="https://hocta.app/vi/images/og-default.jpg">
<link rel="icon" href="/favicon.ico">
<meta name="theme-color" content="#293CC8">
<link rel="stylesheet" href="/vi/blog/blog.css">
<link rel="stylesheet" href="/vi/tu/word.css">
<script type="application/ld+json">${jsonld}</script>
<script defer src="/js/section-switcher.js"></script>
<style>
.vien-search-box{display:flex;gap:8px;flex-wrap:wrap;margin:18px 0 12px}
.vien-search-box input{flex:1;min-width:220px;min-height:46px;padding:0 14px;border:2px solid var(--teal);border-radius:10px;font-size:1.05rem;background:var(--paper);color:var(--ink)}
.vien-search-box select{min-height:46px;padding:0 12px;border:1px solid var(--line);border-radius:10px;font:inherit;background:var(--paper);color:var(--ink)}
.vien-quick-chips{display:flex;gap:6px;flex-wrap:wrap;margin:0 0 18px}
.vien-quick-chip{border:1px solid var(--line);background:var(--paper);color:var(--ink);border-radius:999px;padding:5px 12px;font-size:.83rem;font-weight:600;cursor:pointer}
.vien-quick-chip:hover{border-color:var(--teal);color:var(--teal)}
.vien-grid{display:grid;grid-template-columns:1fr;gap:10px;margin:14px 0 28px}
.vien-card{display:flex;flex-direction:column;gap:4px;padding:14px 16px;border:1px solid var(--line);border-radius:10px;background:var(--paper);text-decoration:none;color:var(--ink)}
.vien-card:hover{border-color:var(--teal)}
.vien-card-head{display:flex;align-items:baseline;justify-content:space-between;gap:8px;flex-wrap:wrap}
.vien-word{font-size:1.18rem;font-weight:800;color:var(--teal)}
.vien-ipa{font-size:.9rem;color:var(--muted)}
.vien-tags{display:flex;gap:5px;flex-wrap:wrap}
.vien-gloss{margin:2px 0 0;font-size:.96rem;color:var(--ink)}
.vien-actions{display:flex;gap:10px;margin-top:6px;font-size:.83rem}
.vien-actions a{color:var(--teal);font-weight:700;text-decoration:none}
.vien-actions a:hover{text-decoration:underline}
</style>
</head>
<body class="word-page">
${navHtml('viet-anh')}
<nav class="breadcrumb" aria-label="Breadcrumb"><a href="/vi/">Trang chủ</a> › <a href="/vi/tu/">Từ điển</a> › <span aria-current="page">Từ điển Việt–Anh</span></nav>
<main class="page">
  <p class="word-kicker">Từ điển Việt–Anh theo ngữ cảnh</p>
  <h1 style="font-size:2.3rem">Tra từ Việt → Anh cho Viết &amp; Nói</h1>
  <p>Đang viết bài luận IELTS, email công việc hay tập nói tiếng Anh mà nghĩ ra ý tiếng Việt nhưng bí từ tiếng Anh? Gõ nghĩa tiếng Việt (có dấu hoặc không dấu, ví dụ: <em>đánh giá</em> hoặc <em>danh gia</em>) để tìm ngay <strong>từ đơn &amp; cụm từ tiếng Anh</strong> kèm phiên âm IPA và nhãn trình độ (<strong>B1–C1, IELTS Core, Học thuật AWL, Cụm từ</strong>).</p>

  <div class="vien-search-box">
    <input id="vien-q" type="search" placeholder="Gõ nghĩa tiếng Việt (vd: đánh giá, bền vững, giải quyết, cạn kiệt…)" aria-label="Nhập nghĩa tiếng Việt để tìm từ tiếng Anh" autocomplete="off" autofocus>
    <select id="vien-filter" aria-label="Lọc theo nhóm từ">
      <option value="">Tất cả (${payload.count.toLocaleString('vi-VN')} mục)</option>
      <option value="IELTS">IELTS Core</option>
      <option value="AWL">Học thuật (AWL)</option>
      <option value="PHRASE">Cụm từ &amp; Phrasal verbs</option>
      <option value="C1">Trình độ ~C1</option>
      <option value="B2">Trình độ ~B2</option>
      <option value="B1">Trình độ ~B1</option>
    </select>
  </div>

  <div class="vien-quick-chips" aria-label="Gợi ý tra nhanh">
    ${curatedTopics.map((t) => `<button type="button" class="vien-quick-chip" data-q="${t.q}">🔍 ${t.label}</button>`).join('\n    ')}
  </div>

  <p id="vien-status" style="color:var(--muted);font-size:.9rem" role="status" aria-live="polite">Đang tải chỉ mục Việt–Anh (${payload.count.toLocaleString('vi-VN')} mục)…</p>
  <div id="vien-results" class="vien-grid"></div>

  <div class="word-cta">
    <div class="word-cta-actions">
      <a class="word-cta-btn" href="/">Mở App HọcTA (tra cả Việt–Anh &amp; Anh–Việt offline) ↗</a>
      <a class="word-cta-btn word-cta-btn-practice" href="/vi/tu/">Xem danh mục 6.907 từ Anh–Việt →</a>
    </div>
    <p class="word-cta-note">Trong app HọcTA, bạn cũng có thể gõ trực tiếp tiếng Việt vào ô tìm kiếm chính để tra ngược Việt → Anh ngay cả khi đang ở chế độ máy bay.</p>
  </div>
</main>
<footer class="blog-footer">
  <p><a href="/vi/">HọcTA</a> — từ điển &amp; công cụ học từ vựng offline-first cho người Việt.</p>
</footer>
<script>
(function(){
  var qInput = document.getElementById('vien-q');
  var filterSel = document.getElementById('vien-filter');
  var statusEl = document.getElementById('vien-status');
  var resultsEl = document.getElementById('vien-results');
  var indexData = null;

  function foldVi(s) {
    return String(s || '').toLowerCase()
      .normalize('NFD').replace(/[\\u0300-\\u036f]/g, '')
      .replace(/đ/g, 'd').replace(/[^a-z0-9\\s-]/g, ' ')
      .replace(/\\s+/g, ' ').trim();
  }
  function esc(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }
  function renderBadges(tagStr) {
    if (!tagStr) return '';
    var parts = tagStr.split(' ').filter(Boolean);
    return parts.map(function(t) {
      if (t === 'IELTS') return '<span class="chip chip-exam">IELTS Core</span>';
      if (t === 'AWL') return '<span class="chip chip-awl">Học thuật AWL</span>';
      if (t === 'PHRASE') return '<span class="chip chip-core">Cụm từ</span>';
      if (t === 'NGSL') return '<span class="chip chip-band">NGSL</span>';
      if (/^[A-C][12]$/.test(t)) return '<span class="chip chip-cefr">~' + t + '</span>';
      return '';
    }).join(' ');
  }

  function searchViEn() {
    if (!indexData) return;
    var rawQ = (qInput.value || '').trim().toLowerCase();
    var foldedQ = foldVi(rawQ);
    var tagFilter = filterSel.value;
    var matches = [];

    for (var i = 0; i < indexData.length; i++) {
      var row = indexData[i];
      var head = row[0], slug = row[1], gloss = row[2], tags = row[3] || '', ipa = row[4] || '';
      if (tagFilter && (' ' + tags + ' ').indexOf(' ' + tagFilter + ' ') === -1) continue;

      if (!rawQ) {
        matches.push({ row: row, score: 1 });
        if (matches.length >= 40) break;
        continue;
      }

      var glossLow = gloss.toLowerCase();
      var glossFold = row[5];
      var headLow = head.toLowerCase();
      var score = 0;

      if (glossLow === rawQ || headLow === rawQ) score = 100;
      else if (glossLow.indexOf(rawQ) === 0 || glossLow.indexOf(' ' + rawQ) !== -1) score = 85;
      else if (glossLow.indexOf(rawQ) !== -1) score = 70;
      else if (foldedQ.length >= 2 && (glossFold.indexOf(foldedQ) === 0 || glossFold.indexOf(' ' + foldedQ) !== -1)) score = 60;
      else if (foldedQ.length >= 3 && glossFold.indexOf(foldedQ) !== -1) score = 45;
      else if (headLow.indexOf(rawQ) !== -1) score = 40;

      if (score > 0) {
        if (tags.indexOf('IELTS') !== -1) score += 6;
        if (tags.indexOf('AWL') !== -1) score += 5;
        if (tags.indexOf('NGSL') !== -1) score += 3;
        matches.push({ row: row, score: score });
      }
    }

    if (rawQ) {
      matches.sort(function(a, b) { return b.score - a.score || a.row[0].localeCompare(b.row[0]); });
    }
    var top = matches.slice(0, 48);
    statusEl.textContent = rawQ
      ? ('Tìm thấy ' + matches.length + ' từ/cụm tiếng Anh cho “' + qInput.value.trim() + '”' + (matches.length > 48 ? ' (hiển thị 48 mục sát nhất)' : ''))
      : ('Hiển thị ' + top.length + ' mục tiêu biểu — gõ tiếng Việt vào ô trên để tra trong ' + indexData.length.toLocaleString('vi-VN') + ' mục từ.');

    resultsEl.innerHTML = '';
    top.forEach(function(m) {
      var r = m.row;
      var head = r[0], slug = r[1], gloss = r[2], tags = r[3], ipa = r[4];
      var wordUrl = '/vi/tu/' + slug + '/';
      var appUrl = '/?q=' + encodeURIComponent(head);
      var card = document.createElement('div');
      card.className = 'vien-card';

      var headDiv = document.createElement('div');
      headDiv.className = 'vien-card-head';
      var leftDiv = document.createElement('div');
      var wLink = document.createElement('a');
      wLink.className = 'vien-word';
      wLink.setAttribute('hr' + 'ef', wordUrl);
      wLink.textContent = head;
      leftDiv.appendChild(wLink);
      if (ipa) {
        var ipaSpan = document.createElement('span');
        ipaSpan.className = 'vien-ipa';
        ipaSpan.textContent = ' ' + ipa;
        leftDiv.appendChild(ipaSpan);
      }
      var tagDiv = document.createElement('div');
      tagDiv.className = 'vien-tags';
      tagDiv.innerHTML = renderBadges(tags);
      headDiv.append(leftDiv, tagDiv);

      var glossP = document.createElement('p');
      glossP.className = 'vien-gloss';
      glossP.textContent = gloss;

      var actDiv = document.createElement('div');
      actDiv.className = 'vien-actions';
      var detailA = document.createElement('a');
      detailA.setAttribute('hr' + 'ef', wordUrl);
      detailA.textContent = '📖 Xem chi tiết & ví dụ →';
      var appA = document.createElement('a');
      appA.setAttribute('hr' + 'ef', appUrl);
      appA.textContent = '⚡ Mở trong App offline ↗';
      actDiv.append(detailA, appA);

      card.append(headDiv, glossP, actDiv);
      resultsEl.appendChild(card);
    });
  }

  fetch('/data/vi-en-index.json')
    .then(function(r) { return r.json(); })
    .then(function(data) {
      indexData = (data.items || []).map(function(row) {
        row[5] = foldVi(row[2]);
        return row;
      });
      var urlQ = new URLSearchParams(location.search).get('q');
      if (urlQ) qInput.value = urlQ;
      searchViEn();
    })
    .catch(function() {
      statusEl.textContent = 'Không tải được dữ liệu chỉ mục Việt–Anh.';
    });

  qInput.addEventListener('input', searchViEn);
  filterSel.addEventListener('change', searchViEn);
  document.querySelectorAll('.vien-quick-chip').forEach(function(btn) {
    btn.addEventListener('click', function() {
      qInput.value = btn.getAttribute('data-q') || '';
      searchViEn();
    });
  });
})();
</script>
</body>
</html>`;

  fs.mkdirSync(path.dirname(OUT_HTML), { recursive: true });
  fs.writeFileSync(OUT_HTML, html, 'utf8');
  console.log(`Wrote ${OUT_HTML}`);
}

const payload = buildIndex();
buildHtmlPage(payload);
