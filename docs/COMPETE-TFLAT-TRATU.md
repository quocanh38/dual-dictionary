# Soi TFlat & Tratu — format thắng copy cho Dual Dictionary

Ngày soi: 2026-11-03. Phạm vi: chỉ trang công khai, không đăng nhập. Trích dẫn ngắn ≤25 từ để minh họa.

## 1. TFlat — app-only, KHÔNG có web tra từ công khai

### URL đã xem (đều không phải trang từ mẫu vì không tồn tại)
- `https://play.google.com/store/apps/details?id=com.kala.tudien.anhviet` — listing chính "TFlat: Learn Translate English" (100K+ downloads trên listing quốc tế; bản VN ~5 triệu user theo phoneky).
- `https://fptshop.com.vn/tin-tuc/giai-tri/tu-dien-tflat-182022` — bài hướng dẫn cài (nguồn二手, mô tả tính năng).
- `https://tflat.vn` — curl trực tiếp 2026-11-03 **không phản hồi** (timeout). Web search `"tflat.vn"` không trả về trang tra từ nào, chỉ App Store/Play + bài review.

### Title/meta mẫu
- Không có `<title>`/`meta description` theo từng từ (vì không có URL từng từ). Listing Play: title "TFlat: Learn Translate English", mô tả liệt kê tính năng.

### Cấu trúc "trang từ" (suy từ app + bài review, không phải HTML web)
1. Ô tra từ Anh–Việt / Việt–Anh tức thì + phiên âm + nút phát âm US/UK.
2. Nghĩa gọn theo từng nghĩa + ví dụ (ít, thiên về tra nhanh).
3. Dịch đoạn văn / dịch ảnh / giọng nói.
4. Lưu từ yêu thích, danh sách học riêng, nhắc ôn, game từ vựng, kiểm tra chính tả.
5. Bubble/cửa sổ tra nhanh nổi trên app khác.

### Điểm mạnh (giữ để học)
- Brand + thói quen: người Việt học IELTS/TOEIC cài sẵn, mở là tra.
- Offline-first thực sự: kho ~400.000 từ Anh–Việt (theo AppFollow) tra không mạng.
- IPA + audio US/UK chuẩn, tra nhanh 1 chạm, nhắc học → retention cao.

### Lỗ hổng Dual Dictionary khai thác được
1. **Zero SEO web**: không có URL từng từ → Google không index được. Dual giữ 12.500 trang tĩnh + sitemap + schema là ăn trọn traffic "nghĩa của từ X / X là gì / cách dùng X".
2. **Quảng cáo + paywall VIP**: bản free "mở lên thấy quảng cáo, không mở được tính năng VIP" (vn-z.vn). Dual: web gọn, không ads nặng, offline-first.
3. **Không có desktop/web chính thức**: muốn dùng trên laptop phải cài giả lập BlueStacks (FPT Shop). Dual: PWA + Service Worker chạy thẳng trên trình duyệt.

## 2. Tratu (tratu.soha.vn) — web MediaWiki cũ, nội dung sâu nhưng SEO + UX yếu

### URL đã xem (đọc trực tiếp 2026-11-03)
- `http://tratu.soha.vn/` — trang chủ "Tra từ: Hệ thống từ điển chuyên ngành mở"
- `http://tratu.soha.vn/dict/en_vn/Affect` — mẫu động từ đa nghĩa
- `http://tratu.soha.vn/dict/en_vn/Effect` — mẫu danh từ + cụm từ
- `http://tratu.soha.vn/dict/en_vn/Traffic` — mẫu siêu dài chuyên ngành
- `http://tratu.soha.vn/dict/en_vn/After-effect` — mẫu ngắn

### Title/meta mẫu (copy nguyên)
- Title mọi trang từ: `Nghĩa của từ Affect - Từ điển Anh - Việt` (pattern `Nghĩa của từ {X} - Từ điển Anh - Việt`).
- Meta description **dùng chung mọi trang**: "Soha tra từ - Hệ thống tra cứu từ điển chuyên ngành Anh - Việt." → trùng lặp 100%, lãng phí CTR.
- Meta keywords nhồi từ liên quan: `Affect,A,Accent,Act,Act upon,...` (kỹ thuật SEO 2005, nay vô giá trị).

