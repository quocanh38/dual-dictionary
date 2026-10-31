# Baseline và bộ đánh giá mở rộng — 25/10/2026

Baseline trước kickoff đã cố định bằng annotated local tag `hackathon-2026-prekickoff-v141`, trỏ commit `2dfaa2314bf886fc3c07c42961a3fc2e3326e345` (Git tree xem manifest). Tag object `857853e8156c6c6bb6d208f3314971f0e3eefa0a`. Không push tag, không deploy.

Archive nguồn `source-v141.tar.gz`: 18.618 file tracked, 44.935.010 bytes; SHA-256 `47aa16850056067416b3faf10318b44d257f3b3c3a6529580bcd1ecbaff4401e`. Đã kiểm lại archive và hash từng file. Live đã đối chiếu ngày 24/10 có 18.617 file vì .gitignore không được phát hành. Biên bản tracked đang sửa và inventory file untracked được lưu riêng, không trộn vào baseline nguồn.

Bộ `dual-dictionary-tutor-eval-v1`: 40 ca tự soạn = 32 feedback + 4 meaning/grounding + 4 situation; chia 24 dev / 16 holdout. Fixture SHA-256 `3114677aed2a810e83fbff1e09297ff0339621704deb61cff0b22f880aba63c2`. Có prompt/validator frozen đúng baseline, rubric, bản đọc được, JSON kết quả NOT_RUN và batch runner mặc định chỉ kiểm tra offline. Live mode cần split cụ thể, --allow-live, --out và META_API_KEY cục bộ; không tự retry hoặc chạy holdout.

Artifact lưu trong outputs của chat Codex hiện tại: `hackathon-baseline-v141/` và `tutor-evaluation-v1.zip`. Tool/fixture đã kiểm tra cấu trúc và bằng mock, chưa chạy 40 ca Meta thật. Kỳ vọng cần người tiếng Anh tốt rà trước khi công bố benchmark; ca ambiguous không có một verdict uncertain duy nhất. Không dùng pass validator để thay cho chấm chất lượng sư phạm. Không dùng holdout để chỉnh prompt rồi tiếp tục gọi là unseen.

Những tính năng trong v141 là phần đã có trước cuộc thi. Baseline không tự xác nhận tính hợp lệ theo Official Rules. Sau kickoff ghi riêng commit/timestamp/phần code mới và evidence, so với tag baseline.
