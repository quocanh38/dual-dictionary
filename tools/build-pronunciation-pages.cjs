#!/usr/bin/env node
const { safeJsonLd } = require('./seo-shared.cjs');
/* Pronunciation pages (nhanh 2 / phat-am): /vi/phat-am/{word}/
 * "Cach phat am {word} (IPA + audio My-Anh)" + player My + Anh (reuse audio-tag
 * pattern tu build-word-pages.cjs) + IPA US/UK + loi hay sai + 3 minimal pairs
 * link ve trang tu (manifest guard, else /?q=) + tips + hub + FAQPage + Speakable.
 * Owned by NO manifest: never wiped. */
const fs = require('fs');
const path = require('path');
const core = require('./build-word-pages.cjs');
const { navHtml } = require('./nav-partial.cjs');
const { hubListHtml } = require('./hub-lazy-lib.cjs');
const { blogLinksHtml } = require('./blog-links-lib.cjs');

const REPO = path.join(__dirname, '..');
const OUT_DIR = path.join(REPO, 'vi', 'phat-am');
const SITE = core.SITE;
const esc = core.escapeHtml;

// Tier1 helpers
const IPA_DESC = {
  'θ': 'th không rung — lưỡi giữa hai răng, thổi hơi, không rung dây thanh',
  'ð': 'th rung — lưỡi giữa hai răng, rung dây thanh',
  'ʃ': 'sh — chu môi, lưỡi gần vòm cứng, hơi xát',
  'ʒ': 's rung — chu môi, rung dây thanh',
  'tʃ': 'ch bật — đầu lưỡi chạm lợi, bật hơi mạnh',
  'dʒ': 'j rung — như tʃ nhưng rung',
  'ŋ': 'ng mũi — cuống lưỡi chạm ngạc mềm, hơi ra mũi',
  'æ': 'a bẹt — hạ hàm, miệng mở ngang rộng',
  'ɑ': 'a mở sau — miệng mở tròn, lưỡi hạ',
  'ɔ': 'o mở — tròn môi, lưỡi lùi',
  'ʌ': 'a ngắn — miệng hé, lưỡi giữa',
  'ə': 'ơ lơi — miệng thả lỏng, âm không nhấn',
  'ɚ': 'ơ cong Mỹ — lưỡi cong nhẹ, rung',
  'ɝ': 'ơ cong nhấn — như ɚ nhưng nhấn',
  'ɛ': 'e mở — miệng hé, lưỡi trước',
  'ɪ': 'i ngắn — miệng hé, lưỡi cao trước',
  'i': 'i dài — miệng hé hẹp, lưỡi cao',
  'ʊ': 'u ngắn — môi tròn nhẹ, lưỡi lùi',
  'u': 'u dài — môi tròn chặt',
  'eɪ': 'ê-i — trượt từ e sang i',
  'aɪ': 'ai — mở miệng rộng rồi trượt lên i',
  'aʊ': 'ao — mở miệng rồi tròn môi',
  'oʊ': 'ô-u — trượt từ ô sang u',
  'ɹ': 'r Mỹ — cong lưỡi, không chạm',
  'ɾ': 'r vỗ — lưỡi chạm nhanh',
  'l': 'l — đầu lưỡi chạm lợi',
  'w': 'w — tròn môi như huýt sáo',
  'j': 'y — lưỡi nâng gần vòm',
  'h': 'h — thở hắt nhẹ',
  'ˈ': 'trọng âm chính — nhấn mạnh âm tiết sau nó',
  'ˌ': 'trọng âm phụ — nhấn nhẹ hơn',
  'ː': 'kéo dài — giữ âm lâu hơn'
};
function ipaTokens(ipa){ const out=[]; let i=0; while(i<ipa.length){ let two=ipa.slice(i,i+2); if(IPA_DESC[two]){out.push(two); i+=2; continue;} let one=ipa[i]; if(one.trim()) out.push(one); i+=1; } return out; }
function ipaBreakdownHtml(ipa){ const toks=ipaTokens(ipa); const rows=toks.map(t=>`    <tr><td><code>/${esc(t)}/</code></td><td>${esc(IPA_DESC[t]||'âm vị — giữ đúng vị trí miệng, không Việt hóa')}</td></tr>`).join('\n'); return `<table style="width:100%;border-collapse:collapse;margin:8px 0;font-size:.92rem"><thead><tr style="background:var(--soft)"><th style="text-align:left;padding:8px;border:1px solid #e5e7eb">Âm</th><th style="text-align:left;padding:8px;border:1px solid #e5e7eb">Cách đặt miệng/lưỡi</th></tr></thead><tbody>\n${rows}\n</tbody></table>`; }
function decodeHtmlEntities(s){ return String(s||'').replace(/&#39;/g,"'").replace(/&quot;/g,'"').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&'); }
function vnContrast(p){ const ipa=String(p.ipa_us||''); const cm=p.common_mistake||''; if(ipa.includes('θ')) return 'Tiếng Việt không có /θ/. Người Việt hay thay bằng /t/ (“think” → “tink”). Đặt lưỡi giữa hai răng, thổi hơi nhẹ, không chạm lợi.'; if(ipa.includes('ð')) return 'Tiếng Việt không có /ð/. Đừng đọc thành /d/ hay /z/. Lưỡi giữa răng và rung cổ họng.'; if(ipa.includes('æ')) return 'Âm /æ/ bẹt không có trong tiếng Việt. Đừng đọc thành “a” hay “e”. Hạ hàm, miệng mở ngang.'; if(/[ɹɚɝ]/.test(ipa)) return 'Âm /r/ Mỹ cong lưỡi, không chạm vòm. Người Việt hay bỏ hẳn hoặc đọc thành “r” Việt quá mạnh.'; if(ipa.includes('l')) return 'Âm /l/ đầu lưỡi chạm lợi, khác “n”. Đừng nuốt phụ âm cuối.'; if(cm.includes('trọng âm')) return 'Tiếng Việt không có trọng âm từ. Nhấn mạnh đúng âm tiết thì người nghe mới bắt được từ.'; return 'Giữ đúng độ dài nguyên âm và bật rõ phụ âm cuối — hai lỗi phổ biến nhất của người Việt khi nói từ này.'; }
function loadWordExamples(word){ try{ const html=require('fs').readFileSync(require('path').join(REPO,'vi','tu',word,'index.html'),'utf8'); const re=/<div class="mtd-ex"><span class="mtd-ex-en">(.*?)<\/span> — <span class="mtd-ex-vi">(.*?)<\/span><\/div>/g; let m, out=[]; while((m=re.exec(html))&&out.length<3){ let en=decodeHtmlEntities(m[1].replace(/<[^>]+>/g,'')); let vi=decodeHtmlEntities(m[2].replace(/<[^>]+>/g,'')); if(en&&vi) out.push([en,vi]); } return out.length?out:null; }catch(e){ return null; } }
function exampleSentences(p){ const fromWord=loadWordExamples(p.word); if(fromWord) return fromWord; const w=p.word; return [
  [ `Please say "${w}" slowly and pay attention to the main stress.`, `Hãy đọc chậm từ "${w}" và chú ý trọng âm chính.` ],
  [ `Listen carefully to how "${w}" is pronounced in US and UK English.`, `Nghe kỹ cách phát âm từ "${w}" theo giọng Anh-Mỹ và Anh-Anh.` ],
  [ `Practise reading "${w}" aloud three times to lock in the ending sound.`, `Luyện đọc to từ "${w}" ba lần để nhớ chắc âm cuối.` ]
]; }

function pageHtml(p, wordHref) {
  const canonical = `${SITE}/vi/phat-am/${p.word}/`;
  const h1 = `Cách phát âm ${p.word}`;
  const usAud = `/audio/us/${encodeURIComponent(p.word)}.m4a`;
  const gbAud = `/audio/gb/${encodeURIComponent(p.word)}.m4a`;
  const ipaLine = p.ipa_uk
    ? `<span class="ipa-ame" title="Phiên âm Anh-Mỹ">Mỹ /${esc(p.ipa_us)}/</span> · <span class="ipa-bre" title="Phiên âm Anh-Anh">Anh /${esc(p.ipa_uk)}/</span>`
    : `<span class="ipa-ame" title="Phiên âm Anh-Mỹ">Mỹ /${esc(p.ipa_us)}/</span>`;
  const pairs = (p.minimal_pairs||[]).filter((m) => !/luyện thêm/.test(m[2]||''));
  const mpRows = pairs.map(([a, b, note]) =>
    `<li><strong><a href="${wordHref(a)}">${esc(a)}</a> ↔ <a href="${wordHref(b)}">${esc(b)}</a></strong><br><span class="mp-note">${esc(note)}</span></li>`).join('\n');
  const tipRows = p.tips.map((t) => `<li>${esc(t)}</li>`).join('\n');
  const ipaBreakHtml = ipaBreakdownHtml(p.ipa_us);
  const vnNote = vnContrast(p);
  const exSents = exampleSentences(p);
  const exRows = exSents.map(([en,vi])=>`<li><span class="ex-en">${esc(en)}</span> — <span class="ex-vi">${esc(vi)}</span></li>`).join('\n');
  const desc = `Cách phát âm ${p.word}: IPA /${p.ipa_us}/, audio giọng Mỹ và Anh, lỗi người Việt hay sai và 3 cặp từ dễ nhầm. — HọcTA.`.slice(0, 160);
  // FAQ 5
  const sameSound = pairs[0] ? pairs[0][1] : 'thin';
  const ipaTok = ipaTokens(p.ipa_us).find(t=>IPA_DESC[t] && t.length>1) || ipaTokens(p.ipa_us)[0] || '';
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Article',
        headline: `${h1} (IPA + audio Mỹ/Anh)`,
        description: desc,
        url: canonical,
        inLanguage: 'vi',
        about: { '@type': 'DefinedTerm', name: p.word, url: `${SITE}${wordHref(p.word)}` },
      },
      {
        '@type': 'WebPage',
        name: `${h1} (IPA + audio Mỹ/Anh)`,
        url: canonical,
        inLanguage: 'vi',
        speakable: { '@type': 'SpeakableSpecification', cssSelector: ['.tldr', '.ex-en'] },
      },
      {
        '@type': 'FAQPage',
        mainEntity: [
          {
            '@type': 'Question',
            name: `${p.word} phát âm như thế nào?`,
            acceptedAnswer: { '@type': 'Answer', text: `“${p.word}” phát âm là /${p.ipa_us}/${p.ipa_uk ? ` (Mỹ), /${p.ipa_uk}/ (Anh)` : ' (Mỹ)'}. ${p.common_mistake}.` },
          },
          {
            '@type': 'Question',
            name: `Người Việt hay phát âm sai ${p.word} ở đâu?`,
            acceptedAnswer: { '@type': 'Answer', text: p.common_mistake },
          },
          {
            '@type': 'Question',
            name: `Từ nào dễ nhầm với ${p.word}?`,
            acceptedAnswer: { '@type': 'Answer', text: pairs.map(([a, b, n]) => `${a} ↔ ${b}: ${n}`).join(' ') },
          },
          {
            '@type': 'Question',
            name: `Làm sao phân biệt ${p.word} với ${esc(sameSound)}?`,
            acceptedAnswer: { '@type': 'Answer', text: `${pairs[0] ? pairs[0][2] : ''} Nghe audio Mỹ/Anh ở trên, đọc chậm từng âm theo bảng phân rã IPA.` },
          },
          {
            '@type': 'Question',
            name: `Từ nào cùng âm /${ipaTok}/ để luyện chung với ${p.word}?`,
            acceptedAnswer: { '@type': 'Answer', text: `Các từ cùng chứa /${ipaTok}/ thường sai chung một chỗ. Luyện theo nhóm: nghe “${p.word}” rồi đọc xen kẽ với ${pairs.slice(0,2).map(x=>`“${x[0]}”`).join(', ')}, mỗi từ 5 lần, ghi âm lại để so với mẫu.` },
          },
        ],
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Trang chủ', item: `${SITE}/vi/` },
          { '@type': 'ListItem', position: 2, name: 'Phát âm', item: `${SITE}/vi/phat-am/` },
          { '@type': 'ListItem', position: 3, name: p.word, item: canonical },
        ],
      },
    ],
  };
  const robotsTag = p._noindex ? 'noindex, follow' : 'index, follow';
  return `<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="theme-color" content="#293CC8">
<title>${esc(h1)} (IPA + audio Mỹ/Anh) | HọcTA</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${canonical}">
<meta name="robots" content="${robotsTag}">
<meta property="og:type" content="article">
<meta property="og:locale" content="vi_VN">
<meta property="og:site_name" content="HọcTA">
<meta property="og:url" content="${canonical}">
<meta property="og:title" content="${esc(h1)} (IPA + audio Mỹ/Anh)">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:image" content="https://hocta.app/vi/images/og-default.jpg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="HọcTA — từ điển Anh-Việt offline-first">
<meta name="twitter:card" content="summary">
<meta name="twitter:title" content="${esc(h1)} (IPA + audio Mỹ/Anh)">
<link rel="stylesheet" href="/vi/blog/blog.css">
<link rel="stylesheet" href="/vi/tu/word.css">
<style>.ex-en{font-weight:600}.ex-vi{color:var(--muted)}.tldr{background:var(--soft);border-left:4px solid var(--teal);border-radius:0 10px 10px 0;padding:12px 16px;font-size:1.02rem;line-height:1.7}.mp-note{color:var(--muted)}.aud-row{display:flex;gap:8px;flex-wrap:wrap;margin:10px 0;align-items:center}.ipa-play{border:1px solid var(--teal);background:#fff;color:var(--teal);border-radius:8px;padding:6px 12px;font-size:.9rem;font-weight:600;cursor:pointer}.ipa-play:hover{background:var(--teal);color:#fff}.aud-cta{display:inline-flex;align-items:center;gap:5px;border:1px solid var(--line);background:var(--soft);color:var(--ink);border-radius:8px;padding:6px 12px;font-size:.86rem;font-weight:700;text-decoration:none}.aud-cta:hover{border-color:var(--teal);color:var(--teal)}</style>
<script type="application/ld+json">${safeJsonLd(jsonLd)}</script>
</head>
<body class="word-page">
${navHtml('phat-am')}
<nav class="breadcrumb" aria-label="Breadcrumb"><a href="/vi/">Trang chủ</a> › <a href="/vi/tu/">Từ điển</a> › <a href="/vi/phat-am/">Phát âm</a> › <span aria-current="page">${esc(p.word)}</span></nav>
<main class="page">
  <p class="word-kicker">Phát âm Anh–Mỹ, Anh–Anh</p>
  <h1 style="font-size:2.2rem">${esc(h1)} (IPA + audio Mỹ/Anh)</h1>
  <p class="tldr"><strong>“${esc(p.word)}” đọc là /${esc(p.ipa_us)}/ (Mỹ)${p.ipa_uk ? `, /${esc(p.ipa_uk)}/ (Anh)` : ''}.</strong> ${esc(p.common_mistake)}.</p>
  <h2>Nghe phát âm &amp; luyện đọc ngay</h2>
  <p class="word-ipa"><span class="ipa-label">Phiên âm</span> ${ipaLine}</p>
  <div class="aud-row">
    <button type="button" class="ipa-play" data-aud="${usAud}" aria-label="Nghe giọng Mỹ">🔊 Mỹ</button>
    <button type="button" class="ipa-play" data-aud="${gbAud}" aria-label="Nghe giọng Anh">🔊 Anh</button>
    <a class="aud-cta" href="/?q=${encodeURIComponent(p.word)}">⭐ Lưu vào FSRS offline ↗</a>
    <a class="aud-cta" href="/vi/luyen-shadowing/">🎤 Luyện Shadowing →</a>
  </div>
  <audio id="ipa-player" preload="none"></audio>
  <script>(function(){var pl=document.getElementById('ipa-player');if(!pl)return;document.querySelectorAll('.ipa-play').forEach(function(b){b.addEventListener('click',function(){pl.src=b.getAttribute('data-aud');pl.play();});});})();</script>
  <h2>Lỗi người Việt hay sai</h2>
  <p>${esc(p.common_mistake)}.</p>
  <h2>Phân tích từng âm</h2>
  ${ipaBreakHtml}
  <h2>Lưu ý cho người Việt</h2>
  <p>${esc(vnNote)}</p>
  <h2>Ví dụ câu</h2>
  <ul>\n${exRows}\n  </ul>
  <h2>Cặp từ dễ nhầm (minimal pairs)</h2>
  ${pairs.length ? `<ul>