### Cấu trúc trang từ (H2/H3/list thực tế)
- H1 ẩn/tên từ + dòng phiên âm kiểu `/ə'fekt/` — nhiều trang ghi "(Phiên âm này đang chờ bạn hoàn thiện)".
- `## Thông dụng` → `### Danh từ / Ngoại động từ / Nội động từ` → `##### nghĩa tiếng Việt` + list ví dụ song ngữ dạng `: the frequent changes... / : thời tiết thay đổi luôn...`.
- `### Cấu trúc từ`: cụm cố định (vd "to come into effect — có hiệu lực thi hành") kèm câu mẫu.
- `### hình thái từ`: `V_ed: affected / V_ing: affecting`.
- `## Chuyên ngành`: Xây dựng / Cơ–Điện tử / Kỹ thuật chung / Y học / Toán & tin... mỗi ngành 1–n nghĩa, có dòng "Giải thích VN".
- `## Các từ liên quan` → `### Từ đồng nghĩa` (list dài hàng chục từ, vd Affect liệt kê "act on, alter, change, disturb...").
- Cuối trang: nguồn "Lấy từ « url »", bộ từ điển, tác giả (Admin/Khách), ô "Tìm thêm với Google.com", box "Mời bạn đăng nhập để đăng câu hỏi".
- Trang chủ liệt kê số lượng: "Anh - Việt (402.688 từ)...", 12+ bộ chuyên ngành (Kỹ thuật, Y Sinh, Kinh tế, Cơ khí, Chứng khoán, Giao thông...), khung MediaWiki + banner "NHÀ TÀI TRỢ".

### Câu hỏi lặp lại (FAQ/PAA) — quan sát
- **Không có block FAQ/PAA có cấu trúc** trên bất kỳ trang nào đã xem. Mục hỏi đáp là box đăng nhập VietID ("Mời bạn đăng nhập để đăng câu hỏi và trả lời") — rào cản, nội dung do user đóng góp thưa thớt.
- Query người dùng thực tế (suy từ nội dung trang): "affect vs effect khác nhau?", "effect đi với giới từ gì?", "traffic có đếm được không?" — Tratu **không trả lời trực tiếp**, chỉ liệt kê nghĩa.

### Điểm mạnh (giữ để học)
- Depth chuyên ngành khủng: trang Traffic có hàng trăm collocation kỹ thuật (traffic control, traffic flow...), ăn traffic long-tail kỹ thuật.
- Pattern nội dung nhất quán dễ crawl: Thông dụng → Cấu trúc từ → hình thái từ → Chuyên ngành → đồng nghĩa.
- Ví dụ song ngữ EN–VI cho từng nghĩa (vd "cause and effect / nguyên nhân và kết quả").

### Lỗ hổng Dual Dictionary khai thác được
1. **SEO meta chết**: description trùng lặp + title rập khuôn → Dual viết title/meta riêng từng từ (`{word}: nghĩa, IPA, câu mẫu công việc VN`) + FAQPage/ItemList là vượt ngay.
2. **Không IPA chuẩn + không audio**: chỉ text `/ə'fekt/` hoặc thiếu hẳn → Dual có IPA Mỹ/Anh + audio offline là điểm phân biệt 1 nhìn là thấy.
3. **Nhiễu chuyên ngành, thiếu TL;DR + bảng so sánh**: trang Effect/Traffic flooded hàng trăm thuật ngữ hiếm; người IELTS/TOEIC cần "1 dòng chốt + bảng affect vs effect + 3 câu mẫu công việc VN" — Tratu không có. Dual giữ format: TL;DR 1 dòng → nghĩa + câu mẫu công việc VN → bảng so sánh cặp nhầm → FAQ 3 câu.

## 3. Format thắng Dual Dictionary nên copy (kết luận hành động)

1. Giữ skeleton Tratu (Thông dụng → Cấu trúc từ → hình thái từ → đồng nghĩa) vì Google quen, nhưng **đảo ngược thứ tự hiển thị**: TL;DR 1 dòng + bảng so sánh cặp nhầm lên đầu, chuyên ngành sâu cho xuống dưới/gom gọn.
2. Copy thói quen TFlat: ô tra 1 chạm + IPA + audio US/UK + nút lưu từ — nhưng làm trên web PWA offline-first, không ads, không cần giả lập.
3. Mỗi trang chốt bằng FAQ 3 câu đúng query PAA ("X khác Y thế nào? / X dùng trong email công việc ra sao? / lỗi sai phổ biến?") + schema FAQPage — thứ cả hai đối thủ đều thiếu.
