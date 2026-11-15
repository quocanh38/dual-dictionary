# Dual Dict — Bàn giao sang Windows, 15/11/2026

Nhánh `windows-handoff-2026-11-15` chứa snapshot mã cục bộ `mdx-dict-v193-admin-experience` trên nền `main` tại `a6f84e43f0`. Bản production Netlify gần nhất được xác nhận ở trạng thái ready là [6af97aee17a10b147fbde559](https://app.netlify.com/sites/1af0641f-673e-48e9-9c86-1755d64b6558/deploys/6af97aee17a10b147fbde559). Chưa đối chiếu từng tệp giữa snapshot và deploy. Nhánh bàn giao chưa được merge vào main.

## Mở trên Windows

```powershell
git clone --branch windows-handoff-2026-11-15 https://github.com/quocanh38/dual-dictionary.git
cd dual-dictionary
npm ci
```

Nên dùng Node.js 22. Luồng admin dùng Netlify Functions và Netlify Blobs. Để thử đầy đủ, chạy qua môi trường Netlify được cấu hình cho dự án. Trang admin nằm tại `/admin/experience/`. Nhập khóa quản trị và khóa Gemini qua giao diện tương ứng. Giữ khóa ngoài Git và ghi chú bàn giao.

## Nghiệm thu Gemini thật còn mở

- **Tạo bài từ Sổ tay.** Chọn cụm từ mẫu, xem trước nội dung gửi, tạo đủ ba câu qua bộ kiểm tra cấu trúc, lưu bài và mở lại sau khi tải lại trang ở chế độ offline.
- **Lesson Studio.** Chọn bài mẫu, sửa yêu cầu, xác nhận bản xem trước, gửi Gemini, kiểm tra hai cụm bám nguồn và nội dung bài tập. Xác nhận bản nháp hợp lệ và vẫn chờ duyệt.

Hai luồng đã được thử giao diện với phản hồi giả lập. Lượt gọi thật trước đó gặp HTTP 429 trên `gemini-3.6-flash`, timeout 45 giây ở Sổ tay và HTTP 503 ở Studio trên `gemini-3.8-flash`, và HTTP 404 trên `gemini-2.5-flash-lite`. Kiểm tra model khả dụng và hạn mức của dự án trước khi chạy lại. Ghi kết quả từng bước, model và mã lỗi nếu có.

TOEIC đã thử trên Chromium production với Gemini thật, gồm Dừng, Thử lại, Hỏi tiếp, lưu và mở lại offline. Reader, AI Tutor, Viết, ghi chú Nói và bài công việc có phản hồi thật qua client của app. Bốn nguồn tạo bài Reader, Ôn tập, Viết và câu sai TOEIC đã trả đủ ba câu hợp lệ qua client.

## Admin và việc code tiếp

Admin cục bộ có Tổng quan, Góp ý và Bộ TOEIC. Kiểm thử Chromium mô phỏng điện thoại với dữ liệu mẫu đã chuyển được giữa ba mục và không tràn ngang. Dữ liệu sử dụng chỉ thu khi người học bật chia sẻ.

Sau nghiệm thu Gemini, ưu tiên báo cáo lượt học TOEIC từ mở đề đến hoàn thành và quay lại ôn câu sai. Dùng mã lượt làm bài ngẫu nhiên để nối các bước qua nhiều phiên và hiển thị cả số lượt lẫn tỷ lệ. Các luồng Reader và tiếng Anh công việc có thể triển khai tiếp sau đó.