${mpRows}
  </ul>` : `<p style="color:var(--muted)">Từ này phát âm đặc biệt, chưa có cặp từ dễ nhầm trong bộ dữ liệu — luyện kỹ bảng phân rã IPA và ví dụ câu ở trên.</p>`}
  <h2>Mẹo luyện tập</h2>
  <ul>
${tipRows}
  </ul>
  <div class="cmp-links">
    <a class="related-chip" href="${wordHref(p.word)}">Tra “${esc(p.word)}” →</a>
    <a class="related-chip" href="/vi/phat-am/">Tất cả phát âm →</a>
  </div>
  ${blogLinksHtml(`/vi/phat-am/${p.word}/`)}
<p class="upd" style="color:var(--muted);font-size:.82rem;margin-top:24px;border-top:1px solid var(--line);padding-top:10px">Cập nhật nội dung: 26/11/2026 · <a href="/vi/cap-nhat/">Lịch sử cập nhật</a></p>
</main>
<footer class="blog-footer"><p><a href="/vi/">HọcTA</a> — từ điển &amp; công cụ học từ vựng offline-first cho người Việt. Biên soạn bởi <a href="/vi/tac-gia/">Nguyễn Quốc Anh</a> · <a href="/vi/chinh-sach-noi-dung/">Chính sách nội dung</a></p></footer>
</body>
</html>
`;
}

