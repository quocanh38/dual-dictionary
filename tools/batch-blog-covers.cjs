#!/usr/bin/env node
/* Batch blog covers: template 1200x630 + WebP 320w
 * For each blog post under vi/blog/{ielts,phuong-phap,toeic}/*, generate:
 * - vi/blog/images/{slug}/og-1200x630-v2.jpg (1200x630)
 * - vi/blog/images/{slug}/og-320w.webp (320x168, for mobile srcset)
 * Then update index.html: og:image -> v2.jpg, add og:width/height if missing,
 * update <figure><img> to use v2 + srcset, ensure twitter:image sync.
 * Images contain 100% English text inside (per handoff OCR rule).
 * Usage: node tools/batch-blog-covers.cjs [--dry]
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const REPO = path.join(__dirname, '..');
const SITE = 'https://dualdictionary.netlify.app';

const COVERS = {
  'ielts/cach-hoc-tu-vung-ielts-khong-quen': { enTitle: 'Learn IELTS Vocabulary\nand Remember Longer', badge: 'IELTS Vocabulary', accent: '#0f766e' },
  'ielts/collocations-ielts': { enTitle: 'Collocations for IELTS\nheavy traffic ≠ big traffic', badge: 'IELTS Collocations', accent: '#0f766e' },
  'ielts/hoc-tieng-anh-qua-youtube': { enTitle: 'Learn English via YouTube\nTurn Videos into Lessons', badge: 'IELTS Listening', accent: '#0891b2' },
  'ielts/ielts-band-descriptors': { enTitle: 'IELTS Band Descriptors\nWhat Separates Band 6 from 7', badge: 'IELTS Guide', accent: '#1e40af' },
  'ielts/ielts-speaking-part-2-cue-card': { enTitle: 'IELTS Speaking Part 2\nCue Card Strategy in 1 Minute', badge: 'IELTS Speaking', accent: '#7c3aed' },
  'ielts/ielts-writing-task-2-luyen-viet': { enTitle: 'IELTS Writing Task 2\nWrite Under Time Pressure', badge: 'IELTS Writing', accent: '#1e40af' },
  'ielts/luyen-doc-ielts-doc-nhanh': { enTitle: 'IELTS Reading\nRead Fast Without Every Word', badge: 'IELTS Reading', accent: '#0e7490' },
  'ielts/luyen-nghe-ielts': { enTitle: 'IELTS Listening\nWhat to Listen & How to Practice', badge: 'IELTS Listening', accent: '#0891b2' },
  'ielts/luyen-phat-am-ipa': { enTitle: 'IPA Pronunciation from Zero\nFoundation for Listening & Speaking', badge: 'IELTS Pronunciation', accent: '#0f766e' },
  'ielts/on-ielts-30-phut-moi-ngay': { enTitle: '30 Minutes a Day\nIELTS Plan for Busy People', badge: 'IELTS Study Plan', accent: '#0f766e' },
  'ielts/tu-dien-anh-anh-hay-anh-viet': { enTitle: 'Monolingual or Bilingual?\nWhich Dictionary to Use', badge: 'IELTS Tips', accent: '#475569' },
  'ielts/tu-vung-ielts-theo-chu-de': { enTitle: 'IELTS Vocabulary by Topic\n16 High-Frequency Themes', badge: 'IELTS Vocabulary', accent: '#0f766e' },
  'phuong-phap/fsrs-la-gi': { enTitle: 'What Is FSRS?\nSmarter Spaced Repetition', badge: 'Study Method', accent: '#059669' },
  'phuong-phap/hieu-tieng-anh-khong-can-dich': { enTitle: 'Understand English\nWithout Translating', badge: 'Study Method', accent: '#0f766e' },
  'phuong-phap/hoc-tu-vung-trong-ngu-canh': { enTitle: 'Vocabulary in Context\nWords Live in Sentences', badge: 'Study Method', accent: '#059669' },
  'phuong-phap/listening-khong-kip-dich': { enTitle: 'IELTS Listening\nYou Have No Time to Translate', badge: 'Listening Skills', accent: '#0891b2' },
  'phuong-phap/lo-trinh-30-ngay-packs': { enTitle: '30-Day Offline Packs\nFrom Handover to IELTS 6.0', badge: 'Study Roadmap', accent: '#0f766e' },
  'phuong-phap/lo-trinh-4-tuan-bo-dich': { enTitle: '4-Week No-Translate Plan\nThink Directly in English', badge: 'Study Roadmap', accent: '#0f766e' },
  'phuong-phap/offline-lesson-packs': { enTitle: 'Offline Lesson Packs\nStudy Without Internet', badge: 'App Feature', accent: '#475569' },
  'phuong-phap/reading-hieu-mot-lan': { enTitle: 'Reading Once & Getting It\nNo Re-Translation', badge: 'Reading Skills', accent: '#0e7490' },
  'phuong-phap/sau-loi-tieng-viet-gay-sai': { enTitle: '6 Vietnamese Habits\nThat Break Your English', badge: 'Common Mistakes', accent: '#dc2626' },
  'phuong-phap/spaced-repetition-la-gi': { enTitle: 'Spaced Repetition\nRetain Vocabulary Longer', badge: 'Study Method', accent: '#059669' },
  'phuong-phap/speaking-phan-xa-cum': { enTitle: 'Speaking in Chunks\nBuild Reflex, Not Translation', badge: 'Speaking Skills', accent: '#7c3aed' },
  'phuong-phap/tu-dien-anh-viet-offline': { enTitle: 'Offline English-Vietnamese\nDictionary on Your Phone', badge: 'App Feature', accent: '#475569' },
  'phuong-phap/writing-khung-cau': { enTitle: 'Writing Frameworks\nFrom Blank Page to Paragraph', badge: 'Writing Skills', accent: '#1e40af' },
  'toeic/hoc-toeic-flashcard-anki': { enTitle: 'TOEIC with Anki\nFlashcards That Stick', badge: 'TOEIC Study', accent: '#d97706' },
  'toeic/luyen-toeic-tren-dien-thoai-offline': { enTitle: 'Practice TOEIC Offline\nOn Your Phone', badge: 'TOEIC App', accent: '#475569' },
  'toeic/nghe-tieng-anh-khong-ra': { enTitle: 'Cannot Hear English?\nTrain Your Ear', badge: 'Listening Skills', accent: '#0891b2' },
  'toeic/tieng-anh-thuong-mai-email-bao-cao': { enTitle: 'Business English\nEmails & Reports', badge: 'Business English', accent: '#1e40af' },
  'toeic/toeic-ca-dem-mang-yeu': { enTitle: 'Night Shift & Weak Signal\nStill Make Progress', badge: 'TOEIC Tips', accent: '#d97706' },
  'toeic/toeic-listening-part-3-4': { enTitle: 'TOEIC Listening Part 3-4\nConversation & Talk Tactics', badge: 'TOEIC Listening', accent: '#d97706' },
  'toeic/toeic-part-7-doc-nhanh': { enTitle: 'TOEIC Part 7\nSpeed Reading Tactics', badge: 'TOEIC Reading', accent: '#d97706' },
  'toeic/tu-vung-toeic-part-5-6': { enTitle: 'TOEIC Vocabulary Part 5-6\nGrammar Meets Meaning', badge: 'TOEIC Vocabulary', accent: '#d97706' },
  'toeic/tu-vung-toeic-thuong-gap': { enTitle: 'Frequent TOEIC Vocabulary\nWords You Will Meet', badge: 'TOEIC Vocabulary', accent: '#d97706' },
};

function escXml(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

function coverSvg(enTitle, badge, accent) {
  const lines = enTitle.split('\n');
  const t1 = escXml(lines[0]||'');
  const t2 = escXml(lines[1]||'');
  return `<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg" role="img">
<title>${escXml(badge)} - ${escXml(enTitle.replace(/\n/g,' '))}</title>
<rect width="1200" height="630" rx="0" fill="#ffffff"/>
<!-- top bar -->
<rect width="1200" height="8" fill="${accent}"/>
<!-- left accent block -->
<rect x="0" y="8" width="480" height="622" fill="${accent}"/>
<!-- subtle pattern dots -->
<g fill="white" opacity="0.08">
  <circle cx="60" cy="80" r="2"/><circle cx="120" cy="80" r="2"/><circle cx="180" cy="80" r="2"/><circle cx="240" cy="80" r="2"/><circle cx="300" cy="80" r="2"/><circle cx="360" cy="80" r="2"/>
  <circle cx="60" cy="120" r="2"/><circle cx="120" cy="120" r="2"/><circle cx="180" cy="120" r="2"/><circle cx="240" cy="120" r="2"/><circle cx="300" cy="120" r="2"/><circle cx="360" cy="120" r="2"/>
</g>
<!-- badge -->
<rect x="48" y="48" width="220" height="32" rx="16" fill="white" opacity="0.96"/>
<text x="158" y="68" text-anchor="middle" font-family="Inter,system-ui,sans-serif" font-size="13" font-weight="700" fill="${accent}" letter-spacing="0.06em">${escXml(badge.toUpperCase())}</text>
<!-- main title lines (English only) -->
<text x="48" y="152" font-family="Inter,system-ui,sans-serif" font-size="44" font-weight="800" fill="white" letter-spacing="-0.02em">${t1}</text>
<text x="48" y="202" font-family="Inter,system-ui,sans-serif" font-size="28" font-weight="600" fill="white" opacity="0.92">${t2}</text>
<!-- divider -->
<rect x="48" y="238" width="96" height="4" rx="2" fill="white" opacity="0.7"/>
<!-- bullet points decor -->
<text x="48" y="280" font-family="Inter,system-ui,sans-serif" font-size="14" font-weight="600" fill="white" opacity="0.85">Vocabulary  •  Context  •  Practice</text>
<!-- right side: illustration area -->
<rect x="520" y="48" width="632" height="400" rx="16" fill="#f8fafc" stroke="#e2e8f0" stroke-width="1.5"/>
<!-- abstract book/card illustration -->
<rect x="580" y="98" width="200" height="280" rx="12" fill="white" stroke="#e2e8f0"/>
<rect x="596" y="118" width="168" height="10" rx="5" fill="#e2e8f0"/>
<rect x="596" y="140" width="140" height="8" rx="4" fill="#f1f5f9"/>
<rect x="596" y="160" width="168" height="8" rx="4" fill="#f1f5f9"/>
<rect x="596" y="176" width="120" height="8" rx="4" fill="#f1f5f9"/>
<rect x="596" y="210" width="168" height="36" rx="8" fill="${accent}" opacity="0.08"/>
<text x="680" y="233" text-anchor="middle" font-family="Inter,sans-serif" font-size="11" font-weight="700" fill="${accent}">Example Sentence</text>
<rect x="820" y="98" width="200" height="132" rx="12" fill="${accent}" opacity="0.06" stroke="${accent}" stroke-width="1" stroke-dasharray="6 6"/>
<text x="920" y="148" text-anchor="middle" font-family="Inter,sans-serif" font-size="42">\uD83D\uDCA1</text>
<text x="920" y="172" text-anchor="middle" font-family="Inter,sans-serif" font-size="11" font-weight="600" fill="${accent}">Learn • Save • Review</text>
<rect x="820" y="246" width="200" height="132" rx="12" fill="white" stroke="#e2e8f0"/>
<text x="920" y="282" text-anchor="middle" font-family="Inter,sans-serif" font-size="11" font-weight="700" fill="#475569">AUDIO + IPA</text>
<text x="920" y="302" text-anchor="middle" font-family="Inter,sans-serif" font-size="28">\uD83D\uDD0A</text>
<text x="920" y="322" text-anchor="middle" font-family="Inter,sans-serif" font-size="9" fill="#64748b">US &amp; UK pronunciation</text>
<!-- bottom brand -->
<text x="520" y="512" font-family="Inter,sans-serif" font-size="13" font-weight="700" fill="#0f766e" letter-spacing="0.08em">DUAL DICTIONARY</text>
<text x="520" y="532" font-family="Inter,sans-serif" font-size="12" fill="#64748b">Offline-first English-Vietnamese Dictionary</text>
<text x="1090" y="532" text-anchor="end" font-family="Inter,sans-serif" font-size="11" fill="#94a3b8">dualdictionary.netlify.app</text>
<!-- small footer line -->
<rect x="48" y="590" width="1104" height="1" fill="#e2e8f0"/>
</svg>`;
}

async function main() {
  const dry = process.argv.includes('--dry');
  const slugs = Object.keys(COVERS);
  let made = 0, updated = 0, skipped = 0;
  for (const slug of slugs) {
    const cfg = COVERS[slug];
    const imgDir = path.join(REPO, 'vi', 'blog', 'images', slug);
    const svg = coverSvg(cfg.enTitle, cfg.badge, cfg.accent);
    const v2Jpg = path.join(imgDir, 'og-1200x630-v2.jpg');
    const w320 = path.join(imgDir, 'og-320w.webp');
    if (!dry) {
      fs.mkdirSync(imgDir, { recursive: true });
      // Render 1200x630 JPG
      const buf1200 = await sharp(Buffer.from(svg)).jpeg({ quality: 82, mozjpeg: true }).resize(1200, 630).toBuffer();
      fs.writeFileSync(v2Jpg, buf1200);
      // Render 320w WebP
      const buf320 = await sharp(Buffer.from(svg)).webp({ quality: 78 }).resize(320, 168).toBuffer();
      fs.writeFileSync(w320, buf320);
      made++;
    }
    // Update HTML if exists
    const htmlPath = path.join(REPO, 'vi', 'blog', slug, 'index.html');
    if (!fs.existsSync(htmlPath)) { skipped++; continue; }
    let html = fs.readFileSync(htmlPath, 'utf8');
    const imgUrl = `${SITE}/vi/blog/images/${slug}/og-1200x630-v2.jpg`;
    const oldOgPng = `${SITE}/vi/blog/images/${slug}/og-1200x630.png`;
    const oldSvg1 = `${SITE}/vi/blog/images/learn-loop.svg`;
    const oldSvg2 = `${SITE}/vi/blog/images/offline-pipeline.svg`;
    const oldSvg3 = `${SITE}/vi/blog/images/dead-minutes.svg`;
    let changed = false;
    // Replace og:image
    for (const old of [oldOgPng, oldSvg1, oldSvg2, oldSvg3]) {
      if (html.includes(old)) { html = html.replaceAll(old, imgUrl); changed = true; }
    }
    if (!html.includes(imgUrl) && html.includes('og:image')) {
      // generic fallback: replace any og:image under this slug path
      html = html.replace(/content="https:\/\/dualdictionary\.netlify\.app\/vi\/blog\/images\/[^"]*"/, `content=\"${imgUrl}\"`);
      changed = true;
    }
    // Ensure og:image:width/height present
    if (!html.includes('og:image:width')) {
      html = html.replace(`<meta property=\"og:image\" content=\"${imgUrl}\">`, `<meta property=\"og:image\" content=\"${imgUrl}\">\n<meta property=\"og:image:width\" content=\"1200\">\n<meta property=\"og:image:height\" content=\"630\">`);
      changed = true;
    }
    // Sync JSON-LD image
    if (html.includes('"image":')) {
      const re = /\"image\":\s*\"https:\/\/dualdictionary\.netlify\.app\/vi\/blog\/images\/[^"]+\"/;
      if (re.test(html)) { html = html.replace(re, `\"image\": \"${imgUrl}\"`); changed = true; }
    }
    // Update figure <img> in body to v2 with srcset
    const figRe = /<figure[^>]*><img[^>]*src="[^"]*og-1200x630[^"]*"[^>]*>.*?<\/figure>/s;
    const newFig = `<figure style=\"margin:16px 0\"><img src=\"/vi/blog/images/${slug}/og-1200x630-v2.jpg\" srcset=\"/vi/blog/images/${slug}/og-320w.webp 320w, /vi/blog/images/${slug}/og-1200x630-v2.jpg 1200w\" sizes=\"(max-width: 640px) 320px, 640px\" alt=\"${escXml(cfg.enTitle.replace(/\n/g,' — '))} — illustration for Dual Dictionary\" width=\"1200\" height=\"630\" loading=\"lazy\" decoding=\"async\" style=\"width:100%;height:auto;border-radius:10px;border:1px solid #e5e7eb\"><figcaption style=\"font-size:12px;color:#6b7280;margin-top:6px\">Minh họa cho bài viết — English text inside image for accessibility</figcaption></figure>`;
    if (figRe.test(html)) {
      html = html.replace(figRe, newFig);
      changed = true;
    } else if (!html.includes(`og-1200x630-v2.jpg\"`)) {
      // inject after <h1>
      html = html.replace(/(<h1[^>]*>.*?<\/h1>)/s, `$1\n${newFig}`);
      changed = true;
    }
    if (changed && !dry) {
      fs.writeFileSync(htmlPath, html);
      updated++;
    }
  }
  console.log(`BATCH-BLOG-COVERS: ${made} images rendered (1200x630 JPG + 320w WebP each), ${updated} HTML updated, ${skipped} missing HTML`);
}

main().catch(e => { console.error(e); process.exit(1); });
