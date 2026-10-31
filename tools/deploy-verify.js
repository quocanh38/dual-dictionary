#!/usr/bin/env node
/* deploy-verify.js — chặn sự cố "clobber" khi deploy Netlify (bài học 30/09/2026:
 * deploy là FULL SNAPSHOT của netlify-deploy; file nào thiếu trong folder sẽ bị
 * XOÁ khỏi production).
 *
 * So sánh danh sách file trên Netlify (API listSiteFiles, sha = plain sha1 của
 * nội dung) với folder local netlify-deploy:
 *   LIVE-ONLY     — file live có nhưng local thiếu → DEPLOY SẼ XOÁ NÓ. BLOCKER.
 *   SHA-MISMATCH  — file có cả hai nhưng nội dung khác → một bên mới hơn
 *                   (thường là tool khác vừa deploy). BLOCKER: đồng bộ trước.
 *   LOCAL-ONLY    — file local mới (nội dung định deploy) → cảnh báo nhẹ, bình thường.
 *   case-diff     — chỉ khác hoa/thường (macOS FS không phân biệt) → info.
 *
 * Cho phép loại trừ đã biết: (trống — /netlify.toml đã được khôi phục vào
 * netlify-deploy/ ngày 2026-09-30, copy nguyên xi từ staging dual-dictionary-git
 * để khớp live; xem deploy-state.md bẫy #7).
 *
 * Dùng: TRƯỚC deploy (phải exit 0) và SAU deploy (phải exit 0, chỉ còn LOCAL-ONLY
 * chủ ý). Cần node trên PATH + mạng; netlify-cli chạy qua npx.
 *   node tools/deploy-verify.js
 */
const { execFileSync } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const SITE_ID = process.env.NETLIFY_SITE_ID || '1af0641f-673e-48e9-9c86-1755d64b6558';
/* PC (dual-dictionary-git): site root IS the repo root — no Dictionaries/netlify-deploy nesting.
 * Override with DSH_DEPLOY_ROOT if running from the Mac layout. */
const ROOT = process.env.DSH_DEPLOY_ROOT
  ? path.resolve(process.env.DSH_DEPLOY_ROOT)
  : (fs.existsSync(path.join(__dirname, '..', 'Dictionaries', 'netlify-deploy'))
      ? path.join(__dirname, '..', 'Dictionaries', 'netlify-deploy')
      : path.join(__dirname, '..'));
// /netlify.toml (bẫy #12, 2026-09-30): the API's digest for this path is derived
// from the RESOLVED config (site-level plugins merged in) and never equals the
// repo file's sha. The file itself MUST stay in netlify-deploy/ (the deploy
// consumes it) — only its sha check is exempted. All other paths: no exemption.
const ALLOW_LIVE_ONLY = new Set(['/netlify.toml']);

function listLive() {
  // Cross-machine: on Windows, spawnSync('npx') can't run npx.cmd (ENOENT/EINVAL
  // on modern Node), so invoke the globally installed netlify-cli's run.js with
  // node directly. Override with NETLIFY_CLI_RUN if the install moves.
  // macOS/Linux keep the npx --yes netlify-cli@latest pipeline from the runbook.
  const json = JSON.stringify({ site_id: SITE_ID });
  let cmd, args, childEnv;
  if (process.platform === 'win32') {
    const runJs = process.env.NETLIFY_CLI_RUN
      || path.join(process.env.APPDATA || '', 'npm', 'node_modules', 'netlify-cli', 'bin', 'run.js');
    if (!fs.existsSync(runJs)) {
      throw new Error('netlify-cli not found at ' + runJs + ' — set NETLIFY_CLI_RUN to its bin/run.js');
    }
    cmd = process.execPath;
    args = [runJs, 'api', 'listSiteFiles', '--data', json];
    childEnv = { ...process.env };
  } else {
    cmd = 'npx';
    args = ['--yes', 'netlify-cli@latest', 'api', 'listSiteFiles', '--data', json];
    childEnv = { ...process.env };
    if (!childEnv.npm_config_cache) childEnv.npm_config_cache = '/tmp/npm-cache-dsh2';
  }
  const out = execFileSync(cmd, args, {
    encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
    env: childEnv,
    timeout: 180000,
  });
  const start = out.indexOf('[');
  if (start < 0) throw new Error('listSiteFiles did not return JSON:\n' + out.slice(0, 400));
  return JSON.parse(out.slice(start));
}

const localFiles = [];
function addLocalFile(p) {
  // v91 (Windows): emit POSIX-style paths — Netlify's live file list uses
  // forward slashes, and a backslash local list made every file a phantom
  // LIVE-ONLY (the 2026-09-30 pre-deploy run flagged all 2175).
  localFiles.push(p.slice(ROOT.length).split(path.sep).join('/'));
}
function walk(d, ancestors = new Set()) {
  const realDir = fs.realpathSync(d);
  if (ancestors.has(realDir)) throw new Error(`Directory symlink cycle at ${d}`);
  const nextAncestors = new Set(ancestors).add(realDir);
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    if (e.name.startsWith('.')) continue;
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p, nextAncestors);
    else if (e.isSymbolicLink()) {
      const target = fs.statSync(p);
      if (target.isDirectory()) walk(p, nextAncestors);
      else if (target.isFile()) addLocalFile(p);
      else throw new Error(`Unsupported symlink target at ${p}`);
    } else if (e.isFile()) addLocalFile(p);
  }
}
walk(ROOT);
const shaOf = (f) => crypto.createHash('sha1').update(fs.readFileSync(f)).digest('hex');
const localSha = new Map(localFiles.map((p) => [p, shaOf(path.join(ROOT, p))]));
const localByLower = new Map(localFiles.map((p) => [p.toLowerCase(), p]));

