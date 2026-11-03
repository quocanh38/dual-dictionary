# HANDOFF — Dual Dictionary SEO (03/11/2026, cuối ngày)

## Trạng thái cuối
- Live: https://dualdictionary.netlify.app — deploy `6ae9b0ca`
- Commit: `0e89137b34` trên `origin/main` — working tree sạch, GitHub đồng bộ
- Quy mô: ~12.500 trang, 15.605 URL sitemap, link-check ALL PASS (0 dead)
- Sitemap: 25 entries (11 Tier 1) — local = live 100%

## Đã làm (đợt 01-03/11)
1. **Mở rộng 5 ý tưởng cũ**: compare 30→60 cặp, loi-sai dọn 40→30 thật, 10 AWL hub, FAQ 200→500, Cam 4→8 (dừng, đủ)
2. **5 ý tưởng mới**: TL;DR+Speakable 80 trang, 15 hub IELTS topic, 65→100 prep, sitemap-maint (lastmod thật + tier), GSC checklist
3. **4 nhánh mới**: 553 synonyms, 300 phát âm, 70 collocations, 12 hub TOEIC tình huống
4. **3 nhánh cuối**: 18 exam guides, 10 hub ngữ pháp, compare cụm 60 cặp
5. **Kỹ thuật**: navbar dùng chung, 404 tùy chỉnh + _redirects, twin .html canonical fix, anti-cannibalization links, topic backlinks, hub lazy-load (385KB→81KB), CSS min + preload, on-page audit (title/meta/OG/Twitter/schema)

## Quy trình rebuild chuẩn (chạy theo thứ tự)
```
node tools/build-word-pages.cjs && node tools/build-phrase-pages.cjs
node tools/build-collection-pages.cjs && node tools/build-compare-pages.cjs
node tools/build-mistake-pages.cjs && node tools/build-cambridge-pages.cjs
node tools/build-awl-pages.cjs && node tools/build-topic-pages.cjs
node tools/build-toeic-pages.cjs && node tools/build-prep-pages.cjs
node tools/build-collocation-pages.cjs && node tools/build-synonym-pages.cjs
node tools/build-pronunciation-pages.cjs && node tools/build-grammar-pages.cjs
node tools/build-exam-guides.cjs
node tools/sitemap-maint.cjs && node tools/local-qa.cjs link-check
```
Deploy: `netlify deploy --prod --dir=.` (~15-20 phút) → `git push origin main`

## Việc còn lại (2 task chưa làm, không cần GSC)
1. **Internal link từ blog**: bài blog nhắc từ nào → link về trang từ/hub đó
2. **FAQPage cho prep/collocation**: thêm JSON-LD FAQ (compare/mistake/synonym đã có mẫu)

## Chờ GSC (2-4 tuần, user tự làm)
- GSC đã verify (Domain/DNS), sitemap đã submit
- Request Indexing 4 hub mới: /vi/dong-nghia/ /vi/phat-am/ /vi/luyen-thi/ /vi/ngu-phap/
- Theo dõi: Coverage Tier 1 index %, Queries impression cao CTR<2% → sửa title/meta
- Chi tiết: docs/GSC-CHECKLIST.md

## Lưu ý cho chat tiếp theo
- 3 trang tay ngoài builder: vi/tu/evaluate| corresponden sustain|economical/ (comment HAND-WRITTEN, đừng wipe)
- data/*.json là input tay — không sửa freq-en.json / awl.json để ép build
- Dừng mở nhánh mới — site đủ phủ intent, chỉ giàu hóa theo traffic GSC
