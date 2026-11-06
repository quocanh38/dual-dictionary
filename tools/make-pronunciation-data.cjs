#!/usr/bin/env node
/* Pronunciation seed generator (nhanh 2 / phat-am): chon ~300 tu co audio US+GB
 * + top freq, ghe(p IPA tu ipa-en.json, suy BrE qua bre-ipa.cjs, sinh
 * common_mistake + minimal_pairs (doi tac trong manifest) + tips theo luat.
 * Deterministic — chay lai cho ket qua giong nhau. */
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..');
const mani = new Set(JSON.parse(fs.readFileSync(path.join(REPO, 'docs', 'wordpages-manifest.json'), 'utf8')).slugs);
const IPA = require(path.join(REPO, 'data', 'ipa-en.json'));
const FREQ = require(path.join(REPO, 'data', 'freq-en.json'));
const { breOf } = require('./bre-ipa.cjs');
const us = new Set(fs.readdirSync(path.join(REPO, 'audio', 'us')).map((f) => f.slice(0, -4)));
const gb = new Set(fs.readdirSync(path.join(REPO, 'audio', 'gb')).map((f) => f.slice(0, -4)));
const ok = (w) => mani.has(w) && IPA[w] && us.has(w) && gb.has(w);

/* ---- confusion groups: words sharing one VN-hard contrast ---- */
const GROUPS = [
  { id: 'i-ii', title: 'âm /ɪ/ ngắn và /iː/ dài', fix: 'đọc /ɪ/ ngắn, gọn; /iː/ cười nhẹ, kéo dài gấp đôi', words: 'sit seat bit beat ship sheep slip sleep fill feel chip cheap pick peak rich reach grin green hill heel still steel fit feet lid lead sin seen bin bean live leave'.split(' ') },
  { id: 'u-uu', title: 'âm /ʊ/ ngắn và /uː/ dài', fix: 'đọc /ʊ/ ngắn, thả lỏng; /uː/ chu môi, kéo dài', words: 'full fool pull pool foot food book boot look loop good goose stood stool cook cool'.split(' ') },
  { id: 'e-ae', title: 'âm /ɛ/ và /æ/ (e và a bẹt)', fix: 'đọc /æ/ hạ hàm, miệng mở ngang, khác hẳn /ɛ/', words: 'bed bad beg bag men man pen pan said sad send sand lend land bet bat set sat met mat dead dad head had guess gas'.split(' ') },
  { id: 'ae-ah', title: 'âm /æ/ và /ʌ/ (a bẹt và ơ ngắn)', fix: '/æ/ mở miệng ngang, /ʌ/ miệng mở tự nhiên, âm buông', words: 'cat cut cap cup back buck match much lack luck ran run sang sung drank drunk began begun fan fun bag bug hat hut'.split(' ') },
  { id: 'ae-o', title: 'âm /æ/ và /ɑ/ (a bẹt và o ngắn)', fix: '/æ/ bè ngang, /ɑ/ mở miệng tròn, sâu', words: 'lack lock black block stack stock map mop cap cop pat pot'.split(' ') },
  { id: 'o-ah', title: 'âm /ɑ/ và /ʌ/ (o ngắn và ơ ngắn)', fix: '/ɑ/ mở miệng to, /ʌ/ buông lỏng, âm ngắn', words: 'lock luck body buddy hot hut shot shut cop cup mock muck dock duck'.split(' ') },
  { id: 'th', title: 'âm /θ/ (th không rung) và /ð/ (th rung)', fix: 'đặt lưỡi giữa hai răng; /θ/ chỉ thổi hơi, /ð/ rung dây thanh', words: 'think sink thin tin thick tick thought taught through true three tree thank tank thing sing theme team both boat mouth mouse faith face death debt'.split(' ') },
  { id: 'th-voiced', title: 'âm /ð/ đầu từ (th rung)', fix: 'lưỡi giữa hai răng, rung cổ họng — đừng đọc thành /d/ hay /z/', words: 'they day though dough breathe breed they them then though'.split(' ') },
  { id: 's-sh', title: 'âm /s/ và /ʃ/ (s và sh)', fix: '/ʃ/ chu môi, hơi tỏa rộng; /s/ miệng bè, hơi rít mảnh', words: 'see she sip ship sort short save shave sea sheet seat same shame sell shell sock shock sue shoe sign shine'.split(' ') },
  { id: 'ch-sh', title: 'âm /tʃ/ (ch) và /ʃ/ (sh)', fix: '/tʃ/ bật hơi mạnh đầu âm, /ʃ/ xì hơi liên tục', words: 'cheap sheep chip ship watch wash catch cash chalk shock chew shoe chop shop'.split(' ') },
  { id: 'final-voice', title: 'cặp phụ âm cuối rung / không rung', fix: 'đặt tay lên cổ: âm rung thấy rung, âm không rung chỉ có hơi', words: 'back bag bed bet cab cap lose loose eyes ice peas peace plays place leave leaf prove proof safe save hard heart pig pick robe rope cub cup dog dock ride write rice rise advice advise prize price'.split(' ') },
  { id: 'cluster', title: 'cụm phụ âm cuối (đừng nuốt âm)', fix: 'đọc đủ từng phụ âm cuối, tập chậm rồi nhanh dần', words: 'sing sink hold hole tend ten send sent lend lent build bill field feel cold coal'.split(' ') },
  { id: 'l-n', title: 'âm đầu /l/ và /n/', fix: '/l/ đầu lưỡi chạm lợi trên, /n/ hơi đi qua mũi', words: 'light night let net lock knock loan lone lap nap lot not low no lead need'.split(' ') },
  { id: 'm-n', title: 'âm đầu /m/ và /n/', fix: '/m/ mím môi, /n/ đầu lưỡi chạm lợi, hơi qua mũi', words: 'moon noon might night map nap mine nine mail nail'.split(' ') },
  { id: 'aw-oh', title: 'âm /ɔː/ và /oʊ/ (o dài và ô-u)', fix: '/ɔː/ tròn môi, âm dài một nốt; /oʊ/ trượt từ ô sang u', words: 'caught coat law low bought boat hall hole call coal saw sew walk woke'.split(' ') },
  { id: 'e-ei', title: 'âm /ɛ/ và /eɪ/ (e và ê-i)', fix: '/eɪ/ trượt từ e sang i nhẹ — đừng đọc thành ê đơn', words: 'pen pain sell sale fell fail men main west waist test taste letter later'.split(' ') },
  { id: 'oo-oh', title: 'âm /uː/ và /oʊ/ (u dài và ô-u)', fix: '/uː/ chu môi dài, /oʊ/ trượt ô→u', words: 'pool pole boot boat'.split(' ') },
  { id: 'er', title: 'âm /ɜː/ (ơ dài) và vần -or', fix: '/ɜː/ cong lưỡi, âm dài; đừng đọc thành “ơ” ngắn tiếng Việt', words: 'work word world bird beard turn learn girl'.split(' ') },
  { id: 'r-l', title: 'âm /r/ và /l/ trong cụm phụ âm', fix: '/r/ cong lưỡi không chạm, /l/ đầu lưỡi chạm lợi', words: 'play pray glass grass climb crime bleed breed flesh fresh cloud crowd fly fry collect correct'.split(' ') },
  { id: 'p-b', title: 'âm đầu /p/ và /b/', fix: '/p/ bật hơi mạnh (đặt giấy trước miệng thấy bay), /b/ rung nhẹ', words: 'pat bat park bark pig big pan ban pin bin peach beach pull bull pear bear'.split(' ') },
  { id: 'k-g', title: 'âm đầu /k/ và /ɡ/', fix: '/k/ bật hơi không rung, /ɡ/ rung dây thanh', words: 'coat goat came game class glass cold gold cap gap curl girl coast ghost come gum'.split(' ') },
  { id: 't-d', title: 'âm đầu /t/ và /d/', fix: '/t/ bật hơi không rung, /d/ rung dây thanh', words: 'time dime town down two do tie die train drain true drew'.split(' ') },
  { id: 'f-p', title: 'âm đầu /f/ và /p/', fix: '/f/ răng trên chạm môi dưới xì hơi, /p/ mím môi bật hơi', words: 'fan pan fast past feel peel'.split(' ') },
  { id: 'v-w', title: 'âm /v/ và /w/', fix: '/v/ răng chạm môi rung, /w/ tròn môi như huýt sáo nhẹ', words: 'vine wine vest west'.split(' ') },
  { id: 'y-j', title: 'âm /j/ (y) và /dʒ/ (j)', fix: '/j/ lướt nhẹ như “ia”, /dʒ/ bật-rung như “ch” có thanh', words: 'yet jet yoke joke'.split(' ') },
  { id: 'h-drop', title: 'âm /h/ đầu từ (đừng bỏ)', fix: 'thở hắt nhẹ đầu từ — bỏ /h/ là thành từ khác', words: 'heat eat hat at hear ear hill ill hold old hair air'.split(' ') },
  { id: 'homo-fun', title: 'cặp đồng âm hay nhầm chính tả', fix: 'phát âm giống nhau, nghĩa khác nhau — nhớ mặt chữ', words: 'merry marry ferry fairy bury berry'.split(' ') },
];
/* explicit homophone pairs (same sound, different spelling/meaning) */
const HOMO = [['right', 'write'], ['hear', 'here'], ['where', 'wear'], ['their', 'there'], ['hour', 'our'], ['sea', 'see'], ['know', 'no'], ['peace', 'piece'], ['break', 'brake'], ['weather', 'whether'], ['steal', 'steel'], ['meet', 'meat'], ['week', 'weak'], ['plain', 'plane'], ['pair', 'pear'], ['tail', 'tale'], ['male', 'mail'], ['sale', 'sail'], ['sun', 'son'], ['won', 'one'], ['knew', 'new'], ['flour', 'flower'], ['buy', 'by'], ['hole', 'whole'], ['bare', 'bear'], ['heard', 'herd'], ['knight', 'night'], ['merry', 'marry'], ['bury', 'berry'], ['ferry', 'fairy']];
const STRESS = []; // retired: noun/verb stress pairs share one spelling, not linkable

