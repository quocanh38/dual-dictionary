# Mô phỏng trải nghiệm người học — v143

Đây là mô phỏng bằng Playwright + Chrome trên production, không phải người dùng thật, giáo viên độc lập hoặc điện thoại thật. Profile thử tách biệt, không cấu hình API key, không dùng dữ liệu học cá nhân.

## Phiên người học mới

Hai kích thước 1280px và 390px: vào Reader từ app → chọn Start a free offline lesson → đọc → chọn cụm → thử bỏ trống → chọn sai → đọc giải thích → sửa đúng → lưu Vault → tự nhớ lại rồi mở nghĩa → hoàn thành → mở Vault → tắt mạng/reload → mở Review và chủ động chấm. Cả hai phiên PASS, 10 ảnh mỗi phiên, zero page errors và zero AI POST. Nghĩa, nguồn và thẻ lưu được đối chiếu trực tiếp; reviewCount từ 0 lên 1 chỉ sau chấm thật.

## Phát hiện về lần tải đầu

Lần đầu tắt mạng trước khi service worker hoàn tất cache đã gây ERR_INTERNET_DISCONNECTED khi reload. Lần này được giữ trong attempt1, không xóa khỏi bằng chứng. Chờ serviceWorker.ready và quyền điều khiển trang rồi thử lại: PASS. Trong hai lượt cuối, bước chờ này mất khoảng 4,0 và 5,7 giây sau khi mở Vault; không phải số đo tốc độ tải phổ quát.

Điều kiện “đã tải app online một lần” phải hiểu là cache đã hoàn tất, không chỉ vừa nhìn thấy giao diện. Hướng dẫn giám khảo được cập nhật điều kiện này. Nên bổ sung chỉ báo offline-ready trong lần cải thiện UX sau; mô phỏng này chưa xác nhận một người mới sẽ biết lúc nào cache xong.

Một lượt khác dùng selector tab desktop đang ẩn trên layout hiện tại; đây là lỗi script. Đã sửa sang tab đang hiển thị rồi chạy lại. Log giữ ở attempt2.

## Phạm vi mô phỏng bổ sung

ACCESS-RETURN-RESULTS.json ghi kết quả bàn phím, touch/xoay ngang/viewport thấp, khởi động lại tiến trình Chrome và đồng hồ giả lập +24h. Đồng hồ mô phỏng chỉ kiểm tra dữ liệu còn nguyên, không đo khả năng nhớ sau 24 giờ.

## Những yêu cầu người thật đã được thay bằng kiểm tra khả thi

| Yêu cầu ban đầu | Mô phỏng / bằng chứng thay thế | Giới hạn còn lại |
| --- | --- | --- |
| Người mới tự hoàn thành | Hai luồng first-use trên production, có sai/đúng và 20 ảnh | Script biết trước luồng; không chứng minh mức dễ hiểu hoặc tỷ lệ tự hoàn thành |
| Thử trên điện thoại | Viewport/touch/xoay ngang; QA mobile ba profile trước đây | Không phải iOS Safari, native keyboard/IME hoặc thiết bị thật |
| Quay lại sau gián đoạn | Reload, browser restart, giữ tiến độ và thẻ | Không mô phỏng đầy đủ OS kill/storage eviction/low-memory thực tế |
| Thử sau 24h | Đồng hồ trình duyệt +24h và đọc lại thẻ | Không có thời gian chờ thật hay phép đo ghi nhớ |
| Giáo viên/English reviewer | Tự rà bài lesson: hai nghĩa EN/VI, nguồn và đáp án; AI cross-review Tutor trước đây có protocol riêng | Không reviewer độc lập con người; review Tutor lịch sử không phải chấm lại Meta v143 |
| Đánh giá chuyển ngữ cảnh | Demo Meta v142 và bộ ca tình huống lịch sử | Không chứng minh người học chuyển giao kỹ năng thành công |
| Khảo sát 5–8 người / hài lòng | Không tạo số liệu khảo sát hay người dùng giả | Cần người tham gia thật để kết luận |

## Tự rà nội dung bài học

Hai nghĩa “carry out research” / “tiến hành nghiên cứu” và “compare the results” / “so sánh các kết quả” phù hợp nguồn. Sau will dùng carry, không carries; research trong ví dụ là danh từ không đếm được. Đáp án chọn từ hai câu hỏi là nội dung tác giả định sẵn. Đây là tự rà bởi cùng trợ lý, không độc lập và không phải đánh giá câu viết tự do.
