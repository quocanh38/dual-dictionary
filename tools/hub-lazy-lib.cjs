/* Hub lazy-load (07/11): hub >300 items chỉ render 300 <li> đầu,
 * còn lại trong <template>, nút "Xem thêm". Google vẫn thấy đủ items
 * (template nằm trong HTML), mobile tải nhanh hơn ~70%.
 * Usage: const { hubListHtml } = require('./hub-lazy-lib.cjs');
 * hubListHtml(rows, {per:300, cols:2}) — rows: mảng chuỗi <li>. */
function hubListHtml(rows, opts) {
  const per = (opts && opts.per) || 300;
  const cols = (opts && opts.cols) || 2;
  const style = `columns:${cols};gap:20px;padding-left:18px;line-height:2`;
  if (rows.length <= per) {
    return `<ul class="hub-list" style="${style}">\n${rows.join('\n')}\n  </ul>`;
  }
  const head = rows.slice(0, per).join('\n');
  const rest = rows.slice(per).join('\n');
  const more = rows.length - per;
  return `<ul class="hub-list" style="${style}">\n${head}\n</ul>
<template id="hub-rest">${rest}</template>
<p><button type="button" id="hub-more" style="padding:10px 18px;border:1px solid var(--line);border-radius:8px;background:var(--soft);font-weight:700;cursor:pointer">Xem thêm ${more.toLocaleString('vi-VN')} mục ↓</button></p>
<script>(function(){var b=document.getElementById('hub-more');if(!b)return;b.addEventListener('click',function(){var t=document.getElementById('hub-rest');var u=t.previousElementSibling;while(u&&u.tagName!=='UL')u=u.previousElementSibling;u.insertAdjacentHTML('beforeend',t.innerHTML);b.remove();var c=document.getElementById('hub-count');if(c)c.textContent='Hiển thị '+u.querySelectorAll('li').length;});})();</script>`;
}
module.exports = { hubListHtml };
