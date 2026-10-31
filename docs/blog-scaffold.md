# Biên bản — Blog scaffold `/vi/blog/` + nâng `/vi/` thành content hub VI

> Thực hiện 2026-09-26 bởi DSH (owner chỉ đạo "làm hết, không giao AutoClaw").
> Plan nguồn: `docs/blog-content-plan.md`. Trạng thái: **CHƯA DEPLOY** — gộp
> deploy cùng bài viết đầu tiên, sau khi ảnh minh họa được chèn.

## Cấu trúc đã tạo

```
netlify-deploy/
├── vi/
│   ├── index.html                          — ĐÃ SỬA: thêm 2 section ("Học IELTS & TOEIC
│   │                                          với Dual Dictionary", "Lộ trình & kinh nghiệm
│   │                                          tự học" + link /vi/blog/) trước "Bắt đầu
│   │                                          trong 3 bước". Không đụng phần khác.
│   └── blog/
│       ├── blog.css                        — MỚI: css tự chứa (palette copy từ app
│       │                                      tokens, dark mode khớp, system font).
│       └── index.html                      — MỚI: hub blog (JSON-LD Blog + Breadcrumb,
│                                                  list bài đầu tiên, 2 card IELTS/TOEIC
│                                                  "sắp ra mắt", CTA /vi/).
├── sitemap.xml                             — ĐÃ SỬA: thêm 2 URL (/vi/blog/ + bài đầu).
├── sw.js                                   — ĐÃ SỬA: exclusion /vi/ ở đầu fetch handler.
└── vi/blog/ielts/cach-hoc-tu-vung-ielts-khong-quen/index.html — MỚI (2026-09-26, viết trước scaffold): bài flagship FSRS.
```

## Quyết định kỹ thuật

1. **sw.js — cách ly `/vi/` khỏi cache app** (dòng ~133): fetch handler cũ là
   cache-first cho mọi GET same-origin → trang blog/landing user ghé qua sẽ bị
   runtime-cache vào `mdx-dict-vN` (stale tới lần bump cache, ảnh blog ăn quota
   Cache Storage của app). Fix: `if (path === '/vi/' || path.startsWith('/vi/')) return;`
   — pass-through network, không cache. **Không bump `mdx-dict-vN`** (không
   precached file nào đổi). App shell không tham chiếu `/vi/` nên user app
   không bị ảnh hưởng. (sw.js comment cũ "vi/ landing is served fresh" giờ đúng.)
2. **Hub list bài đầu tiên ngay**: tránh hub trống khi deploy.
3. **Category index (/vi/blog/ielts/, /vi/blog/toeic/) CHƯA tạo** — sẽ tạo cùng
   bài pillar để không có URL rỗng bị index.
4. **Ảnh**: chưa chèn — ảnh chụp app thật làm bằng browser automation trên môi
   trường local; OG image + ảnh tác giả chờ (xem "Việc còn mở").

## Việc còn mở trước khi deploy

- [x] 3 ảnh screenshot app đã chèn vào bài (browser automation trên server
      local: Reader lưu câu, hàng đợi Review FSRS, tra song song) — WebP
      35–70KB tại `vi/blog/images/cach-hoc-tu-vung-ielts-khong-quen/`.
- [x] Ảnh OG 1200×630 `og-1200x630.png` (thẻ HTML tự thiết kế, khớp palette
      app, dấu tiếng Việt chuẩn) — og:image đã bật trong head bài viết.
- [ ] Thay avatar chữ "QA" trong author box bằng ảnh thật của owner
      (`/vi/blog/images/author-quoc-anh.webp` — export từ LinkedIn) — có thể
      làm sau deploy, không chặn.
- [ ] Deploy (hỏi owner trước — quy tắc khóa) + submit sitemap lại trong GSC.

## Đã kiểm tra (2026-09-26)

- Bài viết render chuẩn trên server local: breadcrumb, TOC, 3 figure WebP
  lazy-load OK, CTA box, author box, Nguồn tham khảo, footer.
- `sitemap.xml` valid (xmllint); 5 file chạm tới đều NFC sạch; `sw.js`
  syntax OK (node --check qua node portable /tmp).
- Hub `/vi/blog/` trả 200 trên server local.

## Cách dùng cho bài viết sau

1. Copy `vi/blog/ielts/cach-hoc-tu-vung-ielts-khong-quen/index.html` làm mẫu
   (đã chuẩn: JSON-LD Person/BlogPosting/Breadcrumb, TOC, CTA box, author box,
   Nguồn tham khảo, giọng văn theo plan mục 5.1).
2. Đổi: title/meta/canonical/OG/slug folder/JSON-LD headline+dates/từ khóa.
3. Thư mục ảnh: `/vi/blog/images/<slug>/`.
4. **Bắt buộc cùng brief**: thêm URL bài vào `sitemap.xml`, internal link về
   pillar (khi đã có), 2–4 nguồn uy tín, 1 CTA `/vi/`.
5. Giọng văn + nhân vật tác giả: plan mục 5.1 (Quốc Anh — Senior BD, TMA;
   tiếng Việt tự nhiên, không văn máy).
