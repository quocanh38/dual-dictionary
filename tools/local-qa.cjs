#!/usr/bin/env node
/* local-qa.cjs — Windows stand-in for the Mac ui-check suite (link-check, sw-version-check).
 * For the dual-dictionary repo (PC layout: site root IS the repo root). No deps.
 *
 * Scope rule: SITE = files tracked by git semantics (respects .gitignore file/dir
 * names). Gitignored working files (e.g. _review-phrases.html) are scanned
 * separately and reported INFORMATIONALLY — they never fail the gate.
 *
 * Usage:
 *   node local-qa.cjs link-check        [--repo <path>]
 *   node local-qa.cjs sw-version-check  [--repo <path>] [--live-sha <ref>]
 *   node local-qa.cjs all
 * Exit: 0 = pass, 1 = fail.
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { cacheName, inspectShell } = require('./sw-shell-check.cjs');

const DEFAULT_REPO = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const mode = (args[0] || 'all').toLowerCase();
function argVal(name, d) { const i = args.indexOf(name); return (i >= 0 && args[i + 1]) ? args[i + 1] : d; }
const REPO = path.resolve(argVal('--repo', DEFAULT_REPO));
const LIVE_SHA = argVal('--live-sha', 'netlify/main'); // fetch netlify first; override when checking another production baseline
const SKIP_DIR = new Set(['.git', '.netlify', '.qa', 'node_modules']);

/* Simple .gitignore reader: exact file/dir names only (matches this repo's file). */
function loadGitignore(root) {
  const files = new Set(), dirs = new Set();
  let txt = '';
  try { txt = fs.readFileSync(path.join(root, '.gitignore'), 'utf8'); } catch { return { files, dirs }; }
  for (const line of txt.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#') || t.includes('*') || t.startsWith('/')) continue;
    if (t.endsWith('/')) dirs.add(t.slice(0, -1));
    else files.add(t);
  }
  return { files, dirs };
}

function listFiles(root, exts, gi) {
  const res = [];
  for (const p of fs.readdirSync(root, { recursive: true })) {
    const rel = p.split('\\').join('/');
    const segs = rel.split('/');
    if (segs.some((s) => SKIP_DIR.has(s) || gi.dirs.has(s))) continue;
    const base = segs[segs.length - 1];
    const isWorking = gi.files.has(base); // gitignored working file
    const full = path.join(root, rel);
    let st; try { st = fs.statSync(full); } catch { continue; }
    if (!st.isFile()) continue;
    if (exts && !exts.includes(path.extname(rel).toLowerCase())) continue;
    res.push({ rel, full, working: isWorking });
  }
  return res;
}

/* Resolve a URL found in HTML/precache against the repo root. Returns
 * {out:true} when the target escapes the site root, null when empty. */
function resolveLocal(v, fileDir) {
  let u = v.split('#')[0].split('?')[0];
  if (!u) return null;
  let dec = u; try { dec = decodeURIComponent(u); } catch { /* keep raw */ }
  let full;
  if (dec.startsWith('/')) full = path.join(REPO, dec.replace(/^\/+/, ''));
  else full = path.resolve(fileDir, dec);
  const relRoot = path.relative(REPO, full);
  if (relRoot.startsWith('..') || path.isAbsolute(relRoot)) return { out: true };
  return { full, rel: relRoot.split('\\').join('/') };
}

/* File exists (as file, as dir/index.html, or with .html appended).
 * Windows FS is case-insensitive — same behaviour as Netlify. */
function existsCandidate(full) {
  let st; try { st = fs.statSync(full); } catch { return false; }
  if (st.isFile()) return true;
  if (st.isDirectory() && fs.existsSync(path.join(full, 'index.html'))) return true;
  return fs.existsSync(full + '.html');
}

function scanSet(pages, label) {
  let checked = 0, external = 0, externalSelf = 0, skipped = 0;
  const dead = [];
  const REF = /(?:href|src)\s*=\s*(?:"([^"]*)"|'([^']*)')/gi;
  for (const pg of pages) {
    let html; try { html = fs.readFileSync(pg.full, 'utf8'); } catch { continue; }
    const dir = path.dirname(pg.full);
    let m; REF.lastIndex = 0;
    while ((m = REF.exec(html))) {
      const v = (m[1] !== undefined ? m[1] : m[2]).trim();
      if (!v || v[0] === '#' || /^(javascript:|mailto:|tel:|data:|blob:|about:)/i.test(v)) { skipped++; continue; }
      if (/^https?:\/\//i.test(v) || v.startsWith('//')) {
        external++;
        if (/dualdictionary\.netlify\.app/i.test(v)) externalSelf++;
        continue;
      }
      const r = resolveLocal(v, dir);
      if (!r) { skipped++; continue; }
      if (r.out) { external++; continue; }
      if (existsCandidate(r.full)) checked++;
      else dead.push('/' + pg.rel + ' -> ' + v);
    }
  }
  console.log(`[${label}] pages: ${pages.length} · internal links checked: ${checked} · external (not verified): ${external}${externalSelf ? ` (self-absolute: ${externalSelf})` : ''} · skipped: ${skipped}`);
  return { checked, external, dead };
}

function linkCheck() {
  const gi = loadGitignore(REPO);
  const all = listFiles(REPO, ['.html'], gi);
  const site = all.filter((p) => !p.working);
  const working = all.filter((p) => p.working);
  const siteRes = scanSet(site, 'SITE (git content)');
  let code = 0;
  if (siteRes.dead.length) {
    console.log(`DEAD LINKS (site): ${siteRes.dead.length}`);
    for (const d of siteRes.dead.slice(0, 60)) console.log('  ' + d);
    if (siteRes.dead.length > 60) console.log('  …');
    code = 1;
  } else {
    console.log('ALL LINKS OK (site)');
  }
  if (working.length) {
    const wRes = scanSet(working, 'WORKING FILES (gitignored — informational, does not fail)');
    if (wRes.dead.length) {
      console.log(`working-file dead links: ${wRes.dead.length} (sample: ${wRes.dead[0]} …) — these files are not part of the site content`);
    }
  }
  return code;
}

