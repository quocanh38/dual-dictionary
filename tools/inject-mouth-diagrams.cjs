#!/usr/bin/env node
/* Inject mouth diagrams: 300 phat-am pages
 * Style chốt ở /think/: hình cắt ngang miệng, chữ tiếng Anh trong hình, không mũi tên
 * Groups: th, sh, ch, ng, ae, ei, ai, au, ou, aw, uh, schwa, rcolor, other
 * Generates SVG mouth cross-section per group -> JPG 480x480 + WebP 480w
 * Then for each word, copies group assets to vi/phat-am/{word}/ and injects <figure> block.
 * Also updates build-pronunciation-pages.cjs to persist on rebuild.
 * Usage: node tools/inject-mouth-diagrams.cjs [--dry] [--words=a,able]
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const REPO = path.join(__dirname, '..');
const DATA_PATH = path.join(REPO, 'data', 'pronunciation.json');
const OUT_BASE = path.join(REPO, 'vi', 'phat-am');

const GROUPS = {
  th: { label: 'Tongue Between Teeth', sub: 'Upper Teeth / Tongue Tip Lightly Between Teeth / Gentle Airflow / Lower Teeth', title: '/θ/ as in think, mouth', tongue: 'th' },
  sh: { label: 'Tongue Near Palate', sub: 'Palate / Tongue Raised / Air Through Narrow Gap / Teeth Together', title: '/ʃ/ as in she, shop', tongue: 'sh' },
  ch: { label: 'Tongue Raised to Palate', sub: 'Palate / Tongue Tip Touches Ridge / Release Air / Teeth Lightly Apart', title: '/tʃ/ as in chair, check', tongue: 'ch' },
  ng: { label: 'Back of Tongue Raised', sub: 'Soft Palate Closed / Back Tongue Raised / Air Through Nose / Lower Teeth', title: '/ŋ/ as in sing, long', tongue: 'ng' },
  ae: { label: 'Jaw Low, Mouth Wide', sub: 'Upper Teeth / Tongue Low & Forward / Mouth Open Wide / Lower Teeth', title: '/æ/ as in cat, hat', tongue: 'ae' },
  ei: { label: 'Tongue Glides Up', sub: 'Palate / Tongue From Mid to High / Smooth Glide / Jaw Slightly Closed', title: '/eɪ/ as in say, make', tongue: 'ei' },
  ai: { label: 'Wide Open to High', sub: 'Open Jaw / Tongue Low to High / Strong Glide / Teeth Apart', title: '/aɪ/ as in my, time', tongue: 'ai' },
  au: { label: 'Open to Rounded', sub: 'Open Mouth / Tongue Back / Lips Round / Jaw Closes', title: '/aʊ/ as in now, how', tongue: 'au' },
  ou: { label: 'Mid to High Rounded', sub: 'Mid Tongue / Glide to High / Lips Rounded / Air Steady', title: '/oʊ/ as in go, no', tongue: 'ou' },
  aw: { label: 'Back Tongue Raised', sub: 'Back Raised / Lips Slightly Rounded / Open Mouth / Steady Air', title: '/ɔ/ as in law, all', tongue: 'aw' },
  uh: { label: 'Tongue Relaxed Mid', sub: 'Palate / Tongue Mid / Mouth Slightly Open / Relaxed', title: '/ʌ/ as in cup, up', tongue: 'uh' },
  schwa: { label: 'Neutral & Relaxed', sub: 'Neutral Lips / Tongue Centered / Relaxed Jaw / Light Air', title: '/ə/ schwa, relaxed', tongue: 'schwa' },
  rcolor: { label: 'Tongue Tensed, R-Colored', sub: 'Palate / Tongue Curled Back / Lips Neutral / Voiced', title: '/ɝ/ as in her, work', tongue: 'rcolor' },
  other: { label: 'Clear Final Consonant', sub: 'Upper Teeth / Tongue Position / Release Consonant / Lower Teeth', title: 'Clear pronunciation — final consonant', tongue: 'other' },
};

function esc(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

function mouthSvg(groupKey, wordExample) {
  const g = GROUPS[groupKey] || GROUPS.other;
  // Cross-section mouth: side view silhouette
  // Coordinates: profile mouth from left (nose) to right (lips)
  // Different tongue positions per group
  const tonguePaths = {
    th: 'M 155 172 Q 195 165 235 148 L 278 142 Q 292 144 292 155 L 175 182 Z',
    sh: 'M 145 180 Q 175 140 220 135 Q 250 132 275 148 L 275 165 Q 200 178 145 180 Z',
    ch: 'M 145 178 Q 170 120 240 118 L 278 125 L 275 150 Q 200 170 145 178 Z',
    ng: 'M 130 170 Q 160 165 200 142 Q 235 118 268 122 L 275 155 Q 210 182 130 170 Z',
    ae: 'M 135 190 Q 165 185 205 172 Q 240 160 275 168 L 275 190 Q 185 210 135 190 Z',
    ei: 'M 140 175 Q 170 155 215 142 Q 245 132 272 140 L 272 160 Q 200 182 140 175 Z',
    ai: 'M 130 195 Q 160 145 215 125 Q 255 118 275 135 L 275 168 Q 185 205 130 195 Z',
    au: 'M 130 192 Q 165 150 210 135 Q 245 130 275 148 L 275 175 Q 190 205 130 192 Z',
    ou: 'M 135 172 Q 170 150 210 138 Q 250 135 275 150 L 275 168 Q 190 188 135 172 Z',
    aw: 'M 125 165 Q 165 145 205 130 Q 245 125 275 142 L 275 165 Q 180 188 125 165 Z',
    uh: 'M 140 180 Q 170 165 205 158 Q 245 150 272 155 L 272 172 Q 185 192 140 180 Z',
    schwa: 'M 142 178 Q 172 168 210 160 Q 245 155 272 158 L 272 172 Q 185 188 142 178 Z',
    rcolor: 'M 138 168 Q 168 142 210 130 Q 248 120 272 145 L 272 162 Q 185 185 138 168 Z',
    other: 'M 142 176 Q 172 165 212 152 Q 248 142 275 150 L 275 168 Q 185 190 142 176 Z',
  };
  const tonguePath = tonguePaths[groupKey] || tonguePaths.other;
  const isVowel = ['ae','ei','ai','au','ou','aw','uh','schwa','rcolor'].includes(groupKey);
  const mouthOpen = isVowel ? 38 : 18;
  return `<svg width="480" height="480" viewBox="0 0 480 480" xmlns="http://www.w3.org/2000/svg" role="img">
<title>${esc(g.title)}</title>
<rect width="480" height="480" rx="16" fill="#ffffff" stroke="#e5e7eb" stroke-width="1.2"/>
<!-- header -->
<text x="240" y="38" text-anchor="middle" font-family="Inter,system-ui,sans-serif" font-size="11" font-weight="700" fill="#0f766e" letter-spacing="0.08em">${esc(g.label.toUpperCase())}</text>
<text x="240" y="58" text-anchor="middle" font-family="Inter,system-ui,sans-serif" font-size="11" fill="#6b7280">${esc(g.title)}</text>
<!-- mouth outline side view -->
<rect x="48" y="84" width="384" height="284" rx="14" fill="#f9fafb" stroke="#e5e7eb"/>
<!-- head profile hint -->
<path d="M 72 112 Q 72 88 108 84 Q 140 84 162 108 L 162 280 Q 120 320 72 280 Q 72 180 72 112 Z" fill="#ffffff" stroke="#e5e7eb" stroke-width="1.2"/>
<!-- nasal cavity -->
<path d="M 108 112 Q 132 112 148 128 Q 155 142 148 158" fill="none" stroke="#e5e7eb" stroke-width="1" stroke-dasharray="4 4"/>
<text x="118" y="102" font-family="Inter,sans-serif" font-size="7" fill="#9ca3af">Nasal cavity</text>
<!-- palate -->
<path d="M 108 128 Q 155 125 195 132 Q 248 142 268 165" fill="none" stroke="#d1d5db" stroke-width="1.4"/>
<text x="198" y="122" text-anchor="middle" font-family="Inter,sans-serif" font-size="7" font-weight="600" fill="#6b7280">Palate</text>
<!-- upper teeth -->
<rect x="248" y="158" width="42" height="16" rx="3" fill="#ffffff" stroke="#9ca3af" stroke-width="1.2"/>
<rect x="252" y="162" width="34" height="8" rx="1.5" fill="#f3f4f6"/>
<text x="269" y="152" text-anchor="middle" font-family="Inter,sans-serif" font-size="7" font-weight="700" fill="#374151">Upper Teeth</text>
<!-- lower teeth -->
<rect x="248" y="${218 + mouthOpen}" width="42" height="16" rx="3" fill="#ffffff" stroke="#9ca3af" stroke-width="1.2"/>
<rect x="252" y="${222 + mouthOpen}" width="34" height="8" rx="1.5" fill="#f3f4f6"/>
<text x="269" y="${252 + mouthOpen}" text-anchor="middle" font-family="Inter,sans-serif" font-size="7" font-weight="700" fill="#374151">Lower Teeth</text>
<!-- tongue -->
<path d="${tonguePath}" fill="#0f766e" opacity="0.92" stroke="#115e59" stroke-width="1"/>
<text x="188" y="202" text-anchor="middle" font-family="Inter,sans-serif" font-size="8" font-weight="700" fill="white">${esc(g.label)}</text>
<!-- lips -->
<ellipse cx="312" cy="${192 + mouthOpen/2}" rx="42" ry="${18 + mouthOpen/2}" fill="none" stroke="#d1d5db" stroke-width="1.4"/>
<path d="M 272 ${192 + mouthOpen/3} Q 312 ${182 + mouthOpen/3} 352 ${192 + mouthOpen/3}" fill="none" stroke="#9ca3af" stroke-width="1.6" stroke-linecap="round"/>
<path d="M 272 ${208 + mouthOpen*0.6} Q 312 ${218 + mouthOpen*0.6} 352 ${208 + mouthOpen*0.6}" fill="none" stroke="#9ca3af" stroke-width="1.6" stroke-linecap="round"/>
<!-- airflow hint without arrow: wavy lines -->
<g opacity="0.45" stroke="#0f766e" stroke-width="1.2" fill="none" stroke-linecap="round">
  <path d="M 330 ${188 + mouthOpen/2} Q 350 ${186 + mouthOpen/2} 370 ${188 + mouthOpen/2}"/>
  <path d="M 332 ${196 + mouthOpen/2} Q 352 ${194 + mouthOpen/2} 372 ${196 + mouthOpen/2}"/>
  <path d="M 330 ${204 + mouthOpen/2} Q 350 ${202 + mouthOpen/2} 370 ${204 + mouthOpen/2}"/>
</g>
<text x="350" y="${214 + mouthOpen/2 + 18}" text-anchor="middle" font-family="Inter,sans-serif" font-size="7" fill="#0f766e" letter-spacing="0.06em">Gentle Airflow</text>
<!-- bottom labels -->
<rect x="48" y="384" width="384" height="1" fill="#e5e7eb"/>
<text x="240" y="408" text-anchor="middle" font-family="Inter,sans-serif" font-size="9" fill="#374151" font-weight="600">${esc(g.sub)}</text>
<text x="240" y="428" text-anchor="middle" font-family="Inter,sans-serif" font-size="9" fill="#6b7280">Example: <tspan font-weight="700" fill="#0f766e">${esc(wordExample)}</tspan> · English labels inside image</text>
<text x="240" y="458" text-anchor="middle" font-family="Inter,sans-serif" font-size="8" fill="#9ca3af">Cross-section mouth diagram — no arrows — for pronunciation practice</text>
</svg>`;
}

function classifyWord(p) {
  const cm = p.common_mistake || '';
  const ipa = p.ipa_us || '';
  if (cm.includes('θ') || cm.includes('th không rung') || ipa.includes('θ')) return 'th';
  if (cm.includes('ð') || ipa.includes('ð')) return 'th';
  if (cm.includes('ʃ') || ipa.includes('ʃ')) return 'sh';
  if (cm.includes('tʃ') || ipa.includes('tʃ')) return 'ch';
  if (cm.includes('dʒ') || ipa.includes('dʒ')) return 'ch';
  if (cm.includes('ŋ') || ipa.includes('ŋ')) return 'ng';
  if (cm.includes('æ') || ipa.includes('æ')) return 'ae';
  if (ipa.includes('eɪ')) return 'ei';
  if (ipa.includes('aɪ')) return 'ai';
  if (ipa.includes('aʊ')) return 'au';
  if (ipa.includes('oʊ')) return 'ou';
  if (ipa.includes('ɔ')) return 'aw';
  if (ipa.includes('ʌ')) return 'uh';
  if (ipa.includes('ə') || ipa.includes('ɚ') || ipa.includes('ɝ')) return ipa.includes('ɚ')||ipa.includes('ɝ') ? 'rcolor' : 'schwa';
  // fallback via common_mistake text search
  if (cm.includes('eɪ')) return 'ei';
  if (cm.includes('aɪ')) return 'ai';
  if (cm.includes('aʊ')) return 'au';
  if (cm.includes('oʊ')) return 'ou';
  if (cm.includes('ɔ')) return 'aw';
  if (cm.includes('ʌ')) return 'uh';
  if (cm.includes('ə')) return 'schwa';
  return 'other';
}

async function main(){
  const dry = process.argv.includes('--dry');
  const filterArg = process.argv.find(a=>a.startsWith('--words='));
  const filterSet = filterArg ? new Set(filterArg.replace('--words=','').split(',').map(s=>s.trim())) : null;
  const data = JSON.parse(fs.readFileSync(DATA_PATH,'utf8'));
  const pairs = data.pairs || [];
  // Pre-generate group assets (one per group)
  const groupAssets = {};
  for(const g of Object.keys(GROUPS)){
    const svg = mouthSvg(g, g==='th'?'think /θɪŋk/': g==='ae'?'cat /kæt/': g==='sh'?'she /ʃiː/': `${g} example`);
    const jpgBuf = await sharp(Buffer.from(svg)).jpeg({quality: 84, mozjpeg: true}).resize(480,480).toBuffer();
    const webpBuf = await sharp(Buffer.from(svg)).webp({quality: 80}).resize(480,480).toBuffer();
    groupAssets[g] = { svg, jpgBuf, webpBuf };
  }
  // Save group assets to tmp for reuse
  let injected=0, skipped=0, already=0;
  for(const p of pairs){
    if(filterSet && !filterSet.has(p.word)) continue;
    const group = classifyWord(p);
    const dir = path.join(OUT_BASE, p.word);
    if(!fs.existsSync(path.join(dir,'index.html'))) { skipped++; continue; }
    fs.mkdirSync(dir, {recursive:true});
    const jpgName = `mouth-${group}.jpg`;
    const webpName = `mouth-${group}-480.webp`;
    const svgName = `diagram-${group}.svg`;
    const jpgPath = path.join(dir, jpgName);
    const webpPath = path.join(dir, webpName);
    const svgPath = path.join(dir, svgName);
    if(!dry){
      // Regenerate SVG per word with correct example word
      const wordSvg = mouthSvg(group, `${p.word} /${p.ipa_us}/`);
      fs.writeFileSync(svgPath, wordSvg);
      const jpgBuf = await sharp(Buffer.from(wordSvg)).jpeg({quality: 84, mozjpeg: true}).resize(480,480).toBuffer();
      const webpBuf = await sharp(Buffer.from(wordSvg)).webp({quality: 80}).resize(480,480).toBuffer();
      fs.writeFileSync(jpgPath, jpgBuf);
      fs.writeFileSync(webpPath, webpBuf);
    }
    // Inject figure into index.html
    const idxPath = path.join(dir,'index.html');
    let html = fs.readFileSync(idxPath,'utf8');
    if(html.includes(`mouth-${group}.jpg`) || html.includes('mouth-th.jpg')){
      // If think already has mouth-th.jpg, keep it (perfection already), skip duplicate
      if(p.word==='think' && html.includes('mouth-th.jpg')) { already++; continue; }
      // For others that already have correct group, skip
      if(html.includes(`mouth-${group}.jpg`)) { already++; continue; }
    }
    // Remove old text-only placeholder if exists? The current builder puts no figure; think has figure, others have none.
    // Build figure block
    const figCaptionLabels = GROUPS[group].sub;
    const figure = `  <figure style=\"margin:16px 0;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden\">\n      <img src=\"/vi/phat-am/${p.word}/${jpgName}\" srcset=\"/vi/phat-am/${p.word}/${webpName} 480w\" sizes=\"(max-width: 640px) 100vw, 480px\" alt=\"Mouth cross-section for /${esc(p.ipa_us)}/ ${esc(p.word)} — ${esc(GROUPS[group].label)} — English labels inside image\" width=\"480\" height=\"480\" loading=\"lazy\" decoding=\"async\" style=\"width:100%;height:auto;display:block\">\n      <figcaption style=\"padding:8px 12px;background:#f9fafb;border-top:1px solid #e5e7eb;font-size:11px;color:#6b7280\">English labels inside image: ${esc(figCaptionLabels)}</figcaption>\n    </figure>`;
    // Insert after aud-row div, before audio element
    if(html.includes('<audio id=\"ipa-player\"')){
      html = html.replace('<audio id=\"ipa-player\"', `${figure}\n  <audio id=\"ipa-player\"`);
    } else if(html.includes('</div>\n  <audio')){
      html = html.replace('</div>\n  <audio', `</div>\n${figure}\n  <audio`);
    } else {
      // fallback after tldr
      html = html.replace('</p>\n  <h2>Nghe phát âm</h2>', `</p>\n${figure}\n  <h2>Nghe phát âm</h2>`);
    }
    // Clean up any stray </div> left from previous think insertion (think had extra </div>)
    html = html.replace(/\s*<\/div>\s*<audio/, `\n  <audio`);
    if(!dry) fs.writeFileSync(idxPath, html);
    injected++;
  }
  console.log(`INJECT-MOUTH: groups ${Object.keys(GROUPS).length}, injected ${injected}, already had ${already}, skipped missing ${skipped}`);
}

main().catch(e=>{console.error(e); process.exit(1)});
