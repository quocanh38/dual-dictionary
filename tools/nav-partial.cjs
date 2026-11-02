/* Site navbar (owner-approved 01/11): one sticky nav for all /vi/* pages.
 * Usage: const { navHtml } = require('./nav-partial.cjs');
 * Insert ${navHtml('tu'|'cum-tu'|'ielts'|...)} right after <body ...>.
 * Keep in sync with the hand-written copy in vi/index.html. */
function navHtml(active) {
  const on = (k) => (k === active ? ' aria-current="page" class="dd-nav-on"' : '');
  return `<nav class="dd-nav" aria-label="Điều hướng chính"><div class="dd-nav-in">
<a class="dd-brand" href="/vi/">📖 Dual Dictionary</a>
<button type="button" class="dd-burger" aria-label="Mở menu" aria-expanded="false" onclick="var n=this.closest('.dd-nav');n.classList.toggle('open');this.setAttribute('aria-expanded',n.classList.contains('open'))">☰</button>
<div class="dd-links">
<a href="/vi/tu/"${on('tu')}>Từ điển</a>
<a href="/vi/tu/cum-tu/"${on('cum-tu')}>Cụm từ</a>
<a href="/vi/tu/ielts/"${on('ielts')}>IELTS</a>
<a href="/vi/tu/toeic/"${on('toeic')}>TOEIC</a>
<a href="/vi/chu-de/"${on('chu-de')}>Chủ đề AWL</a>
<a href="/vi/phan-biet/"${on('phan-biet')}>Phân biệt</a>
<a href="/vi/loi-sai/"${on('loi-sai')}>Lỗi sai</a>
<a href="/vi/gioi-tu/"${on('gioi-tu')}>Giới từ</a>
<a href="/vi/cambridge/"${on('cambridge')}>Cambridge</a>
<a href="/vi/blog/"${on('blog')}>Blog</a>
</div>
<form class="dd-search" action="/" method="get" role="search"><input name="q" type="search" placeholder="Tra từ…" aria-label="Tra từ trong app" autocomplete="off"><button type="submit" aria-label="Tìm">🔍</button></form>
</div></nav>
<style>.dd-nav{position:sticky;top:0;z-index:50;background:#0f766e;color:#fff;box-shadow:0 2px 8px rgba(0,0,0,.15)}.dd-nav-in{max-width:860px;margin:0 auto;display:flex;align-items:center;gap:10px;padding:8px 16px;flex-wrap:wrap}.dd-brand{color:#fff;font-weight:800;text-decoration:none;white-space:nowrap}.dd-links{display:flex;gap:2px;flex-wrap:wrap;flex:1}.dd-links a{color:#e6fffa;text-decoration:none;font-size:.85rem;font-weight:600;padding:6px 9px;border-radius:8px;white-space:nowrap}.dd-links a:hover{background:rgba(255,255,255,.15)}.dd-nav-on{background:rgba(255,255,255,.22)!important}.dd-search{display:flex;gap:4px;margin-left:auto}.dd-search input{border:0;border-radius:8px;padding:6px 10px;font-size:.85rem;width:130px}.dd-search button{border:0;border-radius:8px;background:#115e59;color:#fff;padding:6px 10px;cursor:pointer}.dd-burger{display:none;border:1px solid rgba(255,255,255,.4);background:transparent;color:#fff;border-radius:8px;padding:4px 10px;font-size:1rem;cursor:pointer}@media(max-width:720px){.dd-burger{display:block}.dd-links{display:none;width:100%;flex-direction:column}.dd-nav.open .dd-links{display:flex}.dd-search{margin-left:0;width:100%}.dd-search input{flex:1;width:auto}}</style>`;
}

module.exports = { navHtml };
