/* Site navbar (updated 07/11): 10 mục chính + 2 dropdown (Công cụ, Về chúng tôi).
 * Usage: const { navHtml } = require('./nav-partial.cjs');
 * Insert ${navHtml('tu'|'cum-tu'|'ielts'|...)} right after <body ...>.
 * Keep in sync with the hand-written copy in vi/index.html. */
function navHtml(active) {
  const on = (k) => (k === active ? ' aria-current="page" class="dd-nav-on"' : '');
  const dropOn = (keys) => (keys.includes(active) ? ' aria-current="page" class="dd-nav-on"' : '');
  return `<nav class="dd-nav" aria-label="Điều hướng chính"><div class="dd-nav-in">
<a class="dd-brand" href="/vi/">📖 Dual Dictionary</a>
<button type="button" class="dd-burger" aria-label="Mở menu" aria-expanded="false" onclick="var n=this.closest('.dd-nav');n.classList.toggle('open');this.setAttribute('aria-expanded',n.classList.contains('open'))">☰</button>
<div class="dd-links">
<a href="/vi/tu/"${on('tu')}>Từ điển</a>
<a href="/vi/chu-de/"${on('chu-de')}>Chủ đề</a>
<a href="/vi/phan-biet/"${on('phan-biet')}>Phân biệt</a>
<a href="/vi/dong-nghia/"${on('dong-nghia')}>Đồng nghĩa</a>
<a href="/vi/phat-am/"${on('phat-am')}>Phát âm</a>
<a href="/vi/loi-sai/"${on('loi-sai')}>Lỗi sai</a>
<a href="/vi/gioi-tu/"${on('gioi-tu')}>Giới từ</a>
<a href="/vi/cum-di-voi/"${on('cum-di-voi')}>Cụm đi với</a>
<a href="/vi/blog/"${on('blog')}>Blog</a>
<div class="dd-drop"><button type="button" class="dd-drop-btn"${dropOn(['test','shadowing','lo-trinh','trinh-do','luyen-thi','toeic','ielts','cambridge','ngu-phap'])}>Công cụ ▾</button>
<div class="dd-drop-menu">
<a href="/vi/test-trinh-do/"${on('test')}>📊 Test trình độ</a>
<a href="/vi/luyen-shadowing/"${on('shadowing')}>🎤 Luyện phát âm</a>
<a href="/vi/lo-trinh/"${on('lo-trinh')}>🗺️ Lộ trình 30 ngày</a>
<a href="/vi/trinh-do/"${on('trinh-do')}>📶 Từ theo trình độ</a>
<a href="/vi/luyen-thi/"${on('luyen-thi')}>📝 Luyện thi</a>
<a href="/vi/tu/ielts/"${on('ielts')}>IELTS Core</a>
<a href="/vi/tu/toeic/"${on('toeic')}>TOEIC Business</a>
<a href="/vi/cambridge/"${on('cambridge')}>Cambridge Papers</a>
<a href="/vi/ngu-phap/"${on('ngu-phap')}>Ngữ pháp</a>
</div></div>
<div class="dd-drop"><button type="button" class="dd-drop-btn"${dropOn(['gioi-thieu','tac-gia','cap-nhat'])}>Về chúng tôi ▾</button>
<div class="dd-drop-menu">
<a href="/vi/gioi-thieu/"${on('gioi-thieu')}>Giới thiệu</a>
<a href="/vi/tac-gia/"${on('tac-gia')}>✍️ Tác giả</a>
<a href="/vi/chinh-sach-noi-dung/">📜 Chính sách nội dung</a>
<a href="/vi/cap-nhat/"${on('cap-nhat')}>🗞️ Nhật ký cập nhật</a>
</div></div>
</div>
<form class="dd-search" action="/" method="get" role="search"><input name="q" type="search" placeholder="Tra từ…" aria-label="Tra từ trong app" autocomplete="off"><button type="submit" aria-label="Tìm">🔍</button></form>
</div></nav>
<style>.dd-nav{position:sticky;top:0;z-index:50;background:#0f766e;color:#fff;box-shadow:0 2px 8px rgba(0,0,0,.15)}.dd-nav-in{max-width:860px;margin:0 auto;display:flex;align-items:center;gap:10px;padding:8px 16px;flex-wrap:wrap}.dd-brand{color:#fff;font-weight:800;text-decoration:none;white-space:nowrap}.dd-links{display:flex;gap:2px;flex-wrap:wrap;flex:1;align-items:center}.dd-links a{color:#e6fffa;text-decoration:none;font-size:.85rem;font-weight:600;padding:6px 9px;border-radius:8px;white-space:nowrap}.dd-links a:hover{background:rgba(255,255,255,.15)}.dd-nav-on{background:rgba(255,255,255,.22)!important}.dd-drop{position:relative}.dd-drop-btn{border:0;background:transparent;color:#e6fffa;font-size:.85rem;font-weight:600;padding:6px 9px;border-radius:8px;cursor:pointer;white-space:nowrap}.dd-drop-btn:hover{background:rgba(255,255,255,.15)}.dd-drop-menu{display:none;position:absolute;top:100%;left:0;min-width:210px;background:#0d5c55;border-radius:10px;padding:6px;box-shadow:0 8px 24px rgba(0,0,0,.25);z-index:60}.dd-drop-menu a{display:block;padding:8px 10px}.dd-drop:hover .dd-drop-menu,.dd-drop:focus-within .dd-drop-menu{display:block}.dd-search{display:flex;gap:4px;margin-left:auto}.dd-search input{border:0;border-radius:8px;padding:6px 10px;font-size:.85rem;width:130px}.dd-search button{border:0;border-radius:8px;background:#115e59;color:#fff;padding:6px 10px;cursor:pointer}.dd-burger{display:none;border:1px solid rgba(255,255,255,.4);background:transparent;color:#fff;border-radius:8px;padding:4px 10px;font-size:1rem;cursor:pointer}@media(max-width:720px){.dd-burger{display:block}.dd-links{display:none;width:100%;flex-direction:column;align-items:stretch}.dd-nav.open .dd-links{display:flex}.dd-drop-menu{position:static;box-shadow:none}.dd-search{margin-left:0;width:100%}.dd-search input{flex:1;width:auto}}</style>`;
}

module.exports = { navHtml };
