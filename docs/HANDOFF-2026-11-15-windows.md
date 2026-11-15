# Dual Dict — Bàn giao Codex trên Windows, 15/11/2026

Tiếp tục trên nhánh `windows-handoff-2026-11-15`. Bản production được xác minh là `v196-first-lookup`, Netlify deploy [6af9c3ca5e7e4b1dfb6d764c](https://app.netlify.com/projects/dualdictionary/deploys/6af9c3ca5e7e4b1dfb6d764c). Đây là bản deploy thủ công. Nhánh bàn giao chưa merge vào `main`. Lần deploy vừa rồi giữ bộ tệp của bản production trước và chép đè các thay đổi đã kiểm tra.

## Mở repo trên Windows

Dùng PowerShell với Git, Codex CLI và Node.js 24 trở lên.

```powershell
git clone --branch windows-handoff-2026-11-15 https://github.com/quocanh38/dual-dictionary.git
cd dual-dictionary
npm ci
```

Nếu đã clone và đang ở nhánh bàn giao, chạy `git pull --ff-only`. Mở thư mục repo bằng Codex.

## Cài Netlify MCP, Modern Web Guidance và Impeccable

```powershell
codex mcp add netlify --url https://mcp.netlify.com/mcp
codex plugin marketplace add GoogleChrome/modern-web-guidance
codex plugin add modern-web-guidance@googlechrome
npx.cmd skills add https://github.com/pbakaus/impeccable/tree/main/.agents/skills/impeccable --agent codex --global
```

Đăng nhập Netlify khi được hỏi. Mở lại Codex nếu cần nạp cấu hình mới. Yêu cầu Codex gọi Netlify MCP `get-user` và kiểm tra quyền đọc dự án `dualdictionary`. Khi rà hay sửa UI, yêu cầu Codex dùng Modern Web Guidance. Nếu chọn lối cài skill qua trình hướng dẫn của dự án, chạy `npx.cmd modern-web-guidance@latest install` và chọn Codex.

[Thiết lập Codex cho Netlify](https://docs.netlify.com/build/build-with-ai/agent-setup-guides/set-up-codex-for-netlify/) · [Modern Web Guidance](https://github.com/GoogleChrome/modern-web-guidance#alternative-installation-methods)

Impeccable dùng cho rà bố cục, thứ bậc thị giác và luồng sử dụng. Sau khi cài, mở lại Codex và gọi `$impeccable`. Dual Dict đã có `playwright-core` trong repo, dùng cho kiểm tra trình duyệt sau khi chạy `npm ci`. Context7 và Vercel Agent Skills chưa dùng cho bản bàn giao này. [Impeccable](https://github.com/pbakaus/impeccable)

## Trạng thái production và admin

- [App](https://dualdictionary.netlify.app/) · [Admin](https://dualdictionary.netlify.app/admin/experience/) · [Thông báo dữ liệu](https://dualdictionary.netlify.app/vi/du-lieu-trai-nghiem/).
- `DD_EXPERIENCE_OPERATIONS=enabled` đang bật cho Netlify Functions, context production. Endpoint đọc trạng thái `/.netlify/functions/experience?operations` đã trả `{"enabled":true}`. Số liệu mặc định đếm tải audio bắt đầu, thành công và lỗi theo ngày giờ Việt Nam và phiên bản. Bản ghi bộ đếm không chứa mã phiên hoặc mã lượt học.
- Hành trình TOEIC chỉ ghi khi người học chủ động bật chia sẻ. Báo cáo nối mở bộ, hoàn thành, lưu lỗi sai và quay lại ôn trong 7 ngày. Tỷ lệ quay lại chỉ tính các lượt đã có đủ 7 ngày quan sát. Góp ý chỉ gửi khi người dùng bấm Gửi.
- Đã kiểm tra Chromium và backend cục bộ với dữ liệu giả lập. Trên production đã xác minh service worker `v196`, thông báo, trạng thái bật và endpoint báo cáo trả 401 khi thiếu khóa. Chưa kiểm tra số đếm hoặc báo cáo bằng dữ liệu người dùng thật.
- Khóa admin và khóa Gemini nhập qua giao diện hoặc quản lý qua hệ thống cấu hình phù hợp. Giữ bí mật và dữ liệu người dùng ngoài Git, chat và ảnh chụp.

## Luồng người học mới

Commit `bd95ec03ab` rút gọn Chào mừng, đưa nút tải gói đề xuất lên màn hình đầu và thêm lối vào bài mẫu. Đã kiểm tra Chromium ở 320, 390 và 1280 px, gồm tải và tra từ, làm bài mẫu và đưa thẻ vào Ôn tập. Bài mẫu hiện dùng giao diện tiếng Anh.

## Gemini thật đã nghiệm thu trên Chromium cục bộ

- **Tạo bài từ Sổ tay** qua Gemini 3.6 Flash. Đủ ba câu hợp lệ, lưu và mở lại đủ ba câu sau khi reload offline.
- **Lesson Studio** qua Gemini 3.8 Flash. Sửa và xem trước yêu cầu, nhận hai cụm bám nguồn, tạo bài tập và xác nhận gói ở trạng thái `draft`. Model mặc định vẫn là 3.6 Flash. Lượt 3.6 Flash trên trình duyệt gặp HTTP 429.
- TOEIC từng được nghiệm thu với Gemini thật trên production cho Dừng, Thử lại, Hỏi tiếp và mở lời giải offline. Reader, AI Tutor, Viết, ghi chú Nói và bài công việc đã có phản hồi thật qua client.

## Việc tiếp theo

1. Dùng Netlify MCP kiểm tra production đã publish, rồi mở admin với khóa hợp lệ để xác minh có dữ liệu thật. Đối chiếu một lượt tải audio có kiểm soát và luồng TOEIC mẫu từ mở bộ đến ôn ở phiên sau. Hiển thị mẫu số và số lượt đủ thời gian quan sát khi đọc tỷ lệ.
2. Rà log kết nối, thời hạn lưu và quy trình đáp ứng yêu cầu dữ liệu, cùng căn cứ xử lý áp dụng. Kiểm tra giới hạn tần suất của endpoint trước khi dựa vào số đếm để ra quyết định.
3. Tiếp tục UX admin. Ưu tiên đưa số liệu cần xử lý lên đầu, nối Tổng quan với góp ý theo chủ đề, và lọc Bộ TOEIC theo Part/trạng thái. Cân nhắc Reader và tiếng Anh công việc sau khi báo cáo TOEIC cho kết quả đáng tin cậy.
