# Phiên agents — 27/10/2026

Nền: `85b61c651c4bca9275150ddc085aa953d4899f5d`, nhánh
`hackathon/offline-lesson-studio`. Ba agent chia việc authoring, storage và hồ sơ/
evaluation; agent chính tích hợp và kiểm thử focus, CDP, QA origin, cache.

Thay đổi runtime: tiêu điểm chuyển đến tiêu đề màn hình Studio; kết nối IndexedDB
đến muộn sau khi open bị blocked/reject được đóng ngay. Thay đổi shell cache
ứng viên v123→v124. Chưa push/deploy; production HTTP vẫn v123. Không thay bảng
trạng thái production thành bản ứng viên. Không đổi nguồn Meta gốc, bài candidate,
hash review hay quyền duyệt; cả ba bài vẫn READY_FOR_APPROVAL.

Kiểm thử cuối: Chrome headless bên ngoài sandbox, checkout chính xác tại cổng
8877; main 14 nhóm, backup 11, legacy/mixed storage 12, recovery, import,
persistence, authoring reload/stale/offline và keyboard đều PASS. Kiểm thử
storage-open giả lập 4 nhóm, runtime QA routing, 27 contract groups, 13 offline
paths và guard cache đều PASS. CDP thật dùng Chrome profile QA tạm tại cổng9227:
keyboard PASS, cleanup giữ nguyên about:blank có trước và đóng context của suite.
Không chạy thiết bị thật hay nghiên cứu hiệu quả học. Lỗi blocked-open là phát
hiện qua code path/giả lập, chưa phải sự cố người dùng đã tái hiện.

Lệnh mẫu từ repository với Node hiện có:

```
NODE_PATH=/Users/nguyenquocanh/Documents/DSH/ui-check/node_modules DD_QA_BASE_URL=http://127.0.0.1:8877 DD_LESSON_ROOT="$PWD" DD_QA_OUTPUT="<evidence-directory>" /tmp/node-dsh/bin/node tools/lessons/browser.cjs
```

Các suite khác và bằng chứng cụ thể trong `summary.json` cùng các thư mục con.
Guard SW được chạy bằng bản sao script/baseline trong workspace, không sửa
baseline của DSH/ui-check. Một số race của test harness được sửa bằng cách chờ
source fill và giao dịch lưu hoàn tất; không gọi chúng là bug nội dung ứng dụng.

P2: 6 feedback fixtures, 2 lỗi API mock, 2 mock requests, 0 provider calls;
không đo accuracy hoặc learning outcome. Hồ sơ nộp bài chuyển trọng tâm sang
Studio và giữ disclosure nền v143. Trang event công khai đã được kiểm tra;
full rules/form/eligibility chưa xác minh, không tự suy đoán.

Không gọi Meta trong phiên; số dư free credits chưa biết. Không tạo automation,
không để loop API chạy nền. Không gửi mã nguồn/diff/log/credential cho Meta.

Tiếp theo: owner duyệt bộ candidate cụ thể rồi mới xuất approved qua quality-gate
và chạy release QA đúng hash; số dư/billing chắc chắn trước batch generation hay
live evaluation; hoàn tất full rules/form và video exact deployed build. Đây là
các gate độc lập; không tự duyệt hoặc triển khai để hoàn thành checklist.
