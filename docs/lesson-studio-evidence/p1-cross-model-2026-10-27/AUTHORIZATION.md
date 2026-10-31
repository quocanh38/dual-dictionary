# Ủy quyền duyệt chéo — 27/10/2026

Chỉ đạo trực tiếp mới của owner trong chat:

> P1 — Thư viện bài học: cái này sẽ code xuyên suốt tới khi hết tokens của Meta cấp, và bạn tự duyệt bài bằng cách chấm chéo giữa các model, chỉ hỏi tôi khi cần deploy

Chỉ đạo này thay yêu cầu cũ phải chờ owner bấm duyệt từng bộ bài. Agent chính
được ra quyết định biên tập rõ ràng sau review chéo, không coi schema PASS là
quyết định ngôn ngữ. Deploy/push main vẫn cần owner cho phép riêng.

Quy trình phiên này: hai reviewer model khác nhau (gpt-6-astra và gpt-6.1-terra)
đọc toàn bộ mỗi payload; lưu review riêng theo hash và model được cấu hình.
Các điểm critical/uncertain phải được sửa; payload thay đổi yêu cầu rà lại toàn
bài. Agent chính đọc và phân xử các nhận xét, audit hồ sơ rồi mới gọi quality-gate
approve. Đây là AI-assisted cross-model editorial review, không phải reviewer
người độc lập hoặc chứng minh hiệu quả học. Reviewer Terra ghi nhận đã vô tình
đọc một pilot review lịch sử trước vòng đầu; không mô tả vòng đó hoàn toàn blind.

Không gửi code, repository documents, log hoặc credential cho Meta. Meta chỉ
nhận nguồn gốc rõ ràng cho generation/evaluation đã được ủy quyền. Chỉ dùng
free credits; không bật paid overage, không tạo API key/access mới, không hỏi
owner dán khóa vào chat, không tạo vòng lặp nền.

Billing UI quan sát trong phiên: free credits in use khoảng USD149.26; trang
cảnh báo hoạt động có thể chậm đến một giờ. Không lưu screenshot hoặc dữ liệu
payment methods. Đây là observation, không phải hard spending cap. DD_META_KEY
không có trong shell environment hoặc launchd; chưa có lượt Meta mới. Tiếp tục
biên tập/duyệt/QA cục bộ, generation mới tạm chặn bởi cấu hình credential an toàn.
Không sử dụng số dư lịch sử USD149.84 để dự tính lượt tiếp theo.

## Cấu hình review tiết kiệm — chỉ đạo tiếp theo của owner

Owner yêu cầu dùng model tiết kiệm, phù hợp vì quota Codex giảm nhanh.
Từ batch tiếp theo: gpt-6-luna rà đầu, gpt-6.1-sol rà bản chốt; reasoning vừa
đủ, gom tối đa ba bài cùng một lượt. Chỉ nâng model khi còn bất đồng khó hoặc
lỗi critical/uncertain chưa giải quyết. Gom sửa đổi trước khi freeze payload;
chỉ rà lại các pack bị sửa, vẫn đủ mọi tiêu chí của exact hash mới. Không chạy
lại ba bài đã duyệt/QA trong phiên chỉ để thay reviewer đắt bằng rẻ. Giữ đúng
model đã thực sự dùng trong bằng chứng lịch sử, không đổi tên hồi tố.
Review Codex và generation Meta có quota khác nhau: phiên này chưa gọi Meta.
