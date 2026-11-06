#!/usr/bin/env node
/* Phrase page generator for Dual Dictionary (VI-P1 + VI-P2 + SEO rich gate).
 *
 * Builds /vi/tu/{phrase}/ pages from TWO content sources, plus one enricher:
 *   1. Hand-written Vietnamese meanings (VI-P2): data/vi-phrase-defs/*.json —
 *      ORIGINAL editorial content. Can admit phrases no dictionary keys
 *      ("run out of"…). Optional hideOvdp hides a bad OVDP entry.
 *   2. Open OVDP dictionary (MIT) — same marker parser as the word pages
 *      (required from build-word-pages.cjs so families never drift).
 *   3. WordNet 3.1 English definitions (samples/wordnet31.mdx, open licence,
 *      already bundled with the public app) — enrichment section on every
 *      covered page. This is what makes a page RICH instead of thin.
 *
 * RICH BAR (owner directive, 15/10: "làm cho giàu, không được thì remove"):
 *   keep a page only when  hand  OR  (OVDP >=2 content blocks AND example
 *   pair)  OR  (WordNet definition available AND OVDP >=1 block). Everything
 *   else is REMOVED — never shipped thin.
 *
 * Ownership: docs/phrasepages-manifest.json (word builder untouched).
 * Sitemap: vi/tu/sitemap/phrases-NNN.xml + phrases-index.xml.
 */

const fs = require('fs');
const path = require('path');
const { MDict } = require('../js/mdict.js');
const { ABBREV_RE, VULGAR } = require('./wordlist-lib.cjs');
const core = require('./build-word-pages.cjs');
const { navHtml } = require('./nav-partial.cjs');

const REPO = path.join(__dirname, '..');
const OUT_DIR = path.join(REPO, 'vi', 'tu');
const SITE = core.SITE;
const REPORT_EMAIL = core.REPORT_EMAIL;
const LIST_PATH = path.join(REPO, 'data', 'phrase-wordlist.json');
const MANIFEST_PATH = path.join(REPO, 'docs', 'phrasepages-manifest.json');
const QA_PATH = path.join(REPO, 'docs', 'phrasepages-qa.json');
const WORD_MANIFEST_PATH = path.join(REPO, 'docs', 'wordpages-manifest.json');
const CORPUS_DIR = path.join(REPO, 'data', 'vi-phrase-defs');
const WORDNET_PATH = path.join(REPO, 'samples', 'wordnet31.mdx');
const FAT_CAP = 15000;

/* FREQ TIERS (review-2 feature, owner-approved 17/10/2026): "Phổ biến" chip =
 * every token of the phrase sits in the top-2k frequency band (data/freq-en.json).
 * Same scoring as docs/vi-p2-pool.json so pool tiers and page chips agree. */
