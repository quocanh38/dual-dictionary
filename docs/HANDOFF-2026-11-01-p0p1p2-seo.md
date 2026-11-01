# HANDOFF — Dual Dictionary P0/P1/P2 + SEO (01/11/2026)

## Trạng thái cuối
- Live: https://dualdictionary.netlify.app — deploy `6ae74dbc86ee1618d11c6fc3`
- Commit: `688e6563c` trên `origin/main` — working tree sạch
- Quy mô: ~11.250 trang (6.936 từ + 4.186 cụm + 30 so sánh + 40 lỗi sai + 4 Cam + 3 collection + hub)
- Link-check: ALL PASS (0 dead). review-regression crash sẵn từ trước (không đụng).

## Đã làm (theo thứ tự)
1. **P0**: sense-priority (evidence lên đầu), meta duy nhất, breadcrumb Cụm từ, hub toggle ẩn nhiễu
2. **P1**: tag IELTS/TOEIC/CEFR-est + lọc, hub-lite 1.3MB→400KB, BrE + nút Nghe, 40 ví dụ thi seed
3. **P1 audio**: Piper amy+alba, 2.277 từ × 2 giọng (4.534 file, 40MB), player preload=none
4. **Seed 200 → 500**: 322 từ ×2 câu + 368 cụm ×1 câu viết tay (677 trang Ví dụ thi)
5. **Autocomplete** 2 hub (prefix + fuzzy, phím tắt đầy đủ)
6. **2 deck luyện**: IELTS Core (2.241 từ) + TOEIC mix (44 từ + 161 cụm, drill prep-gap + near-pick)
7. **SEO**: DefinedTerm about+example, sitemap tag, 3 collection, 30 comparison + FAQ, 40 lỗi sai + FAQ, FAQ 200 từ top, topic links AWL, 4 trang Cam vocab

## File dữ liệu mới (tay, giữ kỹ)
- data/sense-priority.json, exam-tags.json (tool sinh), exam-examples.json (690 mục tay)
- data/comparisons.json (30), word-faq.json (tool sinh), cambridge.json (4 đề)
- tools/build-{compare,mistake,cambridge,collection}-pages.cjs, bre-ipa.cjs, exam-tags.cjs, render-audio.py

## Builder chạy khi sửa nội dung
```
node tools/build-word-pages.cjs && node tools/build-phrase-pages.cjs
node tools/build-collection-pages.cjs && node tools/build-compare-pages.cjs
node tools/build-mistake-pages.cjs && node tools/build-cambridge-pages.cjs
node tools/local-qa.cjs link-check
```
Audio chỉ render 1 lần (tools/render-audio.py, voices ở ~/piper-voices ngoài repo).

## Deploy
- Netlify CLI đã login (Anh Nguyen), site link sẵn (.netlify/state.json chưa commit)
- `node <toolchain>/netlify-cli/bin/run.js deploy --prod --dir=.` — ~15-20 phút/đợt
- Auto-deploy GitHub→Netlify KHÔNG chạy (đã xác nhận) — deploy tay

## Việc tiếp theo (2-4 tuần nữa, theo GSC)
- Xem trang nào được index, query nào impression cao mà CTR thấp → sửa title/meta
- Mở rộng seed lên top 1000 nếu collection IELTS/TOEIC lên rank
- Không code thêm cho đến khi có số liệu
