# ANTI-JUNK — Quy tắc chống rác khi tạo trang mới (07/11/2026)

Mọi builder/data mới PHẢI pass 5 cổng này trước khi deploy. Vi phạm = revert.

## 1. Từ vựng đầu vào: không tên riêng, không dạng chia, không từ cụt

- CẤM slug: tên người/vùng/thần thoại (adam, anna, david, jesus, mars…), từ lóng 1 âm (bo, blah, beep…), từ cụt (al, dan, da, cos…).
- Dạng chia (agreed, acting, arrested…) chỉ build khi KHÔNG có từ gốc trong manifest; đã có gốc thì canonical về gốc.
- Mọi danh sách từ mới phải chạy `baseOf()` (xem `tools/regenerate-synonyms-v2.cjs`) + đối chiếu `JUNK` set trước khi ghi JSON.
- Nơi chặn: `REMOVE_WORDS` trong `tools/build-word-pages.cjs` — thêm từ rác vào đây, builder tự xóa dir + manifest + sitemap.

## 2. Cấm fallback bịa nội dung

- CẤM pattern: thiếu synonym thì gán `help/support/aid`; thiếu cặp phát âm thì gán `a vs the (luyện thêm)`; thiếu ví dụ thì gán `We need to consider…`.
- Thiếu dữ liệu thật → một trong hai: (a) bỏ trang khỏi sitemap + `noindex`, hoặc (b) hiện câu trung thực ("chưa có dữ liệu — luyện phần khác"). Không bao giờ bịa cho đủ số lượng.
- `needs_review: true` chỉ là cờ chờ duyệt, KHÔNG phải giấy phép publish nội dung sai.

## 3. Nuance/ví dụ phải riêng, không template

- CẤM nuance dùng chung 1 câu cho hàng trăm trang ("dùng trong ngữ cảnh trung tính… trang trọng hơn…").
- Mỗi nuance phải chứa nghĩa Việt cụ thể của đúng từ đó (lấy từ `mtd-sense` trang từ).
- Ví dụ ưu tiên: (1) `mtd-ex` trong trang từ, (2) `Mẫu câu giá trị` trong trang từ. Cấm ví dụ cụt <3 từ. Đếm được: `template nuance = 0`, `fallback = 0` trước mỗi deploy.

## 4. Liên kết chéo phải tồn tại

- Mọi slug trong data JSON (synonym, related, minimal pair, topic list…) PHẢI có trong `docs/wordpages-manifest.json`, nếu không builder render link chết.
- Sau mỗi lần xóa từ: grep toàn bộ `data/*.json` tìm tham chiếu tới slug đã xóa, thay bằng từ thật gần nghĩa (vd myth→legend, holy→sacred, name→word).
- Cổng bắt buộc: `node tools/local-qa.cjs link-check` phải ALL PASS mới được deploy.

## 5. Số lượng không thắng chất lượng

- Mọi script `expand-*.cjs` / `make-*-data.cjs` phải in 3 số: tổng entries, số fallback, số synthetic. Fallback/synthetic > 0 → không ghi file, không build.
- Trang mỏng nhưng đúng intent 1 câu hỏi (gioi-tu, loi-sai, cum-di-voi ~100 từ) được giữ. Trang dài nhưng nội dung copy-paste/template (217 minimal-pairs synthetic) là rác — phải sửa.
- Quy trình rebuild chuẩn + QA xem HANDOFF mới nhất (đầu file HANDOFF-*.md ở root project).

## 6. Chống ăn thịt từ khóa (08/11/2026)

- Builder đọc đúng field data: đối chiếu key JSON trước khi viết template (`word`≠`name`, `heading`≠`title`). Sai 1 field = hàng chục trang trùng title "undefined" (đã dính 26 trang 08/11).
- Trước deploy: quét trùng `<title>` + `<h1>` + `<meta description>` toàn site — dup groups phải = 0.
- Cùng slug khác khu vực (vi/tu/X vs vi/phat-am/X vs vi/dong-nghia/X) KHÔNG canonical chéo — intent khác nhau (nghĩa vs phát âm vs đồng nghĩa), mỗi trang 1 intent riêng.
- Chỉ canonical khi cùng nội dung: dạng chia → từ gốc (accepting→accept, went→go), mỗi lemma ≤3 variants, variant KHÔNG vào sitemap.
- Cặp nào trùng title/desc thật thì gộp trang hoặc đổi intent, không để 2 URLs cùng target 1 query.