const FREQ = JSON.parse(fs.readFileSync(path.join(REPO, 'data', 'freq-en.json'), 'utf8'));
function phraseTier(phrase) {
  const toks = phrase.toLowerCase().replace(/[^a-z0-9'" -]/g, '').split(/[\s-]+/).filter(Boolean)
    .map((t) => t.replace(/[^\w']/g, '')).filter(Boolean);
  if (!toks.length) return 'D';
  let worst = 0;
  for (const t of toks) {
    const b = FREQ[t] || FREQ[t.replace(/s$/, '')];
    const m = b ? /^(\d+)k$/.exec(b) : null;
    if (!m) return 'D';
    const r = Number(m[1]);
    if (r > worst) worst = r;
  }
  return worst <= 2 ? 'A' : worst <= 5 ? 'B' : worst <= 10 ? 'C' : 'D';
}

function phraseSlug(p) {
  return String(p).normalize('NFC').toLowerCase()
    .replace(/[^a-z0-9'’\s-]/g, '') // drop ký tự lạ (comma, ;, !…) — URL sạch, không %2C (link-check 15/10)
    .replace(/\s+/g, '-')
    .replace(/[/\\:*?"<>|]/g, '-')
    .replace(/\.{2,}/g, '.')
    .replace(/\.+$/, '');
}
function phrasePageUrl(p) {
  return `/vi/tu/${encodeURIComponent(phraseSlug(p))}/`;
}
function entryHasContent(txt) {
  return core.mtdToBlocks(core.sanitizeRaw(txt))
    .some((b) => b.type === 'sense' || b.type === 'line' || b.type === 'idiom');
}
function isVulgarPhrase(p) {
  return String(p).toLowerCase().split(/\s+/).some((t) => VULGAR.has(t));
}

/* ---------- VI-P2 corpus ---------- */

function loadCorpus() {
  const map = new Map();
  if (!fs.existsSync(CORPUS_DIR)) return map;
  for (const f of fs.readdirSync(CORPUS_DIR)) {
    if (!f.endsWith('.json')) continue;
    try {
      const arr = JSON.parse(fs.readFileSync(path.join(CORPUS_DIR, f), 'utf8'));
      for (const e of arr) {
        if (e && typeof e.phrase === 'string' && Array.isArray(e.senses) && e.senses.length) {
          map.set(String(e.phrase).normalize('NFC').toLowerCase(), e);
        }
      }
    } catch (err) { console.error(`corpus file skipped (${f}): ${err.message}`); }
  }
  return map;
}

function renderHand(entry) {
  const esc = core.escapeHtml;
  const senses = entry.senses.map((s, i) => {
    const ex = Array.isArray(s.ex)
      ? s.ex.map(([en, vi]) =>
          `<div class="mtd-ex"><p class="mtd-ex-en">${esc(en)}</p><p class="mtd-ex-vi">${esc(vi)}</p></div>`).join('')
      : '';
    return `<div class="hand-sense"><p class="hand-m">${i + 1}. ${esc(s.m)}</p>${s.pat ? `<p class="hand-pat">Cấu trúc: ${esc(s.pat)}</p>` : ''}${ex}</div>`;
  }).join('\n');
  const note = entry.note ? `<p class="hand-note"><b>Lưu ý:</b> ${esc(entry.note)}</p>` : '';
  return `<div class="hand-block">${senses}${note}</div>`;
}

/* ---------- WordNet enrichment ---------- */

// Bundled open data rendered by the app itself; strip NUL terminators and the
// duplicated headword heading, keep the embedded Source footer (attribution).
function sanitizeWn(text, phrase) {
  let t = String(text).replace(/\u0000/g, '').trim();
  const heading = new RegExp('^<p><b[^>]*>\\s*' + core.escapeHtml(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) + '\\s*</b></p>', 'i');
  t = t.replace(heading, '');
  return t.trim();
}

const HAND_STYLES = `
.hand-block{margin-top:16px}
.hand-sense{margin:16px 0;padding-left:14px;border-left:3px solid var(--teal)}
.hand-m{margin:0 0 6px;font-weight:700;font-size:1.05rem}
.hand-pat{margin:4px 0;color:var(--teal-dark);font-weight:600;font-size:.95rem}
.hand-note{margin:18px 0 0;padding:12px 14px;border-radius:8px;background:var(--soft);font-size:.95rem}
.hand-ovdp-h{margin:28px 0 10px;font-size:1.1rem;color:var(--muted)}
.hand-src{margin:6px 0 0;color:var(--muted);font-size:.85rem}
.wn-body{border:1px solid var(--line);border-radius:10px;background:var(--soft);padding:16px 20px;font-size:.97rem}
.wn-body ol{margin:8px 0 8px 18px;padding:0}
.wn-body li{margin:6px 0}
.exam-note{margin-top:24px;border:1px solid var(--line);border-left:4px solid var(--coral);border-radius:10px;background:var(--soft);padding:20px 22px}
.exam-note h2{margin:0 0 6px;font-size:1.25rem}
.exam-sub{margin:0 0 8px;color:var(--muted);font-size:.9rem}
.exam-src{color:var(--muted);font-size:.82rem}
`;

/* ---------- page ---------- */

function phraseMetaDesc(phrase, hand) {
  /* P0 SEO: unique meta per phrase page — first hand sense, else generic. */
  if (hand && Array.isArray(hand.senses) && hand.senses.length && hand.senses[0].m) {
    const m = String(hand.senses[0].m);
    const short = m.length > 140 ? m.slice(0, 140).replace(/\s+\S*$/, '') + '…' : m;
    return `${phrase} nghĩa là: ${short} — Ví dụ minh hoạ và định nghĩa tiếng Anh — tra offline miễn phí trong app Dual Dictionary.`;
  }
  return `${phrase} nghĩa tiếng Việt là gì? Ý nghĩa, các nghĩa thường gặp và ví dụ minh hoạ của cụm "${phrase}" — tra cứu offline miễn phí trong app Dual Dictionary.`;
}

/* P1 exam chips for phrase pages (TOEIC business / IELTS academic). */
function examChips(phrase) {
  const slug = phraseSlug(phrase);
  const t = core.examTagsFor ? core.examTagsFor(null, slug) : null;
  if (!t || !t.tags || !t.tags.length) return '';
  let out = '';
  if (t.tags.includes('toeic')) out += '<span class="chip chip-exam" title="Cụm từ công sở thường gặp trong đề TOEIC">TOEIC Business</span>';
  if (t.tags.includes('ielts')) out += '<span class="chip chip-exam2" title="Cụm từ học thuật, hữu ích cho IELTS Reading/Writing">IELTS</span>';
  return out;
}

function pageHtml({ phrase, ovdpKey, entryHtml, posList, relatedHtml, hand, wnHtml, tier }) {
  const title = `${phrase} nghĩa là gì? | Dual Dictionary`;
  const desc = phraseMetaDesc(phrase, hand);
  const canonical = `${SITE}${phrasePageUrl(phrase)}`;
  const keyNote = ovdpKey && ovdpKey.toLowerCase() !== phrase.toLowerCase()
    ? `\n    <p class="entry-lemma-note">Mục trong từ điển mở: “${core.escapeHtml(ovdpKey)}”.</p>`
    : '';
  /* P1 schema-rich for phrases: about TOEIC/IELTS + first exam example. */
  const pExam = core.examTagsFor ? core.examTagsFor(null, phraseSlug(phrase)) : null;
  const pAbout = [];
  if (pExam && pExam.tags.includes('toeic')) pAbout.push({ '@type': 'Thing', name: 'TOEIC Business', url: `${SITE}/vi/tu/toeic/` });
  if (pExam && pExam.tags.includes('ielts')) pAbout.push({ '@type': 'Thing', name: 'IELTS', url: `${SITE}/vi/tu/ielts/` });
  let pExample = null;
  if (hand && Array.isArray(hand.senses) && hand.senses.length && hand.senses[0].ex && hand.senses[0].ex.length) pExample = hand.senses[0].ex[0][0];
  const badges = `<div class="word-badges"><span class="chip chip-band">Cụm từ</span>${
    posList.map((p) => `<span class="chip chip-core">${core.escapeHtml(p)}</span>`).join('')
  }${hand ? '<span class="chip chip-learn">Biên soạn riêng</span>' : ''}${tier === 'A' ? '<span class="chip chip-band" title="Mọi từ trong cụm thuộc 2.000 từ phổ biến nhất (theo tần suất corpus)">Phổ biến</span>' : ''}${examChips(phrase)}</div>`;
  const showOvdp = entryHtml && !(hand && hand.hideOvdp);
  const showWordNet = wnHtml && !(hand && hand.hideWordNet);
  const body = (hand
    ? renderHand(hand)
      + (showOvdp ? `<h2 class="hand-ovdp-h">Mục từ điển mở (OVDP)</h2>${entryHtml}` : '')
      + `<p class="hand-src">Nghĩa tiếng Việt do Dual Dictionary biên soạn — mang tính tham khảo, dùng song song với từ điển trong app.</p>`
    : (entryHtml || '<p class="word-empty">Chưa có dữ liệu nghĩa chi tiết cho cụm từ này trong bản từ điển hiện tại.</p>'))
    + (showWordNet ? `<h2 class="hand-ovdp-h">Định nghĩa tiếng Anh (WordNet 3.1)</h2><div class="wn-body">${wnHtml}</div>` : '');
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'DefinedTerm',
        name: phrase,
        alternateName: posList.length ? `${phrase} (${posList.join(', ')})` : undefined,
        description: desc,
        inDefinedTermSet: {
          '@type': 'DefinedTermSet',
          name: 'Từ điển Anh-Việt Dual Dictionary',
          url: `${SITE}/vi/`,
        },
        url: canonical,
        termCode: phrase,
        ...(pAbout.length ? { about: pAbout } : {}),
        ...(pExample ? { example: pExample } : {}),
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Trang chủ', item: `${SITE}/vi/` },
          { '@type': 'ListItem', position: 2, name: 'Từ điển', item: `${SITE}/vi/tu/` },
          { '@type': 'ListItem', position: 3, name: 'Cụm từ', item: `${SITE}/vi/tu/cum-tu/` },
          { '@type': 'ListItem', position: 4, name: phrase, item: canonical },
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
<title>${core.escapeHtml(title)}</title>
<meta name="description" content="${core.escapeHtml(desc)}">
<link rel="canonical" href="${canonical}">
<meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large">
<meta property="og:type" content="article">
<meta property="og:locale" content="vi_VN">
<meta property="og:site_name" content="Dual Dictionary">
<meta property="og:url" content="${canonical}">
<meta property="og:title" content="${core.escapeHtml(title)}">
<meta property="og:description" content="${core.escapeHtml(desc)}">
<meta name="twitter:card" content="summary">
<meta name="twitter:title" content="${core.escapeHtml(title)}">
<link rel="stylesheet" href="/vi/blog/blog.css">
<link rel="stylesheet" href="/vi/tu/word.css">
<style>${HAND_STYLES}</style>
<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
</head>
<body class="word-page">
${navHtml('cum-tu')}
<nav class="breadcrumb" aria-label="Breadcrumb">
  <a href="/vi/">Trang chủ</a> › <a href="/vi/tu/">Từ điển</a> › <a href="/vi/tu/cum-tu/">Cụm từ</a> › <span aria-current="page">${core.escapeHtml(phrase)}</span>
</nav>

<main class="page">
  <header class="word-head">
    <p class="word-kicker">Nghĩa tiếng Việt của</p>
    <h1>${core.escapeHtml(phrase)}</h1>
    ${badges}${keyNote}
    <div class="entry-body">${body}</div>
    <div class="word-cta">
      <div class="word-cta-actions">
        <a class="word-cta-btn" href="/?q=${encodeURIComponent(phrase)}">Tra "${core.escapeHtml(phrase)}" trong app offline ↗</a>
      </div>
      <p class="word-cta-note">App Dual Dictionary: từ điển Anh-Việt offline, không cần mạng, không tài khoản.</p>
      <p class="word-report"><a href="mailto:${REPORT_EMAIL}?subject=${encodeURIComponent(`Lỗi mục từ "${phrase}" — Dual Dictionary`)}">Phát hiện lỗi (nghĩa, ví dụ)? Báo qua email — mình sửa trong bản tới.</a></p>
    </div>
  </header>

  ${relatedHtml}

  ${phraseExamHtml(phrase)}
</main>

<footer class="blog-footer">
  <p><a href="/vi/">Dual Dictionary</a> — từ điển &amp; công cụ học từ vựng offline-first cho người Việt.</p>
</footer>
</body>
</html>
`;
}

/* P1 exam examples on phrase pages (same hand-written seed as words). */
function phraseExamHtml(phrase) {
  const fs = require('fs');
  const path = require('path');
  let db = null;
  try { db = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'exam-examples.json'), 'utf8')); }
  catch (e) { return ''; }
  const pl = String(phrase).toLowerCase();
  const list = db.phrases && (db.phrases[pl] || db.phrases[pl.replace(/ /g, '-')]);
  if (!list || !list.length) return '';
  const esc = core.escapeHtml;
  const rows = list.map(([en, vi, src]) =>
    `<div class="mtd-ex"><span class="mtd-ex-en">${esc(en)}</span> — <span class="mtd-ex-vi">${esc(vi)}</span>${src ? ` <span class="exam-src">(${esc(src)})</span>` : ''}</div>`).join('\n');
  return `<section class="exam-note"><h2>Ví dụ thi</h2><p class="exam-sub">Câu mẫu viết tay theo văn TOEIC / IELTS — dùng lại được trong bài thi.</p>\n${rows}</section>`;
}
function relatedHtml(phrase, prepKeys, wordSlugSet) {
  const chips = [];
  for (const tok of phrase.toLowerCase().split(/\s+/)) {
    const t = tok.replace(/[^a-z'’-]/g, '');
    if (t.length > 1 && wordSlugSet.has(t) && !chips.some((c) => c.label === t)) {
      chips.push({ label: t, href: `/vi/tu/${encodeURIComponent(t)}/` });
    }
    if (chips.length >= 4) break;
  }
  const first = phrase.toLowerCase().split(/\s+/)[0];
  for (const other of prepKeys) {
    if (chips.length >= 8) break;
    if (other === phrase) continue;
    if (other.toLowerCase().startsWith(first + ' ')) {
      chips.push({ label: other, href: phrasePageUrl(other) });
    }
  }
  if (!chips.length) return '';
  return `<section class="related"><h2>Liên quan</h2><div class="related-list">${
    chips.map((c) => `<a class="related-chip" href="${c.href}">${core.escapeHtml(c.label)}</a>`).join('')
  }</div></section>`;
}

/* ---------- phrase hub /vi/tu/cum-tu/ (VI-P1 internal linking, 15/10/2026) ----------
 * Same pattern as the word hub in build-word-pages.cjs: static HTML + client-side
 * search, no tracking, no backend. 3 columns (responsive), substring search over
 * slug AND original phrase, with a hand-written filter only when it distinguishes
 * a subset of entries. Overwritten
 * every build; "cum-tu" belongs to NO manifest, so no builder can ever wipe it. */
function phraseHubHtml({ built, prep, handCount, wordCount }) {
  const esc = core.escapeHtml;
  /* Crawl-triage (02/11): SSR first 500, rest via Hiện-thêm button (same data
   * shape, no extra fetch) — HTML drops 560KB to ~75KB for Googlebot. */
  const SSR_N = 500;
  const rowOf = (phrase) => {
    const slug = phraseSlug(phrase);
    const p5 = prep.get(phrase);
    const hand = !!(p5 && p5.hand);
    const common = !!(p5 && p5.tier === 'A');
    const exam = (core.examTagsFor ? (core.examTagsFor(null, slug) || {}).tags : []) || [];
    return `    <li data-word="${esc(slug)}" data-phrase="${esc(phrase.toLowerCase())}"${hand ? ' data-hand="1"' : ''}${common ? ' data-common="1"' : ''}${exam.length ? ` data-exam="${esc(exam.join(' '))}"` : ''}><a href="${phrasePageUrl(phrase)}">${esc(phrase)}</a></li>`;
  };
  const rows = built.slice(0, SSR_N).map(rowOf).join('\n');
  const restRows = built.slice(SSR_N).map(rowOf).join('\n');
  phraseHubHtml.restRows = restRows;
  /* Rest list lives in an external file (same pattern as word hub-index.js)
   * so crawlers only fetch the 65KB SSR shell. */
  const hubRestName = 'hub-rest.js';
  const title = `${built.length} cụm từ tiếng Anh — danh sách A–Z | Dual Dictionary`;
  const desc = `Danh sách ${built.length} cụm từ tiếng Anh (phrasal verbs, collocations, idiom) kèm nghĩa tiếng Việt, ví dụ minh hoạ và định nghĩa tiếng Anh WordNet 3.1. ${handCount} cụm có phần nghĩa tiếng Việt biên soạn riêng cho người Việt học tiếng Anh.`;
  const canonical = `${SITE}/vi/tu/cum-tu/`;
  return `<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${canonical}">
<meta name="robots" content="index, follow">
<meta property="og:type" content="article">
<meta property="og:locale" content="vi_VN">
<meta property="og:site_name" content="Dual Dictionary">
<meta property="og:url" content="${canonical}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta name="twitter:card" content="summary">
<meta name="twitter:title" content="${esc(title)}">
<script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@graph': [{ '@type': 'CollectionPage', name: title, description: desc, url: canonical, inLanguage: 'vi' }, { '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Trang chủ', item: `${SITE}/vi/` }, { '@type': 'ListItem', position: 2, name: 'Từ điển', item: `${SITE}/vi/tu/` }, { '@type': 'ListItem', position: 3, name: 'Cụm từ', item: canonical }] }] })}</script>
<link rel="stylesheet" href="/vi/blog/blog.css">
<link rel="stylesheet" href="/vi/tu/word.css">
<style>.hub-tab{cursor:pointer;border:1px solid rgba(0,0,0,.18);background:transparent}.hub-tab[aria-pressed="true"]{font-weight:700;box-shadow:inset 0 0 0 1.5px currentColor}@media (max-width:900px){#hub-list{columns:2 !important}}@media (max-width:600px){#hub-list{columns:1 !important}}.hub-filters{position:relative}.hub-suggest{position:absolute;z-index:20;max-width:480px;background:#fff;border:1px solid var(--line);border-radius:10px;box-shadow:0 12px 30px rgba(23,32,38,.12);overflow:hidden}.hub-suggest a{display:flex;gap:8px;align-items:baseline;padding:9px 14px;text-decoration:none;color:var(--ink)}.hub-suggest a:hover,.hub-suggest a.active{background:var(--soft)}.hub-suggest .sg-tag{margin-left:auto;font-size:.75rem;color:var(--muted);white-space:nowrap}.hub-suggest button{display:flex;width:100%;gap:8px;align-items:baseline;padding:9px 14px;background:none;border:0;font:inherit;color:var(--ink);cursor:pointer;text-align:left}.hub-suggest button:hover,.hub-suggest button.active{background:var(--soft)}</style>
</head>
<body class="word-page">
${navHtml('cum-tu')}
<nav class="breadcrumb" aria-label="Breadcrumb"><a href="/vi/">Trang chủ</a> › <a href="/vi/tu/">Từ điển</a> › <span aria-current="page">Cụm từ</span></nav>
<main class="page">
  <p class="word-kicker">Cụm từ tiếng Anh</p>
  <h1 style="font-size:2.4rem">${built.length} cụm từ tiếng Anh — phrasal verbs, collocations, idioms</h1>
  <p style="color:var(--muted)">Mỗi cụm có trang riêng: nghĩa tiếng Việt, ví dụ minh hoạ và (nếu có) định nghĩa tiếng Anh WordNet 3.1. Danh sách gồm phrasal verbs, collocations và idioms — từ thông dụng đến thuật ngữ chuyên ngành; ${handCount === built.length ? `toàn bộ ${built.length.toLocaleString('vi-VN')} cụm có nghĩa tiếng Việt biên soạn riêng` : `${handCount.toLocaleString('vi-VN')} cụm có nghĩa tiếng Việt biên soạn riêng`}. Đang tìm từ đơn? Xem <a href="/vi/tu/">danh sách ${wordCount ? `${wordCount.toLocaleString('vi-VN')} từ` : 'các từ'} tiếng Anh</a>.</p>
  <div class="hub-filters">
    <div style="margin:0 0 10px"><a class="related-chip" style="text-decoration:none" href="/?deck=toeic">💼 Luyện TOEIC Business trong app ↗</a></div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin:0 0 10px" role="group" aria-label="Lọc danh sách cụm từ">
      <button type="button" class="chip chip-band hub-tab" data-filter="all" aria-pressed="true">Tất cả</button>${handCount > 0 && handCount < built.length ? '\n      <button type="button" class="chip chip-learn hub-tab" data-filter="hand" aria-pressed="false">Biên soạn riêng</button>' : ''}
      <button type="button" class="chip chip-band hub-tab" data-filter="common" aria-pressed="false" title="Mọi từ trong cụm thuộc 2.000 từ phổ biến nhất">Phổ biến</button>
      <button type="button" class="chip chip-exam hub-tab" data-filter="toeic" aria-pressed="false" title="Cụm từ công sở thường gặp trong đề TOEIC">TOEIC</button>
      <button type="button" class="chip chip-exam2 hub-tab" data-filter="ielts" aria-pressed="false" title="Cụm từ học thuật cho IELTS">IELTS</button>
    </div>
    <input id="hub-q" type="search" placeholder="Tìm cụm từ… (vd: run out, take care)" aria-label="Tìm cụm từ trong danh sách" autocomplete="off">
    <div id="hub-suggest" class="hub-suggest" hidden></div>
    <span id="hub-count" aria-live="polite"></span>
  </div>
  <ul class="hub-list" id="hub-list" style="columns:3;gap:20px;padding-left:18px;line-height:2">
${rows}
  </ul>
  <p id="hub-more-wrap" style="margin:14px 0 0"><button type="button" id="hub-more" class="related-chip" style="cursor:pointer">Hiện thêm (${(built.length - SSR_N).toLocaleString('vi-VN')} cụm còn lại)</button></p>
</main>
<footer class="blog-footer"><p><a href="/vi/">Dual Dictionary</a> — từ điển &amp; công cụ học từ vựng offline-first cho người Việt.</p></footer>
<script>
(function () {
  var q = document.getElementById('hub-q');
  var count = document.getElementById('hub-count');
  var items = Array.prototype.slice.call(document.querySelectorAll('#hub-list li'));
  var tabs = Array.prototype.slice.call(document.querySelectorAll('.hub-tab'));
  var filter = 'all';
  var moreBtn = document.getElementById('hub-more');
  var moreWrap = document.getElementById('hub-more-wrap');
  function renderRest() {
    var done = function (html) {
      var list = document.getElementById('hub-list');
      list.insertAdjacentHTML('beforeend', html);
      items = Array.prototype.slice.call(document.querySelectorAll('#hub-list li'));
      if (moreWrap) moreWrap.style.display = 'none';
    };
    var rest = document.getElementById('hub-rest');
    if (rest) { var html = rest.textContent; rest.remove(); done(html); return; }
    if (window.__PHRASE_REST__) { done(window.__PHRASE_REST__); return; }
    var s = document.createElement('script');
    s.src = '/vi/tu/cum-tu/hub-rest.js';
    s.onload = function () { done(window.__PHRASE_REST__ || ''); };
    s.onerror = function () { if (moreWrap) moreWrap.style.display = 'none'; };
    document.head.appendChild(s);
  }
  if (moreBtn) moreBtn.addEventListener('click', function () { renderRest(); apply(); });
  function matchFilter(it) {
    if (filter === 'hand') return it.dataset.hand === '1';
    if (filter === 'common') return it.dataset.common === '1';
    if (filter === 'toeic' || filter === 'ielts') return (it.dataset.exam || '').split(' ').indexOf(filter) !== -1;
    return true;
  }
  function apply() {
    // searching/filtering implies the full list: render rest once
    var term0 = q.value.trim();
    if ((term0 || filter !== 'all') && document.getElementById('hub-rest')) renderRest();
  if ((term0 || filter !== 'all') && !window.__PHRASE_REST__ && !document.getElementById('hub-rest')) { renderRest(); return; }
    var term = term0.toLowerCase();
    var shown = 0;
    for (var it of items) {
      var ok = matchFilter(it) && (!term || it.dataset.word.indexOf(term) !== -1 || it.dataset.phrase.indexOf(term) !== -1);
      it.style.display = ok ? '' : 'none';
      if (ok) shown++;
    }
    count.textContent = 'Hiển thị ' + shown + '/' + items.length + ' cụm từ';
  }
  tabs.forEach(function (btn) {
    btn.addEventListener('click', function () {
      filter = btn.dataset.filter;
      tabs.forEach(function (b) { b.setAttribute('aria-pressed', String(b === btn)); });
      apply();
    });
  });
  ['input', 'change'].forEach(function (ev) { q.addEventListener(ev, apply); });
  apply();
  /* P1 autocomplete for phrases (owner-approved 01/11): substring/prefix over
   * the rendered list (no fetch). Up/Down + Enter + Esc. */
  var sgBox = document.getElementById('hub-suggest');
  function esc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
  function tagOf(it){ var e=it.dataset.exam||''; if(e.indexOf('toeic')!==-1)return 'TOEIC'; if(e.indexOf('ielts')!==-1)return 'IELTS'; return ''; }
  var sgIdx=-1;
  function suggest(term){
    term=String(term||'').toLowerCase().trim();
    if(term.length<2) return [];
    var pre=[],sub=[],i,it,ph;
    for(i=0;i<items.length&&(pre.length<5||sub.length<3);i++){ it=items[i]; ph=it.dataset.phrase||'';
      if(ph.indexOf(term)===0) pre.push(it); else if(ph.indexOf(term)!==-1) sub.push(it); }
    return pre.concat(sub).slice(0,8);
  }
  function renderSg(list2){
    if(!sgBox) return;
    if(!list2.length){ sgBox.hidden=true; sgBox.innerHTML=''; sgIdx=-1; return; }
    /* link-check-safe: suggestion rows carry data-h only (JS navigates). */
    sgBox.innerHTML=list2.map(function(it,i){
      var a=it.querySelector('a'); var t=tagOf(it);
      return '<button type="button" data-h="'+a.getAttribute('href')+'">'+esc(a.textContent)+(t?' <span class="sg-tag">'+t+'</span>':'')+'</button>';
    }).join('');
    sgBox.hidden=false; sgIdx=-1;
    var btns=sgBox.querySelectorAll('button[data-h]');
    for(var b=0;b<btns.length;b++) btns[b].addEventListener('click', function(){ window.location.href=this.getAttribute('data-h'); });
  }
  var sgT=null;
  q.addEventListener('input', function(){ if(sgT)clearTimeout(sgT); sgT=setTimeout(function(){renderSg(suggest(q.value));},120); });
  q.addEventListener('keydown', function(ev){
    if(!sgBox||sgBox.hidden) return;
    var links=sgBox.querySelectorAll('button[data-h]');
    if(ev.key==='ArrowDown'||ev.key==='ArrowUp'){ ev.preventDefault();
      sgIdx=ev.key==='ArrowDown'?Math.min(sgIdx+1,links.length-1):Math.max(sgIdx-1,0);
      for(var i=0;i<links.length;i++) links[i].classList.toggle('active',i===sgIdx);
    } else if(ev.key==='Enter'&&sgIdx>=0&&links[sgIdx]){ ev.preventDefault(); window.location.href=links[sgIdx].getAttribute('data-h'); }
    else if(ev.key==='Escape'){ sgBox.hidden=true; }
  });
  document.addEventListener('click', function(ev){ if(sgBox&&!sgBox.hidden&&!sgBox.contains(ev.target)&&ev.target!==q) sgBox.hidden=true; });
})();
</script>
</body>
</html>
`;
}
async function main() {
  const mdxPath = path.join(REPO, 'dicts-en-vi', 'star_anhviet.mdx');
  const list = JSON.parse(fs.readFileSync(LIST_PATH, 'utf8'));
  const corpus = loadCorpus();

  const wordSlugSet = new Set();
  if (fs.existsSync(WORD_MANIFEST_PATH)) {
    const wm = JSON.parse(fs.readFileSync(WORD_MANIFEST_PATH, 'utf8'));
    for (const s of wm.slugs || []) wordSlugSet.add(s);
  }

  const buf = fs.readFileSync(mdxPath);
  const dict = new MDict(new Blob([buf]), 'star_anhviet.mdx');
  await dict.init();
  const allKeys = (await dict.loadAllKeys()).map(String);
  const exactSet = new Set(allKeys);
  const normMap = new Map();
  for (const k of allKeys) {
    const nk = dict.normKey(k);
    if (!normMap.has(nk)) normMap.set(nk, k);
  }

  // WordNet 3.1 — bundled open data, the enrichment layer
  const wn = new MDict(new Blob([fs.readFileSync(WORDNET_PATH)]), 'wordnet31.mdx');
  await wn.init();
  const wnKeys = (await wn.loadAllKeys()).map((k) => String(k).normalize('NFC').toLowerCase().replace(/\s+/g, ' ').trim());
  const wnExact = new Set(wnKeys);
  const wnNormMap = new Map();
  const wnNk = (s) => s.toLowerCase().replace(/[\s\-.,:;!?'’"()\[\]{}\/\\]/g, '');
  for (const k of wnKeys) {
    const n = wnNk(k);
    if (!wnNormMap.has(n)) wnNormMap.set(n, k);
  }
  const wnCache = new Map();
  async function wnLookup(phrase) {
    if (wnCache.has(phrase)) return wnCache.get(phrase);
    let html = '';
    const key = wnExact.has(phrase) ? phrase : wnNormMap.get(wnNk(phrase));
    if (key) {
      try {
        const r = await wn.lookup(key);
        if (r && r[0] && r[0].text) html = sanitizeWn(String(r[0].text), phrase);
      } catch (e) { /* leave empty */ }
    }
    wnCache.set(phrase, html);
    return html;
  }

  const allPhrases = [...new Set([
    ...list.phrases.map((p) => String(p).normalize('NFC')),
    ...[...corpus.keys()],
  ])].sort();

  /* VI-FIXA (16/10/2026): same multi-entry rule as the word builder — OVDP
   * holds capitalised term-bank entries that can sort before the real
   * dictionary key; pick the result with the most content blocks, ties prefer
   * the exact key. */
  const lookupBestPhraseEntry = async (dict, w) => {
    let r;
    try { r = await dict.lookup(w); } catch (e) { return ''; }
    if (!Array.isArray(r) || r.length === 0) return '';
    if (r.length === 1) return r[0] && r[0].text ? r[0].text : '';
    const nBlocks = (t) => {
      try {
        return core.mtdToBlocks(core.sanitizeRaw(t)).filter((b) => b.type === 'sense' || b.type === 'line' || b.type === 'idiom').length;
      } catch (e) { return 0; }
    };
    const scored = r.map((x) => ({ text: x && x.text ? x.text : '', rich: nBlocks(x.text || ''), exact: x && x.keyText === w ? 1 : 0 }));
    scored.sort((a, b) => b.rich - a.rich || b.exact - a.exact);
    return scored[0].text;
  };

  const removedNoSource = [];
  const removedEmpty = [];
  const removedFat = [];
  const removedAbbrev = [];
  const removedThin = [];
  const removedVulgar = [];
  const removedCollision = [];
  const prep = new Map();
  const seenSlugs = new Set();

  for (const phrase of allPhrases) {
    const slug = phraseSlug(phrase);
    if (seenSlugs.has(slug)) { removedCollision.push(`${phrase} (dup)`); continue; }
    if (wordSlugSet.has(slug)) { removedCollision.push(`${phrase} (word page)`); continue; }
    seenSlugs.add(slug);
    if (isVulgarPhrase(phrase)) { removedVulgar.push(phrase); continue; }
    let ovdpKey = null;
    if (exactSet.has(phrase)) ovdpKey = phrase;
    else if (normMap.has(dict.normKey(phrase))) ovdpKey = normMap.get(dict.normKey(phrase));
    const hand = corpus.get(phrase.toLowerCase()) || null;
    if (!ovdpKey && !hand) { removedNoSource.push(phrase); continue; }

    let raw = '';
    if (ovdpKey && !hand) {
      try {
        const t0 = await lookupBestPhraseEntry(dict, ovdpKey);
        if (t0) raw = t0;
      } catch (e) { /* leave raw empty */ }
      if (!raw.trim() || !entryHasContent(raw)) { removedEmpty.push(phrase); continue; }
      if (raw.length > FAT_CAP) { removedFat.push(phrase); continue; }
      if (ABBREV_RE.test(core.sanitizeRaw(raw))) { removedAbbrev.push(phrase); continue; }
      raw = core.dropLeadingIpaFragment(core.applyOvdpFixes(phrase, raw));
      if (!raw.trim() || !entryHasContent(raw)) { removedEmpty.push(phrase); continue; }
    } else if (ovdpKey && hand) {
      // co-render path: no admission gates (hand is the primary content),
      // but never render an empty/junk OVDP fragment under it
      try {
        const t0 = await lookupBestPhraseEntry(dict, ovdpKey);
        if (t0 && entryHasContent(t0)) raw = t0;
      } catch (e) { /* leave raw empty */ }
    }

    // WordNet enrichment + RICH BAR (owner directive: rich or remove)
    const wnHtml = await wnLookup(phrase);
    let blocks = 0;
    let hasEx = false;
    if (raw) {
      blocks = core.mtdToBlocks(core.sanitizeRaw(raw))
        .filter((b) => b.type === 'sense' || b.type === 'line' || b.type === 'idiom').length;
      hasEx = /=[^=\n]*?\+/.test(core.sanitizeRaw(raw));
    }
    const rich = !!hand || (blocks >= 2 && hasEx) || (!!wnHtml && blocks >= 1);
    if (!rich) { removedThin.push(phrase); continue; }
    prep.set(phrase, { raw, ovdpKey, hand, wnHtml, tier: phraseTier(phrase) });
  }
  console.log(`Phrases: ${allPhrases.length} in queue (wordlist ${list.count} + corpus ${corpus.size}) — admitted ${prep.size}; removed ` +
    `${removedNoSource.length} no-source + ${removedEmpty.length} empty + ${removedFat.length} fat + ` +
    `${removedAbbrev.length} abbrev + ${removedThin.length} NOT-RICH + ${removedVulgar.length} vulgar + ${removedCollision.length} slug-collision`);

  /* VI-THIN (16/10/2026, owner decision: thin cụm từ -> remove luôn): render
   * each page once to measure REAL content (same extraction as the 16/10
   * audit: main minus word-cta/word-report boilerplate), drop entries under
   * MIN_CONTENT_WORDS before ownership/manifest/hub/sitemap. Removed URLs
   * were never pushed, so no redirects; re-admit later by enriching via
   * data/vi-phrase-defs/ (VI-P2 pipeline) and rebuilding. */
  const MIN_CONTENT_WORDS = 60;
  const removedThinShort = [];
  const renderPhrasePage = (phrase, p, forGate) => {
    const posList = [];
    if (p.raw && !(p.hand && p.hand.hideOvdp)) {
      for (const b of core.mtdToBlocks(core.sanitizeRaw(p.raw))) {
        if (b.type === 'pos' && !posList.includes(b.text)) posList.push(b.text);
      }
    }
    if (p.hand && p.hand.pos) posList.unshift(p.hand.pos);
    return pageHtml({
      phrase,
      ovdpKey: p.ovdpKey,
      entryHtml: p.raw ? core.renderEntry(p.raw) : '',
      posList,
      relatedHtml: relatedHtml(phrase, [...prep.keys()], wordSlugSet),
      hand: p.hand,
      wnHtml: p.wnHtml,
      tier: forGate ? '' : p.tier,
    });
  };
  {
    const stripTagsX = (s) => s.replace(/<[^>]+>/g, ' ').replace(/&#39;/g, "'").replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim();
    const wcX = (s) => (s ? s.split(' ').filter(Boolean).length : 0);
    const contentWordsOf = (html) => {
      const mainM = html.match(/<main[^>]*>([\s\S]*?)<\/main>/);
      if (!mainM) return 0;
      // word-cta/word-report are stripped via top-level div segmentation below;
      // related chips are navigation, not content — strip the section here so
      // the metric is independent of how many sibling phrases exist.
      const main = mainM[1].replace(/<script[\s\S]*?<\/script>/g, '')
        .replace(/<section class="related">[\s\S]*?<\/section>/g, ' ');
      let depth = 0, start = -1, openTag = '', content = main;
      const re = /<(\/?)div([^>]*)>/g;
      const drop = [];
      let m;
      while ((m = re.exec(main))) {
        if (!m[1]) { if (depth === 0) { start = m.index; openTag = m[2]; } depth++; }
        else { depth--; if (depth === 0 && start >= 0) { drop.push({ openTag, seg: main.slice(start, re.lastIndex) }); start = -1; } }
      }
      for (const seg of drop) {
        if (/class="(?:word-cta|word-report|related)[\s"]/.test(seg.openTag)) content = content.replace(seg.seg, ' ');
      }
      return wcX(stripTagsX(content));
    };
    for (const [phrase, p] of [...prep]) {
      // hand-written defs are curated (owner decision 16/10): exempt from the
      // auto word-count gate — 4.2 owner review decides their fate one by one.
      if (!p.hand && contentWordsOf(renderPhrasePage(phrase, p, true)) < MIN_CONTENT_WORDS) { removedThinShort.push(phrase); prep.delete(phrase); }
    }
  }
  if (removedThinShort.length) console.log(`VI-THIN: removed ${removedThinShort.length} phrase pages under ${MIN_CONTENT_WORDS} content words (samples: ${removedThinShort.slice(0, 8).join(', ')}${removedThinShort.length > 8 ? '…' : ''})`);

  /* ownership cleanup BEFORE writing */
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const newSlugs = [...prep.keys()].map(phraseSlug);
  const newSlugSet = new Set(newSlugs);
  let ownedSlugs = null;
  if (fs.existsSync(MANIFEST_PATH)) {
    try { ownedSlugs = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8')).slugs || []; }
    catch (e) { ownedSlugs = null; }
  }
  ownedSlugs = ownedSlugs || [];
  let removedStale = 0;
  for (const slug of ownedSlugs) {
    if (!newSlugSet.has(slug)) {
      fs.rmSync(path.join(OUT_DIR, slug), { recursive: true, force: true });
      removedStale++;
    }
  }

  const built = [];
  let builtHand = 0;
  let builtWn = 0;
  for (const [phrase, p] of prep) {
    const html = renderPhrasePage(phrase, p);
    const dir = path.join(OUT_DIR, phraseSlug(phrase));
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'index.html'), html);
    built.push(phrase);
    if (p.hand) builtHand++;
    if (p.wnHtml) builtWn++;
  }

  const builtEntries = built
    .map((phrase) => ({ slug: phraseSlug(phrase), phrase, hand: !!(prep.get(phrase) && prep.get(phrase).hand) }))
    .sort((a, b) => a.slug.localeCompare(b.slug));
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(
    { v: 1, source: 'tools/build-phrase-pages.cjs', count: newSlugs.length, slugs: newSlugs.sort(), entries: builtEntries },
  ));

  /* phrase hub — /vi/tu/cum-tu/index.html (overwritten every build; owned by
   * no manifest, so neither builder can ever wipe it) */
  const hubDir = path.join(OUT_DIR, 'cum-tu');
  fs.mkdirSync(hubDir, { recursive: true });
  /* Rest rows live in hub-rest.js (external, cacheable) — crawlers fetch the
   * 75KB SSR shell only. Inline fallback kept when rest is small. */
  const hubHtml = phraseHubHtml({
    built, prep, handCount: builtHand, wordCount: wordSlugSet.size,
  });
  fs.writeFileSync(path.join(hubDir, 'hub-rest.js'), `window.__PHRASE_REST__=${JSON.stringify(phraseHubHtml.restRows || '')};`);
  fs.writeFileSync(path.join(hubDir, 'index.html'), hubHtml);
  console.log(`HUB: /vi/tu/cum-tu/index.html — ${built.length} entries (${builtHand} hand-written)`);

  const LASTMOD = new Date().toISOString().slice(0, 10);
  const sitemapDir = path.join(OUT_DIR, 'sitemap');
  fs.mkdirSync(sitemapDir, { recursive: true });
  for (const f of fs.readdirSync(sitemapDir)) {
    if (/^phrases-\d+\.xml$/.test(f) || f === 'phrases-index.xml') {
      fs.rmSync(path.join(sitemapDir, f), { force: true });
    }
  }
  const CHUNK = 2000;
  const chunks = [];
  const builtSlugs = built.map(phraseSlug);
  for (let i = 0; i < builtSlugs.length; i += CHUNK) chunks.push(builtSlugs.slice(i, i + CHUNK));
  const sitemapIndexEntries = [];
  chunks.forEach((chunk, i) => {
    const name = `phrases-${String(i + 1).padStart(3, '0')}.xml`;
    const urls = chunk
      .map((s) => `  <url><loc>${SITE}/vi/tu/${encodeURIComponent(s)}/</loc><lastmod>${LASTMOD}</lastmod><changefreq>monthly</changefreq><priority>0.6</priority></url>`)
      .join('\n');
    fs.writeFileSync(
      path.join(sitemapDir, name),
      `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`,
    );
    sitemapIndexEntries.push(`  <sitemap><loc>${SITE}/vi/tu/sitemap/${name}</loc><lastmod>${LASTMOD}</lastmod></sitemap>`);
  });
  fs.writeFileSync(
    path.join(sitemapDir, 'phrases-index.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sitemapIndexEntries.join('\n')}\n</sitemapindex>\n`,
  );
  /* P1 sitemap-tag: TOEIC + IELTS phrase clusters. */
  const tagP = { toeic: [], ielts: [] };
  for (const phrase of built) {
    const t = (core.examTagsFor ? (core.examTagsFor(null, phraseSlug(phrase)) || {}).tags : []) || [];
    if (t.includes('toeic')) tagP.toeic.push(phraseSlug(phrase));
    if (t.includes('ielts')) tagP.ielts.push(phraseSlug(phrase));
  }
  for (const [tag, slugs] of Object.entries(tagP)) {
    if (!slugs.length) continue;
    const name = `phrases-${tag}.xml`;
    fs.writeFileSync(
      path.join(sitemapDir, name),
      `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${slugs.map((s) => `  <url><loc>${SITE}/vi/tu/${encodeURIComponent(s)}/</loc><lastmod>${LASTMOD}</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>`).join('\n')}\n</urlset>\n`,
    );
    sitemapIndexEntries.push(`  <sitemap><loc>${SITE}/vi/tu/sitemap/${name}</loc><lastmod>${LASTMOD}</lastmod></sitemap>`);
  }
  fs.writeFileSync(
    path.join(sitemapDir, 'phrases-index.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sitemapIndexEntries.join('\n')}\n</sitemapindex>\n`,
  );
  console.log(`TAG-SITEMAP phrases: toeic ${tagP.toeic.length} · ielts ${tagP.ielts.length}`);

  const builtByTier = { A: 0, B: 0, C: 0, D: 0 };
  for (const phrase of built) { const p5 = prep.get(phrase); builtByTier[p5 && p5.tier ? p5.tier : 'D']++; }
  console.log(`FREQ TIERS (built): A ${builtByTier.A} · B ${builtByTier.B} · C ${builtByTier.C} · D ${builtByTier.D} — "Phổ biến" chip = tier A`);
  const qa = {
    summary: {
      inQueue: allPhrases.length,
      built: built.length,
      builtHand,
      builtByTier,
      builtWordNet: builtWn,
      removedNoSource: removedNoSource.length,
      removedEmpty: removedEmpty.length,
      removedFat: removedFat.length,
      removedAbbrev: removedAbbrev.length,
      removedThin: removedThin.length,
      removedThinShort: removedThinShort.length,
      removedVulgar: removedVulgar.length,
      removedCollision: removedCollision.length,
      removedStale,
      generatedAt: new Date().toISOString(),
    },
    samples: {
      removedNoSource: removedNoSource.slice(0, 150),
      removedEmpty: removedEmpty.slice(0, 100),
      removedThinShort: removedThinShort.slice(0, 150),
      removedCollision: removedCollision.slice(0, 100),
      removedVulgar: removedVulgar.slice(0, 50),
    },
  };
  fs.writeFileSync(QA_PATH, JSON.stringify(qa, null, 2));
  console.log(`QA: ${JSON.stringify(qa.summary)}`);
  console.log(`DONE: ${built.length} phrase pages (${builtHand} hand-written, ${builtWn} with WordNet section) -> vi/tu/{phrase}/index.html`);
  console.log(`Sitemap: ${chunks.length} chunk(s) + phrases-index.xml (word sitemap files untouched)`);
}

if (require.main === module) {
  main().catch((e) => {
    console.error('FATAL:', e);
    process.exit(1);
  });
}
module.exports = { phraseSlug, phrasePageUrl, entryHasContent, pageHtml, loadCorpus, renderHand };
