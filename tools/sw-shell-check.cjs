const crypto = require('crypto');
function cacheName(sw) {
  const m = /const CACHE\s*=\s*'([^']+)'/.exec(sw);
  if (!m) throw new Error('Cannot parse SW CACHE');
  return m[1];
}
function precachePaths(sw) {
  const m = /const ASSETS\s*=\s*\[([\s\S]*?)\]\s*;/.exec(sw);
  if (!m) throw new Error('Cannot parse SW ASSETS');
  const lines = m[1].split('\n').filter(l => !l.trim().startsWith('//')).join('\n');
  const paths = (lines.match(/'([^']+)'/g) || []).map(s => s.slice(1, -1).replace(/^\.\//, '') || 'index.html');
  if (!paths.length) throw new Error('SW ASSETS is empty');
  return [...new Set(['sw.js', ...paths])];
}
function digest(file, bytes) {
  // Ignore platform newline differences only for textual assets.
  const content = /\.(?:html|css|js|json|txt|md|webmanifest)$/i.test(file)
    ? bytes.toString('utf8').replace(/\r\n/g, '\n') : bytes;
  return crypto.createHash('sha256').update(content).digest('hex');
}
function inspectShell(currentSw, baselineSw, readCurrent, readBaseline) {
  const cache = cacheName(currentSw), baselineCache = cacheName(baselineSw);
  const currentPaths = precachePaths(currentSw), baselinePaths = precachePaths(baselineSw);
  const changed = [], missing = [];
  for (const file of new Set([...currentPaths, ...baselinePaths])) {
    let current, baseline;
    if (currentPaths.includes(file)) {
      try { current = readCurrent(file); } catch { missing.push(file); continue; }
    }
    if (baselinePaths.includes(file)) baseline = readBaseline(file);
    if (!current || !baseline || digest(file, current) !== digest(file, baseline)) changed.push(file);
  }
  const errors = missing.map(file => 'Missing precache asset: ' + file);
  if (changed.length && cache === baselineCache) errors.push('Shell changed without a CACHE bump');
  const a = /^(.*-v)(\d+)$/.exec(cache), b = /^(.*-v)(\d+)$/.exec(baselineCache);
  if (changed.length && a && b && a[1] === b[1] && Number(a[2]) <= Number(b[2])) errors.push('CACHE version must increase');
  return { cache, baselineCache, assets: currentPaths.length - 1, changed, missing, errors, ok: errors.length === 0 };
}
module.exports = { cacheName, precachePaths, inspectShell };
