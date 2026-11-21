#!/usr/bin/env node
/**
 * Builds the Vietnamese -> English reverse dictionary:
 *  1. data/vi-en-index.json (7,032 canonical entries for in-app offline & web instant search)
 *  2. /vi/viet-anh/<slug>/index.html (~600 Programmatic SEO & GEO static concept pages)
 *  3. /vi/viet-anh/index.html (Interactive hub + static crawlable directory of all 600 concept pages)
 *  4. Two-way internal links between /vi/tu/<word>/ and /vi/viet-anh/<slug>/
 */
const fs = require('fs');
const path = require('path');
const { navHtml } = require('./nav-partial.cjs');

const ROOT = path.resolve(__dirname, '..');
const TU_DIR = path.join(ROOT, 'vi', 'tu');
const PHAN_BIET_DIR = path.join(ROOT, 'vi', 'phan-biet');
const DONG_NGHIA_DIR = path.join(ROOT, 'vi', 'dong-nghia');
const OUT_JSON = path.join(ROOT, 'data', 'vi-en-index.json');
const VIET_ANH_DIR = path.join(ROOT, 'vi', 'viet-anh');
const OUT_HTML = path.join(VIET_ANH_DIR, 'index.html');
const MAX_CONCEPT_PAGES = 600;

function esc(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function safeJsonLd(obj) {
  return JSON.stringify(obj).replace(/<\//g, '<\\/');
}

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

function foldSlug(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function cleanSense(raw) {
  let s = decodeEntities(raw.replace(/<[^>]+>/g, ' '));
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
    if (html.includes('entry-lemma-note')) continue;

    const h1Match = html.match(/<h1>([^<]+)<\/h1>/);
    if (!h1Match) continue;
    const head = decodeEntities(h1Match[1]);
    if (!head) continue;

    const senses = [...html.matchAll(/<div class="mtd-sense">([\s\S]*?)<\/div>/g)]
      .map((m) => cleanSense(m[1]))
      .filter((s) => s && /[a-zA-ZÀ-ỹ]/.test(s));
    if (!senses.length) continue;

    const pickedSenses = [];
    for (const s of senses) {
      if (!pickedSenses.includes(s)) pickedSenses.push(s);
      if (pickedSenses.length >= 2) break;
    }
    const viGloss = pickedSenses.join(' · ').slice(0, 88);

    const ipaMatch = html.match(/class="ipa-ame"[^>]*>([^<]+)<\/span>/);
    const ipa = ipaMatch ? decodeEntities(ipaMatch[1]).replace(/^Mỹ\s*/i, '').trim() : '';

    const tags = [];
    const cefrMatch = html.match(/<span class="chip chip-cefr"[^>]*>~?([A-C][12])<\/span>/);
    if (cefrMatch) tags.push(cefrMatch[1]);
    if (html.includes('Từ học thuật (AWL)') || html.includes('AWL Sublist')) tags.push('AWL');
    if (html.includes('>IELTS Core<')) tags.push('IELTS');
    if (html.includes('>TOEIC<') || html.includes('TOEIC Business')) tags.push('TOEIC');
    if (html.includes('Học chính (NGSL')) tags.push('NGSL');
    if (head.includes(' ')) tags.push('PHRASE');

    const isOffList = html.includes('chip-off');
    if (isOffList && !tags.length) continue;

    items.push([head, d.name, viGloss, tags.join(' '), ipa]);
  }

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

function extractConceptClusters(payload) {
  const STOP = new Set([
    'cua', 'cho', 'voi', 'trong', 'ngoai', 'tren', 'duoi', 'nhu', 'la', 'co',
    'khong', 'mot', 'cac', 'nhung', 'nay', 'do', 'khi', 'neu', 'thi', 'ma',
    'de', 'va', 'hoac', 'hay', 've', 'tu', 'den', 'ra', 'vao', 'len', 'xuong',
    'di', 'lai', 'nguoi', 'vat', 'viec', 'su', 'tinh', 'cach', 'noi', 'luc',
    'co-the', 'lam-cho', 'thuoc-ve', 'lien-quan'
  ]);
  const map = new Map();

  for (const row of payload.items) {
    const [, , gloss, tags] = row;
    const cleanGloss = gloss.replace(/\([^)]*\)?/g, ' ').replace(/…/g, ' ');
    const rawParts = cleanGloss
      .split(/[·;,/]/)
      .map((s) => s.replace(/[^a-zA-ZÀ-ỹ\s-]/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase());
    const seen = new Set();

    for (let p of rawParts) {
      p = p.replace(/^(?:sự|việc|tính|người|kẻ|vật|cái|làm cho|làm|có tính|thuộc|mang tính)\s+/i, '').trim();
      if (!p || p.length < 4 || p.length > 24) continue;
      const words = p.split(/\s+/);
      if (words.length < 2 || words.length > 3) continue;
      if (!/[àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]/i.test(p)) continue;
      const k = foldSlug(p);
      if (!k || k.length < 4 || STOP.has(k) || seen.has(k)) continue;
      seen.add(k);
      if (!map.has(k)) map.set(k, { slug: k, term: p, entries: [], ieltsCount: 0, awlCount: 0 });
      const g = map.get(k);
      g.entries.push(row);
      if (tags.includes('IELTS')) g.ieltsCount++;
      if (tags.includes('AWL')) g.awlCount++;
    }
  }

  // Must include our 10 flagship concepts plus the highest-utility clusters
  const mustTopics = [
    ['danh-gia', 'đánh giá'],
    ['ben-vung', 'bền vững'],
    ['tiet-kiem', 'tiết kiệm'],
    ['giai-quyet', 'giải quyết'],
    ['anh-huong', 'ảnh hưởng'],
    ['duy-tri', 'duy trì'],
    ['tu-bo', 'từ bỏ'],
    ['can-kiet', 'cạn kiệt'],
    ['dong-y', 'đồng ý'],
    ['thuc-day', 'thúc đẩy'],
  ];
  const mustSlugs = new Set(mustTopics.map((x) => x[0]));

  for (const [mSlug, mTerm] of mustTopics) {
    if (!map.has(mSlug) || map.get(mSlug).entries.length < 2) {
      const entries = payload.items.filter((row) => row[2].toLowerCase().includes(mTerm) || (mSlug === 'ben-vung' && /duy trì|lâu dài|bền/i.test(row[2])) || (mSlug === 'can-kiet' && /cạn|hết sạch|kiệt/i.test(row[2]))).slice(0, 14);
      if (entries.length) {
        map.set(mSlug, { slug: mSlug, term: mTerm, entries, ieltsCount: 3, awlCount: 2 });
      }
    }
  }

  const candidates = [...map.values()].filter(
    (g) => mustSlugs.has(g.slug) || (g.entries.length >= 3 && g.entries.length <= 28 && (g.ieltsCount >= 1 || g.awlCount >= 1))
  );

  candidates.sort((a, b) => {
    const aMust = mustSlugs.has(a.slug) ? 1000 : 0;
    const bMust = mustSlugs.has(b.slug) ? 1000 : 0;
    const aScore = aMust + a.ieltsCount * 3 + a.awlCount * 2 + a.entries.length;
    const bScore = bMust + b.ieltsCount * 3 + b.awlCount * 2 + b.entries.length;
    return bScore - aScore || a.term.localeCompare(b.term, 'vi');
  });

  return candidates.slice(0, MAX_CONCEPT_PAGES);
}

function registerGuide(tags) {
  const t = String(tags || '');
  const cefr = (t.match(/\b[A-C][12]\b/) || [])[0] || '';
  if (t.includes('AWL') && t.includes('IELTS')) {
    return `Học thuật & IELTS Writing/Reading${cefr ? ' (~' + cefr + ')' : ''}`;
  }
  if (t.includes('PHRASE')) {
    return `Cụm từ / Phrasal verb tự nhiên (Speaking & Giao tiếp${cefr ? ' ~' + cefr : ''})`;
  }
  if (t.includes('IELTS')) {
    return `Từ vựng cốt lõi IELTS & Viết luận${cefr ? ' (~' + cefr + ')' : ''}`;
  }
  if (t.includes('NGSL')) {
    return `Từ thông dụng tần suất cao (NGSL${cefr ? ' ~' + cefr : ''})`;
  }
  return cefr ? `Từ vựng trình độ ~${cefr}` : 'Từ vựng mở rộng theo ngữ cảnh';
}

function badgeChipsHtml(tags) {
  const parts = String(tags || '').split(' ').filter(Boolean);
  return parts
    .map((t) => {
      if (t === 'IELTS') return '<span class="chip chip-exam">IELTS Core</span>';
      if (t === 'AWL') return '<span class="chip chip-awl">AWL</span>';
      if (t === 'PHRASE') return '<span class="chip chip-core">Cụm từ</span>';
      if (t === 'NGSL') return '<span class="chip chip-band">NGSL</span>';
      if (/^[A-C][12]$/.test(t)) return `<span class="chip chip-cefr">~${t}</span>`;
      return '';
    })
    .filter(Boolean)
    .join(' ');
}

function buildConceptPages(clusters) {
  // Index existing /vi/phan-biet/ and /vi/dong-nghia/ pages for cross-silo internal linking
  const comparePages = fs.existsSync(PHAN_BIET_DIR)
    ? fs.readdirSync(PHAN_BIET_DIR, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name)
    : [];
  const synSet = new Set(
    fs.existsSync(DONG_NGHIA_DIR)
      ? fs.readdirSync(DONG_NGHIA_DIR, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name)
      : []
  );

  // Map English slug -> top Vietnamese concepts (for reverse links on /vi/tu/<word>/)
  const wordToConcepts = new Map();

  clusters.forEach((cluster, idx) => {
    const { slug, term, entries } = cluster;
    const capTerm = term.charAt(0).toUpperCase() + term.slice(1);
    const topWords = entries.slice(0, 5).map((r) => r[0]);
    const topWordsPlain = topWords.join(', ');

    for (const r of entries) {
      const enSlug = r[1];
      if (!wordToConcepts.has(enSlug)) wordToConcepts.set(enSlug, []);
      const arr = wordToConcepts.get(enSlug);
      if (arr.length < 4 && !arr.some((x) => x.slug === slug)) {
        arr.push({ slug, term });
      }
    }

    // Pick academic/IELTS choices vs conversational/phrase choices for GEO direct answer
    const academicChoices = entries.filter((r) => r[3].includes('AWL') || r[3].includes('C1') || r[3].includes('B2')).slice(0, 3).map((r) => r[0]);
    const phraseChoices = entries.filter((r) => r[3].includes('PHRASE') || r[3].includes('A2') || r[3].includes('B1')).slice(0, 3).map((r) => r[0]);

    const directAnswerText =
      `Trong tiếng Anh, “${term}” có thể diễn đạt bằng ${entries.length} từ và cụm từ tùy ngữ cảnh: phổ biến nhất là ${topWordsPlain}. ` +
      (academicChoices.length
        ? `Khi viết học thuật hoặc IELTS Writing, nên ưu tiên ${academicChoices.join(', ')}; `
        : '') +
      (phraseChoices.length
        ? `trong giao tiếp hàng ngày hoặc IELTS Speaking, có thể dùng ${phraseChoices.join(', ')}.`
        : 'hãy đối chiếu bảng trình độ CEFR và sắc thái nghĩa dưới đây để chọn đúng từ.');

    // Cross-silo links to /vi/phan-biet/ and /vi/dong-nghia/
    const entrySlugs = new Set(entries.map((r) => r[1]));
    const relatedCompares = comparePages
      .filter((c) => {
        const parts = c.split('-vs-');
        return parts.some((p) => entrySlugs.has(p));
      })
      .slice(0, 4);
    const relatedSyns = entries.filter((r) => synSet.has(r[1])).slice(0, 4);

    // Neighbor concept pages for horizontal crawlability
    const neighbors = [];
    for (let step = 1; neighbors.length < 6 && step < clusters.length; step++) {
      const n = clusters[(idx + step) % clusters.length];
      if (n.slug !== slug) neighbors.push(n);
    }

    const faq1Q = `“${capTerm}” tiếng Anh là gì?`;
    const faq1A = directAnswerText;
    const faq2Q = `Khi nào dùng ${entries[0][0]} và ${entries[1] ? entries[1][0] : entries[0][0]} để diễn đạt “${term}”?`;
    const faq2A = entries[1]
      ? `“${entries[0][0]}” (${entries[0][4] || 'từ vựng chính'}) mang sắc thái: ${entries[0][2]}. Trong khi đó, “${entries[1][0]}” (${entries[1][4] || 'từ liên quan'}) được dùng với nghĩa: ${entries[1][2]}.`
      : `“${entries[0][0]}” được dùng với nghĩa: ${entries[0][2]}.`;

    const pageUrl = `https://hocta.app/vi/viet-anh/${slug}/`;
    const jsonld = safeJsonLd({
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'DefinedTermSet',
          name: `${capTerm} tiếng Anh là gì? Từ điển Việt–Anh theo trình độ`,
          url: pageUrl,
          inLanguage: ['vi', 'en'],
          description: directAnswerText,
          hasDefinedTerm: entries.slice(0, 10).map((r) => ({
            '@type': 'DefinedTerm',
            name: r[0],
            description: r[2],
            url: `https://hocta.app/vi/tu/${r[1]}/`
          }))
        },
        {
          '@type': 'FAQPage',
          mainEntity: [
            { '@type': 'Question', name: faq1Q, acceptedAnswer: { '@type': 'Answer', text: faq1A } },
            { '@type': 'Question', name: faq2Q, acceptedAnswer: { '@type': 'Answer', text: faq2A } }
          ]
        },
        {
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Trang chủ', item: 'https://hocta.app/vi/' },
            { '@type': 'ListItem', position: 2, name: 'Từ điển Việt–Anh', item: 'https://hocta.app/vi/viet-anh/' },
            { '@type': 'ListItem', position: 3, name: capTerm, item: pageUrl }
          ]
        }
      ]
    });

    const tableRows = entries
      .map((r) => {
        const [head, enSlug, gloss, tags, ipa] = r;
        return `<tr>
          <td><a href="/vi/tu/${esc(enSlug)}/"><strong>${esc(head)}</strong></a>${ipa ? `<br><span class="word-ipa" style="font-size:.85rem">${esc(ipa)}</span>` : ''}</td>
          <td>${badgeChipsHtml(tags)}<div style="font-size:.8rem;color:var(--muted);margin-top:4px">${esc(registerGuide(tags))}</div></td>
          <td>${esc(gloss)}<div style="margin-top:4px;font-size:.82rem"><a href="/vi/tu/${esc(enSlug)}/">Xem ví dụ &amp; cách dùng →</a> · <a href="/?q=${encodeURIComponent(head)}">Tra offline ↗</a></div></td>
        </tr>`;
      })
      .join('\n');

    const html = `<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(capTerm)} tiếng Anh là gì? ${entries.length} từ &amp; cụm từ (${esc(topWords.slice(0, 3).join(', '))}) | HọcTA</title>
<meta name="description" content="${esc(directAnswerText.slice(0, 158))}">
<link rel="canonical" href="${pageUrl}">
<meta name="robots" content="index, follow">
<meta property="og:type" content="article">
<meta property="og:locale" content="vi_VN">
<meta property="og:site_name" content="HọcTA">
<meta property="og:url" content="${pageUrl}">
<meta property="og:title" content="${esc(capTerm)} tiếng Anh là gì? Phân biệt ${esc(topWords.slice(0, 3).join(', '))} | HọcTA">
<meta property="og:description" content="${esc(directAnswerText.slice(0, 158))}">
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
.vien-answer-box{border:1px solid var(--line);border-left:4px solid var(--teal);border-radius:10px;background:var(--paper);padding:16px 18px;margin:14px 0 22px}
.vien-table-wrap{overflow-x:auto;margin:16px 0 24px;border:1px solid var(--line);border-radius:10px;background:var(--paper)}
.vien-table{width:100%;border-collapse:collapse;font-size:.94rem}
.vien-table th,.vien-table td{padding:12px 14px;border-bottom:1px solid var(--line);text-align:left;vertical-align:top}
.vien-table th{background:var(--soft);font-weight:800}
.vien-table tr:last-child td{border-bottom:0}
</style>
</head>
<body class="word-page">
${navHtml('viet-anh')}
<nav class="breadcrumb" aria-label="Breadcrumb"><a href="/vi/">Trang chủ</a> › <a href="/vi/viet-anh/">Từ điển Việt–Anh</a> › <span aria-current="page">${esc(capTerm)}</span></nav>
<main class="page">
  <p class="word-kicker">Từ điển Việt–Anh theo trình độ &amp; ngữ cảnh</p>
  <h1 style="font-size:2.2rem">“${esc(capTerm)}” tiếng Anh là gì?</h1>

  <section class="vien-answer-box" aria-label="Tóm tắt nhanh">
    <p style="margin:0"><strong>Trả lời nhanh:</strong> Trong tiếng Anh, <strong>“${esc(term)}”</strong> được diễn đạt bằng <strong>${entries.length} từ và cụm từ</strong> tùy trình độ và ngữ cảnh, tiêu biểu là ${entries.slice(0, 4).map((r) => `<a href="/vi/tu/${esc(r[1])}/"><strong>${esc(r[0])}</strong></a>${r[4] ? ` (${esc(r[4])})` : ''}`).join(', ')}. ${academicChoices.length ? `Trong bài viết học thuật / IELTS Writing, nên ưu tiên <strong>${esc(academicChoices.join(', '))}</strong>.` : ''}</p>
  </section>

  <h2>Bảng so sánh ${entries.length} từ tiếng Anh nghĩa là “${esc(term)}”</h2>
  <div class="vien-table-wrap">
    <table class="vien-table">
      <thead>
        <tr>
          <th>Từ / Cụm từ tiếng Anh</th>
          <th>Trình độ &amp; Ngữ cảnh</th>
          <th>Sắc thái nghĩa tiếng Việt &amp; Ví dụ</th>
        </tr>
      </thead>
      <tbody>
        ${tableRows}
      </tbody>
    </table>
  </div>

  <section class="word-note faq-sec">
    <h2>Câu hỏi thường gặp khi dịch “${esc(term)}” sang tiếng Anh</h2>
    <details open>
      <summary>${esc(faq1Q)}</summary>
      <p>${esc(faq1A)}</p>
    </details>
    <details open>
      <summary>${esc(faq2Q)}</summary>
      <p>${esc(faq2A)}</p>
    </details>
  </section>

  ${(relatedCompares.length || relatedSyns.length) ? `<section class="related">
    <h2>Phân biệt &amp; Đồng nghĩa liên quan</h2>
    <div class="related-list">
      ${relatedCompares.map((c) => `<a class="related-chip" href="/vi/phan-biet/${esc(c)}/">⚖️ Phân biệt ${esc(c.replace(/-vs-/g, ' vs '))} →</a>`).join('\n      ')}
      ${relatedSyns.map((r) => `<a class="related-chip" href="/vi/dong-nghia/${esc(r[1])}/">🔄 Từ đồng nghĩa của ${esc(r[0])} →</a>`).join('\n      ')}
    </div>
  </section>` : ''}

  <section class="related">
    <h2>Mục từ Việt–Anh liên quan</h2>
    <div class="related-list">
      ${neighbors.map((n) => `<a class="related-chip" href="/vi/viet-anh/${esc(n.slug)}/">🇻🇳→🇬🇧 ${esc(n.term)} (${n.entries.length} từ) →</a>`).join('\n      ')}
      <a class="related-chip" href="/vi/viet-anh/">Xem toàn bộ Từ điển Việt–Anh →</a>
    </div>
  </section>

  <div class="word-cta">
    <div class="word-cta-actions">
      <a class="word-cta-btn" href="/?q=${encodeURIComponent(entries[0][0])}">Luyện &amp; lưu từ “${esc(entries[0][0])}” trong App offline ↗</a>
      <a class="word-cta-btn word-cta-btn-practice" href="/vi/viet-anh/">Tra mục Việt–Anh khác →</a>
    </div>
    <p class="word-cta-note">App HọcTA hỗ trợ tra cả Việt→Anh lẫn Anh→Việt 100% offline, ôn tập ngắt quãng FSRS miễn phí.</p>
  </div>
</main>
<footer class="blog-footer">
  <p><a href="/vi/">HọcTA</a> — từ điển &amp; công cụ học từ vựng offline-first cho người Việt.</p>
</footer>
</body>
</html>`;

    const outDir = path.join(VIET_ANH_DIR, slug);
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, 'index.html'), html, 'utf8');
  });

  console.log(`Built ${clusters.length} static /vi/viet-anh/<slug>/ concept pages.`);
  return wordToConcepts;
}