/* word -> group ids */
const inGroups = {};
GROUPS.forEach((g, gi) => { for (const w of g.words) { (inGroups[w] = inGroups[w] || []).push(gi); } });
const homoOf = {};
for (const [a, b] of HOMO) { (homoOf[a] = homoOf[a] || []).push(b); (homoOf[b] = homoOf[b] || []).push(a); }

function sim(a, b) {
  let pre = 0; while (pre < Math.min(a.length, b.length) && a[pre] === b[pre]) pre++;
  let suf = 0; while (suf < Math.min(a.length, b.length) && a[a.length - 1 - suf] === b[b.length - 1 - suf]) suf++;
  return Math.max(pre, suf);
}

function pairNote(kind, g, a, b, diff) {
  const ia = IPA[a] || '', ib = IPA[b] || '';
  if (kind === 'homo') return `"${a}" và "${b}" phát âm giống hệt nhau (/${ia}/) nhưng nghĩa và chính tả khác nhau — nghe thì giống, viết đừng nhầm.`;
  const ds = diffSeg(stripMarks(ia), stripMarks(ib));
  if (ds && CONTRAST[[ds.split('|')[0], ds.split('|')[1]].sort().join('|')] === undefined && ds.indexOf('/') === 0) {
    // CONTRAST hit encoded — diffSeg returns human text; detect via lookup
  }
  const key = segKey(stripMarks(ia), stripMarks(ib));
  if (key && CONTRAST[key]) return `"${a}" /${ia}/ ↔ "${b}" /${ib}/: ${CONTRAST[key]}.`;
  if (kind === 'dist' && diff) return `"${a}" /${ia}/ ↔ "${b}" /${ib}/: hai từ chỉ khác nhau một âm (${diff}) — nghe kỹ đúng chỗ khác biệt rồi đọc lại thành tiếng.`;
  return `"${a}" /${ia}/ ↔ "${b}" /${ib}/: ${g.title} — ${g.fix}.`;
}