const BASIC_STOP_WORDS = new Set([
  'a','an','the','and','or','but','in','on','at','to','for','of','by','up','as',
  'is','am','are','was','were','be','do','go','he','she','it','we','you','me',
  'my','us','no','so','if','its','his','her','our','all','any','can','may','not',
  'now','out','too','yes','yet','one','two','six','ten','big','old','new','bad',
  'hot','day','man','way','who','why','how'
]);

function isIndexablePron(p, examTags) {
  const w = String(p.word || '').toLowerCase();
  if (w.length < 5 || BASIC_STOP_WORDS.has(w)) return false;
  const ipa = p.ipa_us || '';
  const hasHardSound = /[θðæʃʒtʃdʒɝɚ]/.test(ipa);
  const hasStress = ipa.includes('ˈ') && w.length >= 6;
  const hasRealPairs = (p.minimal_pairs || []).some((m) => !/luyện thêm/.test(m[2] || ''));
  const tag = examTags[w];
  const isExam = Boolean(tag && (tag.cefr === 'B1' || tag.cefr === 'B2' || tag.cefr === 'C1' || (tag.tags || []).includes('ielts')));
  return hasRealPairs && (hasHardSound || hasStress) && (isExam || w.length >= 7);
}

function main() {
  const data = JSON.parse(fs.readFileSync(path.join(REPO, 'data', 'pronunciation.json'), 'utf8'));
  const pairs = data.pairs || [];
  let examTags = {};
  try {
    examTags = JSON.parse(fs.readFileSync(path.join(REPO, 'data', 'exam-tags.json'), 'utf8')).words || {};
  } catch (e) {}
  let wordSlugs = new Set();
  try {
    const wm = JSON.parse(fs.readFileSync(path.join(REPO, 'docs', 'wordpages-manifest.json'), 'utf8'));
    for (const s of wm.slugs || []) wordSlugs.add(s);
  } catch (e) {}
  const wordHref = (w) => {
    const slug = String(w).toLowerCase();
    if (wordSlugs.has(slug)) return `/vi/tu/${encodeURIComponent(slug)}/`;
    return `/?q=${encodeURIComponent(w)}`;
  };
  // guard data: skip entries whose audio is missing
  let skipped = 0;
  const kept = [];
  for (const p of pairs) {
    const usF = path.join(REPO, 'audio', 'us', `${p.word}.m4a`);
    const gbF = path.join(REPO, 'audio', 'gb', `${p.word}.m4a`);
    if (!fs.existsSync(usF) || !fs.existsSync(gbF)) { skipped++; continue; }
    p._noindex = !isIndexablePron(p, examTags);
    kept.push(p);
  }
  const indexable = kept.filter((p) => !p._noindex);
  fs.mkdirSync(OUT_DIR, { recursive: true });
  let deadLinks = 0;
  for (const p of kept) {
    for (const [a, b] of p.minimal_pairs) {
      for (const s of [a, b]) if (!wordSlugs.has(String(s).toLowerCase())) deadLinks++;
    }
    const dir = path.join(OUT_DIR, p.word);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'index.html'), pageHtml(p, wordHref));
  }
  const rows = indexable.map((p) =>
    `    <li><a href="/vi/phat-am/${p.word}/">Cách phát âm ${esc(p.word)} — /${esc(p.ipa_us)}/ (audio Mỹ/Anh)</a></li>`).join('\n');
  const hubTitle = `${indexable.length} từ tiếng Anh khó phát âm + audio Mỹ/Anh cho người Việt`;
  const hubJsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'CollectionPage', name: hubTitle, url: `${SITE}/vi/phat-am/`, inLanguage: 'vi' },
      {
        '@type': 'ItemList',
        name: hubTitle,
        itemListElement: indexable.map((p, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          name: `Cách phát âm ${p.word}`,
          url: `${SITE}/vi/phat-am/${p.word}/`,
        })),
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Trang chủ', item: `${SITE}/vi/` },
          { '@type': 'ListItem', position: 2, name: 'Phát âm' },
        ],
      },
    ],
  };
  fs.writeFileSync(path.join(OUT_DIR, 'index.html'), `<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="theme-color" content="#293CC8">
<title>${hubTitle} | HọcTA</title>
<meta name="description" content="${indexable.length} từ tiếng Anh B1–C1 & IELTS hay phát âm sai kèm audio giọng Mỹ và Anh, IPA, lỗi người Việt và cặp từ dễ nhầm.">
<link rel="canonical" href="${SITE}/vi/phat-am/">
<meta name="robots" content="index, follow">
<meta property="og:type" content="website">
<meta property="og:locale" content="vi_VN">
<meta property="og:site_name" content="HọcTA">
<meta property="og:url" content="${SITE}/vi/phat-am/">
<meta property="og:title" content="${hubTitle} | HọcTA">
<meta name="twitter:card" content="summary">
<link rel="stylesheet" href="/vi/blog/blog.css">
<link rel="stylesheet" href="/vi/tu/word.css">
<script type="application/ld+json">${safeJsonLd(hubJsonLd)}</script>
</head>
<body class="word-page">
${navHtml('phat-am')}
<nav class="breadcrumb" aria-label="Breadcrumb"><a href="/vi/">Trang chủ</a> › <a href="/vi/tu/">Từ điển</a> › <span aria-current="page">Phát âm</span></nav>
<main class="page">
  <p class="word-kicker">Phát âm Anh–Mỹ, Anh–Anh</p>
  <h1 style="font-size:2.2rem">${hubTitle}</h1>
  <p style="color:var(--muted)">Chọn lọc ${indexable.length} từ có âm khó với người Việt (/θ/, /ð/, /æ/, trọng âm đa âm tiết): player giọng Mỹ + Anh, phân rã IPA, lỗi hay sai và luyện trực tiếp trong <a href="/vi/luyen-shadowing/">công cụ Shadowing</a>.</p>
  ${hubListHtml(rows.split('\n'), {cols:2})}
</main>
<footer class="blog-footer"><p><a href="/vi/">HọcTA</a> — từ điển &amp; công cụ học từ vựng offline-first cho người Việt. Biên soạn bởi <a href="/vi/tac-gia/">Nguyễn Quốc Anh</a> · <a href="/vi/chinh-sach-noi-dung/">Chính sách nội dung</a></p></footer>
</body>
</html>
`);
  const LM = new Date().toISOString().slice(0, 10);
  const urls = [`https://hocta.app/vi/phat-am/`, ...indexable.map((p) => `https://hocta.app/vi/phat-am/${p.word}/`)];
  fs.writeFileSync(path.join(REPO, 'vi', 'tu', 'sitemap', 'pronunciation.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `  <url><loc>${u}</loc><lastmod>${LM}</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>`).join('\n')}\n</urlset>\n`);
  console.log(`PRONUNCIATION: ${kept.length} built (${indexable.length} indexable, ${kept.length - indexable.length} noindex) + hub + sitemap (skipped no-audio: ${skipped}, manifest-guard dead: ${deadLinks})`);
}

if (require.main === module) {
  main();
}