function injectReverseLinksIntoWordPages(wordToConcepts) {
  let injected = 0;
  const dirs = fs.readdirSync(TU_DIR, { withFileTypes: true }).filter((d) => d.isDirectory());
  for (const d of dirs) {
    const enSlug = d.name;
    // Never touch the 3 hand-written flagship word pages
    if (['evaluate', 'economical', 'sustain'].includes(enSlug)) continue;
    const p = path.join(TU_DIR, enSlug, 'index.html');
    if (!fs.existsSync(p)) continue;
    let html = fs.readFileSync(p, 'utf8');
    const hadOld = html.includes('vien-backlinks');
    if (hadOld) {
      html = html.replace(/<section class="related vien-backlinks">[\s\S]*?<\/section>\n?/g, '');
    }
    const concepts = wordToConcepts.get(enSlug);
    if (!concepts || !concepts.length) {
      if (hadOld) fs.writeFileSync(p, html, 'utf8');
      continue;
    }

    const chips = concepts
      .map((c) => `<a class="related-chip" href="/vi/viet-anh/${esc(c.slug)}/">🇻🇳→🇬🇧 “${esc(c.term)}” tiếng Anh là gì? →</a>`)
      .join(' ');
    const block = `<section class="related vien-backlinks"><h2>Diễn đạt cùng ý tiếng Việt</h2><div class="related-list">${chips}</div></section>\n`;

    const anchor = '<p class="upd"';
    const pos = html.indexOf(anchor);
    if (pos !== -1) {
      html = html.slice(0, pos) + block + html.slice(pos);
      fs.writeFileSync(p, html, 'utf8');
      injected++;
    }
  }
  console.log(`Injected two-way Việt–Anh internal links into ${injected} /vi/tu/<word>/ pages.`);
}