function gitRead(args) {
  const result = spawnSync('git', args, { cwd: REPO, maxBuffer: 64 * 1024 * 1024 });
  if (result.error || result.status !== 0) throw new Error(result.error?.message || result.stderr.toString().trim() || 'git failed');
  return result.stdout;
}
function baselineReader() {
  // Git names are case-sensitive, while Netlify/Windows resolve NOTICE.md to notice.md.
  const files = gitRead(['ls-tree', '-r', '--name-only', LIVE_SHA]).toString().trim().split('\n');
  const names = new Map(files.map(file => [file.toLowerCase(), file]));
  return file => {
    const actual = names.get(file.toLowerCase());
    if (!actual) throw new Error('Baseline asset missing: ' + file);
    return gitRead(['show', LIVE_SHA + ':' + actual]);
  };
}
function swVersionCheck() {
  try {
    const readBaseline = baselineReader();
    const sw = fs.readFileSync(path.join(REPO, 'sw.js'), 'utf8');
    const result = inspectShell(sw, readBaseline('sw.js').toString(),
      file => fs.readFileSync(path.join(REPO, file)), readBaseline);
    console.log('Shell vs ' + LIVE_SHA + ': ' + (result.changed.join(', ') || 'unchanged'));
    console.log('CACHE: ' + result.baselineCache + ' -> ' + result.cache + ' · precache assets: ' + result.assets);
    for (const error of result.errors) console.log('FAIL: ' + error);
    if (result.ok) console.log('SW CHECK OK — all precache content checked');
    return result.ok ? 0 : 1;
  } catch (error) { console.log('FAIL: SW check: ' + error.message); return 1; }
}
function expectedLiveCache() {
  return argVal('--expected-cache', '') || cacheName(baselineReader()('sw.js').toString());
}

const LIVE_BASE = argVal('--base-url', 'https://dualdictionary.netlify.app').replace(/\/$/, '');
const SMOKE_URLS = [
  ['/', /Dual Dictionary|Từ điển/i],
  ['/vi/', /Dual Dictionary|Từ điển/i],
  ['/vi/tu/cum-tu/', /air-force|Phổ biến|Biên soạn/i],
  ['/vi/tu/air-force/', /không quân|Phổ biến/i],
  ['/vi/tu/bear-market/', /thị trường gấu|thị trường giá giảm/i],
  ['/sw.js', null],
  ['/manifest.webmanifest', /name|start_url/],
];

async function fetchSmokeOnce(expectedCache) {
  const results = [];
  for (const [u, marker] of SMOKE_URLS) {
    try {
      const res = await fetch(LIVE_BASE + u, { redirect: 'follow', signal: AbortSignal.timeout(20000) });
      const txt = res.ok ? await res.text() : '';
      const hasMarker = u === '/sw.js' ? cacheName(txt) === expectedCache : marker.test(txt);
      results.push({ u, status: res.status, ok: res.ok && hasMarker });
    } catch (e) {
      results.push({ u, status: 'ERR ' + e.message, ok: false });
    }
  }
  return results;
}

async function liveSmoke(attempts) {
  const expectedCache = expectedLiveCache();
  console.log('Smoke target: ' + LIVE_BASE + ' · expected CACHE: ' + expectedCache);
  let pass = 0;
  for (let i = 1; i <= attempts; i++) {
    const rs = await fetchSmokeOnce(expectedCache);
    const bad = rs.filter((r) => !r.ok);
    if (!bad.length) {
      pass++;
      console.log(`smoke attempt ${i}: ${rs.length}/${rs.length} URL OK`);
    } else {
      console.log(`smoke attempt ${i}: FAIL — ${bad.map((b) => b.u + ' (' + b.status + ')').join(', ')}`);
    }
    if (i < attempts) await new Promise((r) => setTimeout(r, 2000));
  }
  console.log(pass === attempts ? `LIVE SMOKE OK — ${pass}/${attempts} attempts ALL PASS` : `LIVE SMOKE FAILED — only ${pass}/${attempts} attempts passed`);
  return pass === attempts ? 0 : 1;
}

async function main() {
let code = 0;
const modes = mode === 'all' ? ['link-check', 'link-check', 'sw-version-check', 'regression', 'live-smoke'] : [mode];
for (const m of modes) {
  console.log(`\n=== ${m} ===`);
  if (m === 'regression') {
    const result = spawnSync(process.execPath, [path.join(REPO, 'tools/review-regression.cjs')], { cwd: REPO, stdio: 'inherit' });
    code = Math.max(code, result.error || result.status !== 0 ? 1 : 0);
    continue;
  }
  if (m === 'live-smoke') { const n = Number(argVal('--attempts', '3')); code = Math.max(code, await liveSmoke(Number.isFinite(n) && n > 0 ? n : 3)); continue; }
  const r = m === 'link-check' ? linkCheck() : m === 'sw-version-check' ? swVersionCheck() : (console.log('unknown mode: ' + m), 1);
  code = Math.max(code, r);
}
console.log(code === 0 ? '\nALL PASS' : '\nQA FAILED');
process.exitCode = code;
}
main().catch(error => { console.error('QA FAILED:', error.message); process.exitCode = 1; });