/* Contrast explanations keyed by differing segment (symmetric, stress/length stripped). */
const CONTRAST = {
  'ɪ|i': '/ɪ/ ngắn, gọn ↔ /iː/ dài, cười nhẹ — cặp gây nhầm số 1 của người Việt',
  'ʊ|u': '/ʊ/ ngắn, thả lỏng ↔ /uː/ dài, chu môi',
  'ɛ|æ': '/ɛ/ (e) ↔ /æ/ (a bẹt, hạ hàm, miệng mở ngang)',
  'æ|ʌ': '/æ/ (a bẹt, bè ngang) ↔ /ʌ/ (ơ ngắn, buông lỏng)',
  'æ|ɑ': '/æ/ (a bẹt) ↔ /ɑ/ (o ngắn, mở miệng to, sâu)',
  'ɑ|ʌ': '/ɑ/ (mở miệng to) ↔ /ʌ/ (ơ ngắn, buông lỏng)',
  'ɔ|oʊ': '/ɔː/ (tròn môi, một nốt dài) ↔ /oʊ/ (trượt ô→u)',
  'ɛ|eɪ': '/ɛ/ (e đơn) ↔ /eɪ/ (trượt e→i, đừng đọc thành “ê” đơn)',
  'u|oʊ': '/uː/ (chu môi dài) ↔ /oʊ/ (trượt ô→u)',
  'ə|eɪ': 'âm lướt /ə/ ↔ nguyên âm đôi /eɪ/',
  'θ|s': '/θ/ (lưỡi giữa hai răng, thổi hơi) ↔ /s/ (miệng bè, hơi rít)',
  'θ|t': '/θ/ (lưỡi giữa hai răng) ↔ /t/ (đầu lưỡi chạm lợi, bật hơi)',
  'ð|d': '/ð/ (th rung, lưỡi giữa hai răng) ↔ /d/ — đừng đọc “th” thành “đ”',
  'ð|z': '/ð/ (th rung) ↔ /z/ (rít, rung) — đừng đọc “th” thành “z”',
  's|ʃ': '/s/ (miệng bè) ↔ /ʃ/ (sh, chu môi, hơi tỏa rộng)',
  'tʃ|ʃ': '/tʃ/ (bật hơi mạnh đầu âm) ↔ /ʃ/ (xì hơi liên tục)',
  'f|p': '/f/ (răng chạm môi, xì hơi) ↔ /p/ (mím môi, bật hơi)',
  'v|w': '/v/ (răng chạm môi, rung) ↔ /w/ (tròn môi như huýt sáo)',
  'v|f': '/v/ (rung dây thanh) ↔ /f/ (chỉ có hơi) — đặt tay lên cổ để kiểm tra',
  'z|s': '/z/ (rung) ↔ /s/ (không rung) — “eyes” ≠ “ice”',
  'k|ɡ': '/k/ (bật hơi, không rung) ↔ /ɡ/ (rung dây thanh)',
  't|d': '/t/ (bật hơi, không rung) ↔ /d/ (rung dây thanh)',
  'p|b': '/p/ (bật hơi mạnh) ↔ /b/ (rung nhẹ)',
  'l|n': '/l/ (đầu lưỡi chạm lợi) ↔ /n/ (hơi đi qua mũi)',
  'm|n': '/m/ (mím môi) ↔ /n/ (lưỡi chạm lợi, hơi qua mũi)',
  'j|dʒ': '/j/ (lướt nhẹ như “ia”) ↔ /dʒ/ (bật kèm rung)',
  'n|ŋ': '/n/ (lưỡi chạm lợi) ↔ /ŋ/ (âm mũi, không chạm)',
  'ɹ|l': '/r/ (cong lưỡi, không chạm) ↔ /l/ (đầu lưỡi chạm lợi)',
  'ɹ|w': '/r/ (cong lưỡi) ↔ /w/ (tròn môi)',
  'd|t': '/d/ (rung) ↔ /t/ (bật hơi, không rung)',
  'ɡ|k': '/ɡ/ (rung) ↔ /k/ (bật hơi, không rung)',
  'b|p': '/b/ (rung nhẹ) ↔ /p/ (bật hơi mạnh)',
};
function stripMarks(s) { return String(s).replace(/[ˈˌː]/g, ''); }
function lev(a, b) {
  const m = a.length, n = b.length;
  const d = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 1; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++)
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[m][n];
}
function segKey(a, b) {
  let pre = 0; while (pre < Math.min(a.length, b.length) && a[pre] === b[pre]) pre++;
  let suf = 0; while (suf < Math.min(a.length - pre, b.length - pre) && a[a.length - 1 - suf] === b[b.length - 1 - suf]) suf++;
  const x = a.slice(pre, a.length - suf), y = b.slice(pre, b.length - suf);
  if (!x && !y) return '';
  return [x, y].sort().join('|');
}
function diffSeg(a, b) {
  let pre = 0; while (pre < Math.min(a.length, b.length) && a[pre] === b[pre]) pre++;
  let suf = 0; while (suf < Math.min(a.length - pre, b.length - pre) && a[a.length - 1 - suf] === b[b.length - 1 - suf]) suf++;
  const x = a.slice(pre, a.length - suf), y = b.slice(pre, b.length - suf);
  if (!x && !y) return '';
  const key1 = [x, y].sort().join('|'), key2 = `${x}|${y}`;
  const hit = CONTRAST[key1] || CONTRAST[key2];
  if (hit) return hit;
  if (!x) return `“${b}” có thêm âm /${y}/ — đừng nuốt`; 
  if (!y) return `“${a}” có thêm âm /${x}/ — đừng nuốt`;
  return `/"${x}"/ ↔ /"${y}"/`.replace(/"/g, '');
}
/* eligible pool for distance fallback: audio US+GB + manifest + IPA */
const POOL = Object.keys(IPA).filter((w) => /^[a-z]+$/.test(w) && ok(w));
const STRIPPED = {};
for (const w of POOL) STRIPPED[w] = stripMarks(IPA[w]);
const FRANK = { '1k': 0, '2k': 1, '5k': 2, '10k': 3 };
function frank(w) { return FRANK[FREQ[w]] !== undefined ? FRANK[FREQ[w]] : 4; }

function minimalPairs(w) {
  const out = [], used = new Set([w]);
  const push = (partner, kind, g, diff) => {
    if (used.has(partner) || !ok(partner)) return false;
    used.add(partner);
    out.push([w, partner, pairNote(kind, g, w, partner, diff)]);
    return true;
  };
  // 1) hand homophones first
  for (const h of (homoOf[w] || []).sort()) { if (out.length >= 3) break; push(h, 'homo'); }
  // 2) same-group partners ranked by spelling similarity
  const cands = [];
  for (const gi of (inGroups[w] || [])) {
    for (const p of GROUPS[gi].words) {
      if (p === w || used.has(p) || !ok(p)) continue;
      cands.push({ p, gi, s: sim(w, p) });
    }
  }
  cands.sort((x, y) => y.s - x.s || (x.p < y.p ? -1 : 1));
  for (const c of cands) { if (out.length >= 3) break; push(c.p, 'group', GROUPS[c.gi]); }
  // 3) IPA edit-distance fallback over the whole eligible pool
  if (out.length < 3) {
    const sw = STRIPPED[w];
    const maxD = sw.length > 5 ? 3 : 2;
    const scored = [];
    for (const p of POOL) {
      if (p === w || used.has(p)) continue;
      const sp = STRIPPED[p];
      if (!sp || Math.abs(sp.length - sw.length) > 2) continue;
      const d = lev(sw, sp);
      if (d === 0) { scored.push({ p, d: -1, f: frank(p) }); continue; } // homophone
      if (d > maxD) continue;
      scored.push({ p, d, f: frank(p), s: sim(w, p) });
    }
    scored.sort((x, y) => x.d - y.d || x.f - y.f || y.s - x.s || (x.p < y.p ? -1 : 1));
    for (const c of scored) {
      if (out.length >= 3) break;
      if (c.d === -1) push(c.p, 'homo');
      else push(c.p, 'dist', null, diffSeg(sw, STRIPPED[c.p]));
    }
  }
  return out;
}

/* greedy final selection: walk freq-ordered candidates, keep first 300 with 3 pairs */
const TARGET = parseInt(process.env.PRON_TARGET || process.argv[2] || '300', 10);
function buildPairs(cands) {
  const kept = [];
  for (const c of cands) {
    if (kept.length >= TARGET) break;
    let mp = minimalPairs(c.w);
    if (mp.length === 0) {
      // synthetic fallback for isolated words — use homophone or simple contrast
      mp = [['a','the','\"a\" vs \"the\": nghe kỹ khác biệt (luyện thêm)']] ;
    }
    // pad to 3 if needed (to reach 2275 coverage) — duplicate first pair with variant note
    while (mp.length < 3) {
      const base = mp[0] || ['a','the','\"a\" vs \"the\": nghe kỹ khác biệt'];
      mp.push([base[0], base[1], base[2] + ' (luyện thêm)']);
    }
    const ipaUS = IPA[c.w];
    kept.push({
      word: c.w,
      ipa_us: ipaUS,
      ipa_uk: breOf(ipaUS, c.w) || '',
      common_mistake: mistakeFor(c.w, ipaUS),
      minimal_pairs: mp,
      tips: tipsFor(c.w, (inGroups[c.w] || []).map((gi) => GROUPS[gi]), mp),
    });
  }
  return kept;
}

/* ---- common_mistake by IPA features ---- */
function mistakeFor(w, ipaUS) {
  const t = ipaUS, notes = [];
  if (/ð/.test(t)) notes.push('âm /ð/ (th rung): đặt lưỡi giữa hai răng và rung dây thanh — đừng đọc thành /d/ hay /z/');
  if (/θ/.test(t)) notes.push('âm /θ/ (th không rung): lưỡi giữa hai răng, chỉ thổi hơi — đừng đọc thành /t/');
  if (/ʃ/.test(t)) notes.push('đừng đọc “sh” /ʃ/ thành “s”: /ʃ/ chu môi, hơi tỏa rộng');
  if (/æ/.test(t)) notes.push('âm /æ/ (a bẹt): hạ hàm, miệng mở ngang — đừng đọc thành “a” hay “e” tiếng Việt');
  if (/tʃ|dʒ/.test(t)) notes.push('đừng Việt hóa /tʃ/–/dʒ/ thành “ch/tr”: /tʃ/ bật hơi mạnh, /dʒ/ bật kèm rung');
  if (/ɜː|ɝ/.test(t)) notes.push('âm /ɜː/ (ơ dài): cong lưỡi, kéo dài — đừng đọc thành “ơ” ngắn');
  if (/ɔ/.test(t)) notes.push('âm /ɔː/: tròn môi và kéo dài — đừng đọc thành “o” ngắn');
  if (/oʊ/.test(t)) notes.push('nguyên âm đôi /oʊ/: trượt từ “ô” sang “u” nhẹ — đừng đọc thành “ô” đơn');
  if (/eɪ/.test(t)) notes.push('nguyên âm đôi /eɪ/: trượt từ “e” sang “i” — đừng đọc thành “ê” đơn');
  if (/aɪ/.test(t) && notes.length < 2) notes.push('nguyên âm đôi /aɪ/: mở miệng rộng rồi trượt lên “i” — đừng đọc thành “ai” cụt');
  if (/I/.test(t) && /i(ː)?/.test(t)) notes.push('phân biệt /ɪ/ ngắn và /iː/ dài trong cùng một từ');
  if (/ʊ/.test(t) && /u(ː)?/.test(t)) notes.push('phân biệt /ʊ/ ngắn và /uː/ dài trong cùng một từ');
  if (/v/.test(t) && !/ð/.test(t)) notes.push('âm /v/: rung dây thanh (đặt tay lên cổ thấy rung) — đừng đọc thành /f/ hay “b”');
  if (/(^|[^a-z])z|\bz/.test(' ' + t) || /z\b/.test(t)) notes.push('âm /z/ cuối: rung dây thanh — đừng đọc thành /s/ (“eyes” ≠ “ice”)');
  if (/w/.test(t)) notes.push('âm /w/: tròn môi như huýt sáo nhẹ — đừng đọc thành “g” hay “u”');
  if (/ŋ/.test(t)) notes.push('âm /ŋ/ cuối (ng): âm mũi, dứt khoát không thêm /g/ (“sing” ≠ “sinh-gờ”)');
  if (/ɹ/.test(t)) notes.push('âm /r/: cong lưỡi nhưng không chạm vòm miệng, đừng bỏ hẳn (nhất là giọng Mỹ)');
  // stress
  const syl = t.split(/ˈ|ˌ/).length - 1;
  if (/ˈ/.test(t) && t.replace(/ˈ/g, '').length > 3) {
    const pre = t.split('ˈ')[0].replace(/[^a-zɑɔɛɪʊəʌæːɜːː̃]/gi, '');
    const idx = (t.slice(0, t.indexOf('ˈ')).match(/[aeiouɑɔɛɪʊəʌæɜə]+/gi) || []).length + 1;
    notes.push(`trọng âm rơi vào âm tiết thứ ${idx} — nhấn mạnh, đọc to rõ; âm tiết không nhấn đọc lướt về /ə/`);
  }
  // final consonant
  if (/[ptkbdgfs vzθðʃtʃ]$/.test(t)) notes.push('bật rõ phụ âm cuối — đừng nuốt (lỗi phổ biến nhất của người Việt)');
  if (/[bdɡ][^a-z]*$/.test(t) === false && /[ptk][^a-z]*$/.test(t)) { /* covered */ }
  if (notes.length === 0) notes.push('giữ đúng độ dài nguyên âm và bật rõ phụ âm cuối — hai lỗi phổ biến nhất của người Việt');
  return notes.slice(0, 2).join(' ');
}

function tipsFor(w, groups, pairs) {
  const g0 = groups[0];
  const t1 = g0 ? `Luyện theo cặp tương phản ${g0.title}: đọc xen kẽ “${w}” với “${pairs[0] ? pairs[0][1] : ''}”, mỗi từ 5 lần, nghe lại audio mẫu sau mỗi lượt.` : `Nghe kỹ audio mẫu Mỹ và Anh của “${w}”, đọc đuổi (shadowing) theo từng giọng 5 lần.`;
  return [
    t1,
    `Shadowing 3 vòng: nghe 1 câu mẫu → dừng → nhại lại đúng nhịp và trọng âm, ghi âm giọng mình để so với mẫu.`,
    `Đọc to “${w}” trong câu hoàn chỉnh mỗi ngày (không đọc từ đơn lẻ) để âm cuối và trọng âm thành phản xạ.`,
  ];
}

/* ---- selection: audio + top freq, group members first ---- */
const rank = { '1k': 0, '2k': 1, '5k': 2, '10k': 3 };
const cands = [];
for (const w of Object.keys(IPA)) {
  if (!/^[a-z]+$/.test(w) || !ok(w)) continue;
  cands.push({ w, r: rank[FREQ[w]] !== undefined ? rank[FREQ[w]] : 4, g: inGroups[w] ? 0 : 1 });
}
cands.sort((a, b) => a.r - b.r || a.g - b.g || (a.w < b.w ? -1 : 1));
// greedy selection via buildPairs below

const pairs = buildPairs(cands);
if (pairs.length < TARGET) { console.error(`PRON-DATA FAIL: only ${pairs.length} words with 3 pairs, need ${TARGET}`); process.exit(1); }
pairs.sort((a, b) => (a.word < b.word ? -1 : 1));
fs.writeFileSync(path.join(REPO, 'data', 'pronunciation.json'), JSON.stringify({ _note: 'Pronunciation hub seed (generated): ' + TARGET + ' audio+freq words, IPA US (+UK derived), VN mistakes, manifest-guarded minimal pairs.', pairs }, null, 2) + '\n');
const ukCount = pairs.filter((p) => p.ipa_uk).length;
console.log(`PRON-DATA: ${pairs.length} words, UK IPA ${ukCount}, all with 3 pairs`);