function buildHtmlPage(payload, clusters) {
  const curatedTopics = [
    { q: 'đánh giá', slug: 'danh-gia', label: 'đánh giá (evaluate / assess)' },
    { q: 'bền vững', slug: 'ben-vung', label: 'bền vững (sustain / sustainable)' },
    { q: 'tiết kiệm', slug: 'tiet-kiem', label: 'tiết kiệm (economical / save)' },
    { q: 'giải quyết', slug: 'giai-quyet', label: 'giải quyết (resolve / deal with)' },
    { q: 'ảnh hưởng', slug: 'anh-huong', label: 'ảnh hưởng (affect / impact)' },
    { q: 'duy trì', slug: 'duy-tri', label: 'duy trì (maintain / keep up)' },
    { q: 'từ bỏ', slug: 'tu-bo', label: 'từ bỏ (abandon / give up)' },
    { q: 'cạn kiệt', slug: 'can-kiet', label: 'cạn kiệt (run out of / exhaust)' },
    { q: 'đồng ý', slug: 'dong-y', label: 'đồng ý (agree / approve)' },
    { q: 'thúc đẩy', slug: 'thuc-day', label: 'thúc đẩy (promote / boost)' },
  ];

  const jsonld = safeJsonLd({
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage',
        name: 'Từ điển Việt–Anh theo trình độ & ngữ cảnh (IELTS / TOEIC / Giao tiếp) | HọcTA',
        url: 'https://hocta.app/vi/viet-anh/',
        inLanguage: 'vi',
        description: `Tra từ điển Việt–Anh với ${payload.count.toLocaleString('vi-VN')} từ và cụm từ tiếng Anh chọn lọc cùng ${clusters.length} chủ điểm so sánh từ vựng Việt–Anh theo trình độ CEFR B1–C1, IELTS Core, AWL.`
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
  });

  // Group all 3,000 concept pages by initial letter (A-Z) for fast mobile rendering & 100% crawler visibility
  const byLetter = new Map();
  const sortedByAlpha = [...clusters].sort((a, b) => a.term.localeCompare(b.term, 'vi'));
  for (const c of sortedByAlpha) {
    const letter = (c.slug.charAt(0) || 'a').toUpperCase();
    if (!byLetter.has(letter)) byLetter.set(letter, []);
    byLetter.get(letter).push(c);
  }
  const letters = [...byLetter.keys()].sort();
  const directoryHtml = letters
    .map((L, idx) => {
      const list = byLetter.get(L);
      const itemsHtml = list
        .map((c) => {
          const sampleEn = c.entries.slice(0, 2).map((r) => r[0]).join(', ');
          return `<li><a href="/vi/viet-anh/${esc(c.slug)}/"><strong>${esc(c.term)}</strong></a> <span style="color:var(--muted);font-size:.84rem">(${c.entries.length}: ${esc(sampleEn)})</span></li>`;
        })
        .join('\n        ');
      return `<details class="vien-alpha-group"${idx < 3 ? ' open' : ''}>
      <summary><strong>Vần ${esc(L)}</strong> <span style="color:var(--muted);font-weight:400">(${list.length} mục từ Việt–Anh)</span></summary>
      <ul class="vien-dir-list">
        ${itemsHtml}
      </ul>
    </details>`;
    })
    .join('\n    ');

  const html = `<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Từ điển Việt–Anh theo trình độ &amp; ngữ cảnh (IELTS / TOEIC / Giao tiếp) | HọcTA</title>
<meta name="description" content="Tra từ điển Việt–Anh với ${payload.count.toLocaleString('vi-VN')} từ và cụm từ tiếng Anh chọn lọc cùng ${clusters.length.toLocaleString('vi-VN')} trang so sánh sắc thái Việt–Anh theo cấp độ CEFR B1–C1, IELTS Academic, AWL.">
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
.vien-quick-chip{border:1px solid var(--line);background:var(--paper);color:var(--ink);border-radius:999px;padding:5px 12px;font-size:.83rem;font-weight:600;cursor:pointer;text-decoration:none}
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
.vien-dir-list{columns:2 260px;column-gap:24px;padding-left:18px;line-height:1.85;margin:10px 0 4px}
.vien-alpha-group{border:1px solid var(--line);border-radius:8px;padding:10px 14px;margin:8px 0;background:var(--paper)}
.vien-alpha-group summary{cursor:pointer}
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

  <div class="vien-quick-chips" aria-label="Các chủ điểm Việt–Anh tiêu biểu">
    ${curatedTopics.map((t) => `<a class="vien-quick-chip" href="/vi/viet-anh/${t.slug}/" data-q="${t.q}">🔍 ${t.label}</a>`).join('\n    ')}
  </div>

  <p id="vien-status" style="color:var(--muted);font-size:.9rem" role="status" aria-live="polite">Đang tải chỉ mục Việt–Anh (${payload.count.toLocaleString('vi-VN')} mục)…</p>
  <div id="vien-results" class="vien-grid"></div>

  <section class="word-note" style="margin-top:32px">
    <h2>Danh mục ${clusters.length.toLocaleString('vi-VN')} mục từ Việt–Anh theo bảng chữ cái (A–Z)</h2>
    <p style="color:var(--muted);font-size:.92rem">Mỗi trang dưới đây phân tích các cách diễn đạt một ý tiếng Việt sang tiếng Anh theo cấp độ Giao tiếp (A2–B1), Cụm động từ và Học thuật / IELTS (B2–C1):</p>
    ${directoryHtml}
  </section>

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
        if (matches.length >= 36) break;
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
    var top = matches.slice(0, 36);
    statusEl.textContent = rawQ
      ? ('Tìm thấy ' + matches.length + ' từ/cụm tiếng Anh cho “' + qInput.value.trim() + '”' + (matches.length > 36 ? ' (hiển thị 36 mục sát nhất)' : ''))
      : ('Hiển thị ' + top.length + ' mục tiêu biểu — gõ tiếng Việt vào ô trên hoặc chọn trong ' + ${clusters.length} + ' mục từ Việt–Anh bên dưới.');

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
})();
</script>
</body>
</html>`;

  fs.mkdirSync(path.dirname(OUT_HTML), { recursive: true });
  fs.writeFileSync(OUT_HTML, html, 'utf8');
  console.log(`Wrote ${OUT_HTML}`);
}

const payload = buildIndex();
const clusters = extractConceptClusters(payload);
const wordToConcepts = buildConceptPages(clusters);
injectReverseLinksIntoWordPages(wordToConcepts);
buildHtmlPage(payload, clusters);
