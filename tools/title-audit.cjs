#!/usr/bin/env node
/* Title/CTR audit (owner-approved 03/11, P0-5).
 * Quét <title> toàn site: trùng lặp, quá dài (>60 ký tự hiển thị), quá ngắn.
 * Output: docs/TITLE-AUDIT.md (backlog) + stdout tóm tắt.
 * Chạy sau mỗi đợt rebuild: node tools/title-audit.cjs
 */
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..');
const DIRS = ['vi/tu', 'vi/gioi-tu', 'vi/cum-di-voi', 'vi/phan-biet', 'vi/loi-sai',
  'vi/dong-nghia', 'vi/phat-am', 'vi/ngu-phap', 'vi/chu-de', 'vi/toeic',
  'vi/cambridge', 'vi/luyen-thi', 'vi/blog/ielts', 'vi/blog/toeic', 'vi/blog/phuong-phap'];

function* walkHtml(dirs) {
  for (const d of dirs) {
    const root = path.join(REPO, d);
    if (!fs.existsSync(root)) continue;
    const stack = [root];
    while (stack.length) {
      const cur = stack.pop();
      for (const e of fs.readdirSync(cur, { withFileTypes: true })) {
        const p = path.join(cur, e.name);
        if (e.isDirectory()) stack.push(p);
        else if (e.name === 'index.html') yield p;
      }
    }
  }
}

const rows = [];
for (const f of walkHtml(DIRS)) {
  const t = fs.readFileSync(f, 'utf8');
  const m = t.match(/<title>([\s\S]*?)<\/title>/);
  const title = m ? m[1].replace(/&#?\w+;/g, '?').trim() : '';
  rows.push({ file: path.relative(REPO, f), title, len: [...title].length });
}

const byTitle = new Map();
for (const r of rows) {
  if (!byTitle.has(r.title)) byTitle.set(r.title, []);
  byTitle.get(r.title).push(r.file);
}
const dups = [...byTitle.entries()].filter(([, v]) => v.length > 1);
const long = rows.filter((r) => r.len > 60).sort((a, b) => b.len - a.len);
const short = rows.filter((r) => r.len > 0 && r.len < 20);
const missing = rows.filter((r) => !r.len);

const pct = (n) => ((100 * n) / rows.length).toFixed(1);
let md = `# Title audit — ${new Date().toISOString().slice(0, 10)}\n\n`;
md += `- Pages: ${rows.length} · unique titles: ${byTitle.size}\n`;
md += `- Duplicate groups: ${dups.length} (${dups.reduce((a, [, v]) => a + v.length, 0)} pages)\n`;
md += `- Over 60 chars: ${long.length} (${pct(long.length)}%)\n`;
md += `- Under 20 chars: ${short.length} · missing: ${missing.length}\n\n`;

if (dups.length) {
  md += `## Trùng title (sửa trước)\n\n`;
  for (const [title, files] of dups.sort((a, b) => b[1].length - a[1].length).slice(0, 30)) {
    md += `### x${files.length} — ${title.slice(0, 90)}\n`;
    for (const f of files.slice(0, 6)) md += `- ${f}\n`;
    md += `\n`;
  }
} else {
  md += `## Trùng title: KHÔNG CÓ ✅\n\n`;
}

if (long.length) {
  // nhóm theo hậu tố template
  const suf = new Map();
  for (const r of long) {
    const core = r.title.split(' | ')[0];
    const tail = core.slice(-25);
    if (!suf.has(tail)) suf.set(tail, []);
    suf.get(tail).push(r);
  }
  md += `## Quá 60 ký tự (${long.length} trang) — nhóm theo template\n\n`;
  md += `Template word hiện tại: \`{word} nghĩa là gì? — Nghĩa tiếng Việt | Dual Dictionary\` (phần cố định ~40 ký tự).\n`;
  md += `Đề xuất rút gọn toàn site: \`{word} nghĩa là gì? | Dual Dictionary\` (tiết kiệm ~19 ký tự).\n\n`;
  md += `Top 10 trang dài nhất:\n\n`;
  for (const r of long.slice(0, 10)) md += `- ${r.len}ch — ${r.title.slice(0, 100)} (\`${r.file}\`)\n`;
  md += `\nPhân bố theo nhánh:\n\n`;
  const byDir = new Map();
  for (const r of long) {
    const d = r.file.split('/')[1];
    byDir.set(d, (byDir.get(d) || 0) + 1);
  }
  for (const [d, n] of [...byDir.entries()].sort((a, b) => b[1] - a[1])) md += `- ${d}: ${n}\n`;
  md += `\n`;
}

if (short.length) {
  md += `## Quá ngắn (<20 ký tự)\n\n`;
  for (const r of short.slice(0, 20)) md += `- ${r.len}ch — ${r.title} (\`${r.file}\`)\n`;
  md += `\n`;
}
if (missing.length) {
  md += `## Thiếu title\n\n`;
  for (const r of missing.slice(0, 20)) md += `- ${r.file}\n`;
}

fs.writeFileSync(path.join(REPO, 'docs', 'TITLE-AUDIT.md'),
  md.replace(/\r?\n/g, '\n'));
console.log(`PAGES: ${rows.length} | DUP: ${dups.length} groups | LONG>60: ${long.length} (${pct(long.length)}%) | SHORT: ${short.length} | MISSING: ${missing.length}`);
console.log('Wrote docs/TITLE-AUDIT.md');
