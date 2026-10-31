Evidence directory: /Users/nguyenquocanh/Documents/Codex/2026-10-24/n-u-m-c-ti-u/outputs/tutor-qa-2026-10-25
Main evaluation report: /Users/nguyenquocanh/Documents/Codex/2026-10-24/n-u-m-c-ti-u/outputs/TUTOR-DANH-GIA-VA-QA-2026-10-25.md
Relative artifact references below resolve in the evidence directory.

# QA mở rộng — 2026-10-25

**35 checks PASS; 0 issues; 0 fatal.** Chrome hệ thống trong profile tạm, viewport 1280/390, dữ liệu tự soạn, provider mô phỏng. **Chưa kiểm tra điện thoại vật lý.** Production vẫn v141; code sửa là candidate chưa deploy.

## Phạm vi bổ sung

- IndexedDB schema v1/v2/v3/v4/v5 → v6: bảo toàn files, item/due, review, known words và Tutor trong store cũ. Legacy localStorage vocab/sentences: dedupe, backup, giữ bản gốc và lịch ôn từ; chạy lại idempotent.
- Reload select rỗng/có cụm, answer/draft, feedback chưa quyết định/accepted/rejected, consent: không tự gọi provider, giữ trạng thái đã lưu.
- Reload giữa request trích cụm, đề đầu tiên, feedback hoặc tình huống mới: không replay; giữ trạng thái trước request; muốn gọi tiếp phải consent lại.
- Double choose/confirm: một request; double accept/save: một confirmed error và một nghĩa trong Vault. Saved stage/savedItemId giữ sau reload (phiên saved mở lại bắt đầu practice mới theo thiết kế).
- Tab/Enter, Escape đóng modal và focus về launcher; zero page errors ở hai chiều rộng.

## Lỗi tìm được và sửa

v141 để focus rơi về BODY sau khi button trong stage bị thay. `before-focus-fix.json` ghi nhận lỗi; run đầu đó cũng có lỗi selector mobile của harness đã được sửa. Candidate thêm observer giới hạn trong Tutor: chỉ phục hồi khi modal mở và activeElement là BODY/dialog. Không giành focus khỏi control đang dùng. Sau sửa, toàn bộ 35 checks PASS. `tutor-focus-fix.patch` là phần sửa này.

## Hồi quy liên quan

- `reliability.log`: 9 nhóm PASS — storage-full, cancellation/save/ranking races, invalid cache, resume pointer ordering, previous target retention và rejected new-situation recovery.
- `ai-flow.log`: mất mạng, 429, quote sai/thiếu, retry/cancel, consent, nghĩa lưu Vault và tình huống mới, Writing/Speaking; zero page errors.
- `offline-cache.log`: service worker thật, ngắt mạng/reload và câu hỏi offline ở 1280/390; zero page errors.
- `quality-contract.log`: source/meaning contract, missing-quote downgrade, legacy no-meaning guard, context/nonrepeat sau thay đổi feedback prompt.

Không chạy lại toàn bộ suite không liên quan đã PASS trước đây.

## Meta thật qua UI

- `meta-ui-results.json`: baseline 3 request PASS; nghĩa Việt tách khỏi selectionReason, prompt, feedback correct, save/reload giữ nghĩa.
- `candidate-meta-ui/meta-ui-results.json`: 3 request HTTP 200. Đề mới nói về lý do sinh viên bỏ tiết sáng, câu mẫu harness nói về học từ vựng nên model từ chối đúng; assertion correct của harness FAIL được giữ nguyên.
- `candidate-meta-ui-revision/meta-ui-results.json`: phục hồi cùng phiên, reject/revise câu cho đúng đề, thêm 1 request HTTP 200; correct, save và nghĩa sau reload PASS.

Bảy request UI này là bằng chứng riêng, không cộng vào mẫu 40. Toàn bộ đánh giá baseline/candidate và giới hạn reviewer nằm trong `../TUTOR-DANH-GIA-VA-QA-2026-10-25.md`.

## Chưa làm

Điện thoại thật, bàn phím ảo, background/foreground và PWA theo thiết bị: `DEVICE-CHECKLIST.md` vẫn NOT_RUN. Reviewer tiếng Anh độc lập chưa có. Candidate chưa deploy; cần lệnh deploy và runbook trước khi kiểm tra production mới.
