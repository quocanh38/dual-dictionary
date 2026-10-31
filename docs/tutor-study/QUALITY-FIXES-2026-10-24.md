# Sửa ba vấn đề chất lượng Tutor — 24/10/2026

Đã triển khai trong source local; chưa deploy và chưa gọi lại Meta thật với prompt mới.

1. **Nghĩa riêng, lý do riêng:** output mới dùng `meaningVi` và `selectionReason`; UI hiển thị đúng nhãn. Vault chỉ lấy `meaningVi` làm định nghĩa/đáp án ôn. Không còn fallback sang lý do chọn cụm, lịch ôn hay nhận xét AI. Cache trích cụm đổi phiên bản. Phiên cũ thiếu nghĩa vẫn đọc được, nhưng cần bắt đầu phiên mới để lấy nghĩa trước khi tạo thẻ; không sửa đoán các thẻ cũ đã lưu.
2. **Quote thống nhất:** app và trang đánh giá dùng cùng prompt phản hồi và validator. Quote không khớp vẫn bị từ chối. Verdict incorrect thiếu quote chuyển thành uncertain, xóa nhận xét sửa lỗi chưa có bằng chứng, hiển thị giải thích và nút yêu cầu đánh giá lại. Không có nút xác nhận lỗi, và handler cũng chặn việc ghi vào lịch sử lỗi đã xác nhận. Correct/uncertain hợp lệ vẫn được phép quote trống. Đây là xử lý thận trọng cho lỗi thiếu nội dung, không ép model bịa quote.
3. **Tình huống mới riêng:** Revise this answer giữ câu và ngữ cảnh cũ để chỉnh sửa offline. Try another situation mở consent riêng rồi yêu cầu AI tạo bối cảnh khác (học tập, công việc, cộng đồng, đời sống, du lịch). Payload chỉ gồm cụm, nghĩa, câu nguồn và các đề gần đây; không gửi câu trả lời cũ. Validator chặn đề giống hệt, yêu cầu viết lại câu cũ và contextId không đúng. Hủy hoặc output lỗi giữ lại feedback/câu trả lời trước. Kiểm tra contextId/prompt không phải bộ đánh giá ngữ nghĩa hoàn hảo; cần xác nhận model thật sau khi phát hành.

## Kiểm thử

PASS:

- `tools/tutor/quality-contract-check.mjs`: nghĩa bắt buộc; lưu đúng nghĩa; chặn reason của phiên cũ làm đáp án; downgrade thiếu quote, revalidate không đổi, chặn xác nhận; chọn bối cảnh khác và từ chối đề lặp/viết lại/sai context.
- `tools/tutor/reliability-check.mjs`: storage, hủy trước/sau lưu, kết quả về trễ, cache, resume pointer; output tình huống mới bị từ chối vẫn giữ feedback/câu trả lời.
- `tools/tutor/ai-flow-smoke.cjs`: Chrome + API giả lập; nhãn nghĩa/lý do, thiếu quote không hiện sửa lỗi chắc chắn, consent mới, hủy consent không mất dữ liệu, tạo bối cảnh công việc khác đề học tập, Vault lưu nghĩa; Writing/Speaking hồi quy; không lỗi JavaScript.
- `tools/tutor/offline-cache-smoke.cjs`: cache thật rồi ngắt mạng/reload ở 1280px và 390px.
- `tools/tutor/check.mjs`, `ai-client-check.mjs`, `sense-identity-check.mjs` và 13 kịch bản core regression đều qua.
- Kiểm tra cú pháp module và service worker qua. Cache chuẩn bị cho bản tới: `mdx-dict-v117`, có precache module prompt dùng chung.

Các kiểm thử mới dùng API giả lập, không phải kết quả đánh giá lại Meta thật. Không thay đổi kết quả/bằng chứng live đã ghi trước đó.
