# Vòng chất lượng đầu tiên — 27/10/2026

Quy trình áp dụng cho mọi lô bài và thay đổi generator/player trong suốt hackathon. Không có automation nền.

| Bài | Đã xử lý | Trạng thái |
|---|---|---|
| Library | Thay lựa chọn dựa trên văn phong/ý định; sửa thêm đáp án ở quán cà phê có thể đúng; sửa giải thích quá rộng. | 17/17 tiêu chí có evidence; preview offline PASS; READY_FOR_APPROVAL. |
| Workplace | Thay distractor dựa trên ý định; sửa nghĩa keep track of để không bắt buộc ghi chép; chỉnh giải thích. | 17/17 tiêu chí có evidence; preview offline PASS; READY_FOR_APPROVAL. |
| Community | Rà lại toàn bộ nguồn/nghĩa/đáp án/giải thích/transfer theo cùng rubric; không sửa nội dung học trong vòng này. | 17/17 tiêu chí có evidence; preview offline PASS; READY_FOR_APPROVAL. |

Reviewer: Codex, **AI-assisted editor**, không phải reviewer độc lập. Original Meta outputs, before/after và hash được lưu; phần sửa tay không được nhận là Meta sinh lại. Không xóa báo cáo lỗi pilot lịch sử.

10 nhóm kiểm tra quality gate PASS: hồ sơ pending/thiếu/trùng, payload đã sửa, timestamp/identity thiếu, critical/uncertain mở, finding cũ chưa đóng, dữ liệu review hỏng, gói sai schema và ghi đè release đều được chặn. Thử duyệt chỉ dùng fixture kiểm thử trong thư mục tạm, không duyệt ba bài thật.

Ba candidate đều qua toàn bộ player trong preview offline: đáp án sai không cho đi tiếp; đáp án đúng theo ID; transfer tự đánh giá; không ghi Vault khi chưa duyệt; không tràn màn hình mobile. Hash candidate được ghi trong kết quả QA và board. Đây không thay thế kiểm tra import gói approved/Vault trên bản phát hành.

**Chưa duyệt phát hành, chưa deploy.** Không gọi Meta mới, không tăng chi phí API trong vòng này. Sau quyết định duyệt: tạo gói approved, import đúng gói đó, kiểm tra offline/Vault/Review và dữ liệu cũ, rồi deploy khi có lệnh. Mục tiêu 10–20 bài vẫn chưa hoàn tất.

Bảng máy đọc được: board.json. Quy trình: QUY-TRINH.md. Lần làm tiếp đọc hai tệp này trước.
