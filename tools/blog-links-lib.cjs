/* Dict -> Blog backlinks (owner-approved 03/11, P0-1).
 * Closes the 2-way loop opened by blog dict-links boxes (commit 6d385e82):
 * blog posts link to dict pages; dict/detail/hub pages link back to the
 * blog posts that cite them. Data: data/blog-links.json
 * ({"/vi/tu/traffic/": [["/vi/blog/.../", "Title"], ...], max 3}).
 * Usage: const { blogLinksHtml } = require('./blog-links-lib.cjs');
 * Insert ${blogLinksHtml('/vi/tu/traffic/')} before </main> or inside
 * .cmp-links neighbours. Returns '' when no mapping. */
const fs = require('fs');
const path = require('path');

let CACHE = null;
function load() {
  if (CACHE === null) {
    try {
      CACHE = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'blog-links.json'), 'utf8'));
    } catch (e) { CACHE = {}; }
  }
  return CACHE;
}

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function blogLinksHtml(canonicalPath) {
  const list = load()[canonicalPath] || [];
  if (!list.length) return '';
  const items = list.slice(0, 3).map(([url, title]) =>
    `<a class="related-chip" href="${esc(url)}">📖 ${esc(title)} →</a>`).join('\n    ');
  return `<section class="related"><h2>Đọc thêm trên blog</h2><div class="related-list">\n    ${items}\n  </div></section>`;
}

module.exports = { blogLinksHtml };