const live = listLive();
const baselineArg = process.argv.indexOf('--baseline-ref');
const baselineRef = baselineArg >= 0 ? (process.argv[baselineArg + 1] || '') : '';
const liveOnly = [], mismatch = [], docDrift = [], caseDiff = [], localOnly = [], changed = [];
const isDoc = (p) => p.startsWith('/docs/') || p.endsWith('.md');
const liveSet = new Set(live.map((f) => f.path));
for (const f of live) {
  const p = f.path;
  if (localSha.has(p)) {
    if (localSha.get(p) !== f.sha) {
      changed.push({ live: p, local: p, liveSha: f.sha });
      (isDoc(p) ? docDrift : mismatch).push(p);
    }
    continue;
  }
  const lower = localByLower.get(p.toLowerCase());
  if (lower) {
    caseDiff.push(`${p} ↔ ${lower}`);
    if (localSha.get(lower) !== f.sha) {
      changed.push({ live: p, local: lower, liveSha: f.sha });
      (isDoc(p) ? docDrift : mismatch).push(p + ` (case-twin ${lower})`);
    }
    continue;
  }
  liveOnly.push(p);
}
for (const p of localFiles) if (!liveSet.has(p) && !liveSet.has(p.toLowerCase()) && !ALLOW_LIVE_ONLY.has(p)) localOnly.push(p);

let baselineDrift = [], baselineMissing = [], baselineMatched = 0;
if (baselineRef) {
  const tree = execFileSync('git', ['ls-tree', '-r', '-z', '--name-only', baselineRef], {
    cwd: ROOT, maxBuffer: 64 * 1024 * 1024,
  }).toString('utf8').split('\0').filter(Boolean);
  const baselineByLower = new Map(tree.map((p) => [p.toLowerCase(), p]));
  const baselineRows = [];
  for (const row of changed) {
    const baselinePath = baselineByLower.get(row.local.replace(/^\/+/, '').toLowerCase());
    if (!baselinePath) { baselineMissing.push(row.live); continue; }
    baselineRows.push({ ...row, object: `${baselineRef}:${baselinePath}` });
  }
  const CHUNK = 128;
  for (let start = 0; start < baselineRows.length; start += CHUNK) {
    const batch = baselineRows.slice(start, start + CHUNK);
    const out = execFileSync('git', ['cat-file', '--batch'], {
      cwd: ROOT, input: batch.map((r) => r.object + '\n').join(''),
      encoding: null, maxBuffer: 256 * 1024 * 1024, timeout: 180000,
    });
    let offset = 0;
    for (const row of batch) {
      const end = out.indexOf(0x0a, offset);
      if (end < 0) throw new Error('Invalid git cat-file output for ' + row.object);
      const header = out.subarray(offset, end).toString('utf8');
      offset = end + 1;
      if (header.endsWith(' missing')) { baselineMissing.push(row.live); continue; }
      const match = /^\S+ blob (\d+)$/.exec(header);
      if (!match) throw new Error('Unexpected git cat-file header: ' + header);
      const size = Number(match[1]);
      const content = out.subarray(offset, offset + size);
      offset += size + 1;
      const hash = crypto.createHash('sha1').update(content).digest('hex');
      if (hash === row.liveSha) baselineMatched++;
      else baselineDrift.push(row.live);
    }
  }
}

console.log(`live files: ${live.length} | local files: ${localFiles.length}`);
for (const p of liveOnly) console.log(`LIVE-ONLY    ${p}  (deploy sẽ xoá!)`);
if (baselineRef) {
  console.log(`Expected local changes: ${changed.length} | matched production baseline ${baselineRef}: ${baselineMatched}`);
  for (const p of baselineDrift) console.log(`BASELINE-DRIFT ${p}  (production không khớp ref đã chọn)`);
  for (const p of baselineMissing) console.log(`BASELINE-MISSING ${p}  (file live không có trong ref đã chọn)`);
  changed.slice(0, 12).forEach((r) => console.log(`   ~ ${r.live}`));
} else {
  for (const p of mismatch) console.log(`SHA-MISMATCH ${p}`);
  for (const p of docDrift) console.log(`DOC-DRIFT    ${p}  (thường là hàng biên bản ghi sau deploy — diff và merge, đừng ghi đè mù)`);
}
for (const p of caseDiff) console.log(`case-diff    ${p}  (info)`);
console.log(`LOCAL-ONLY   ${localOnly.length} file (sẽ được upload — bình thường nếu là nội dung mới)`);
localOnly.slice(0, 12).forEach((p) => console.log('   + ' + p));
if (liveOnly.length) console.log(`\nALLOW-LIST hiện tại: ${[...ALLOW_LIVE_ONLY].join(', ')} (không tính là blocker)`);

const blocked = baselineRef
  ? liveOnly.length > 0 || baselineDrift.length > 0 || baselineMissing.length > 0
  : liveOnly.filter((p) => !ALLOW_LIVE_ONLY.has(p)).length > 0 || mismatch.length > 0;
if (blocked) {
  console.log('\n⛔ BLOCKED — production có file thiếu hoặc khác baseline; đồng bộ trước khi deploy.');
} else if (baselineRef) {
  console.log(`\n✅ AN TOÀN — mọi khác biệt local đều được đối chiếu với production baseline ${baselineRef}; không có live-only hoặc drift ngoài baseline.`);
} else if (docDrift.length) {
  console.log('\n✅ AN TOÀN về asset (không clobber) — nhưng có DOC-DRIFT: xem từng file, giữ nội dung mới của cả hai bên trước khi deploy.');
} else {
  console.log('\n✅ AN TOÀN — local chứa đủ mọi thứ live đang có; deploy sẽ không clobber gì.');
}
process.exit(blocked ? 2 : 0);

