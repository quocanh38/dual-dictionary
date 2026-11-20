> **LIVE v202 — 17/11/2026.** Netlify deploy [6afbb411c17c6dbe1a230d7c](https://app.netlify.com/projects/dualdictionary/deploys/6afbb411c17c6dbe1a230d7c). Cache `mdx-dict-v202-ux-signals`. Adds a non-blocking one-time v5 consent choice, allowlisted UX signals, and admin rollup. Preview and production HTTP checks and full SHA inventory verification passed. Chromium mobile confirmed both choices persist, no UX signal before consent or after revocation, and one signal for two help opens. Authenticated production admin confirmed exactly one matching QA signal.

> **LIVE v201 — 16/11/2026.** Netlify deploy [6afacf4e96f233912bb07808](https://app.netlify.com/projects/dualdictionary/deploys/6afacf4e96f233912bb07808), based on `6afaa7193b90df2e0803cefe`. Repaired dictionary-hub canonical, updated social cards on 12 pages, synchronized blog schema and authors, added Gemini guidance on the Vietnamese homepage, and set intrinsic dimensions on the audit images. Cache `mdx-dict-v201-content-metadata`. All 51 changed production paths passed HTTP smoke, SHA inventory matched all 28,711 paths, and Chromium mobile verified canonical, Gemini link and image dimensions. Sitemap URL sets remained unchanged.

# Dual Dict — Bàn giao Codex trên Windows, cập nhật 16/11/2026

Tiếp tục trên nhánh `windows-handoff-2026-11-15`. Production hiện chạy **v202**, cache `mdx-dict-v202-ux-signals`, trên [Netlify deploy 6afbb411c17c6dbe1a230d7c](https://app.netlify.com/projects/dualdictionary/deploys/6afbb411c17c6dbe1a230d7c). Netlify phát hành thủ công bằng cách giữ inventory production và thay đúng các tệp phát hành. Đã đối chiếu SHA của 28.711 đường dẫn tĩnh.

## Trạng thái đã nghiệm thu

- SEO đã cập nhật sitemap, widget, `llms.txt`, năm mục từ đa nghĩa và bài TOEIC Part 5–6. Bài TOEIC mở thẳng câu mẫu; lỗi sai lưu trên máy và có thể ôn ở tab sau.
- Tổng quan admin có Tra từ, Reader, TOEIC, Ôn tập, Chat, AI Tutor, Gemini giải thích TOEIC và Lesson Studio. **Vận hành** chứa số đếm audio và ảnh chụp Netlify Observability có thời điểm. Thẻ Netlify không tự làm mới.
- v200 ghi riêng lỗi tải gói từ điển. Đã đối chiếu **14/14 batch kiểm thử** qua API admin production cho Tra từ, Reader, TOEIC, Ôn tập và Chat. Kiểm tra gửi lại sau khi mất phản hồi, lọc ngày giờ Việt Nam, chạy TOEIC khi tắt chia sẻ, và mẫu số 7 ngày bằng đồng hồ thử. Chat dùng Gemini giả lập. Một số lượt QA có thể nằm trong tổng số ngày nghiệm thu.
- v199 đã kiểm thử production ở 390 và 1280 px cho giữ nháp khi nhập key, lỗi 429/mất mạng, dừng giữa phản hồi, lưu, đổi tên và mở lại hội thoại. Đã kiểm chứng lượt hỏi tiếp được lưu và phục hồi.
- Netlify MCP và Playwright MCP đã được cấu hình trên máy Windows này. Modern Web Guidance, Impeccable và năm Marketing Skills bên dưới đã được cài cấp người dùng.

## Mở repo trên Windows

Dùng PowerShell với Git, Codex CLI và Node.js 24 trở lên.

```powershell
git clone --no-checkout --branch windows-handoff-2026-11-15 https://github.com/quocanh38/dual-dictionary.git
cd dual-dictionary
@("/*", "!/data/word-notes/con.md", "!/vi/tu/con/") | git sparse-checkout set --no-cone --stdin
git -c core.protectNTFS=false read-tree -mu HEAD
npm.cmd ci
```

Nếu đã clone và đang ở nhánh bàn giao, chạy `git pull --ff-only`. Mở thư mục repo bằng Codex. Checkout Windows đang dùng sparse checkout để loại `data/word-notes/con.md` và `vi/tu/con/index.html`, vì `CON` là tên dành riêng. Hai đường dẫn vẫn có trong Git và production. Nếu checkout mới bị lỗi, dùng checkout trên hệ thống tệp Linux của WSL hoặc cấu hình cùng phạm vi sparse checkout.

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

## Marketing Skills cho Dual Dict

Cài năm skill chọn lọc từ [Marketing Skills](https://github.com/coreyhaines31/marketingskills) cho Codex trên Windows:

```powershell
npx.cmd skills add coreyhaines31/marketingskills --skill copy-editing copywriting customer-research onboarding content-strategy --agent codex --global
```

Mở lại Codex nếu cần. Dùng `$copy-editing` để rà câu chữ tiếng Việt, thuật ngữ và nhãn thao tác. Dùng `$copywriting` để viết nội dung mới cho trang giới thiệu, bài học hoặc màn chào mừng. Lượt rà đầu tiên có thể đi từ trang chủ tiếng Việt đến Chào mừng và Luyện TOEIC.

Với nội dung dạy tiếng Anh, kiểm tra thêm nghĩa theo ngữ cảnh, độ tự nhiên của ví dụ, độ chính xác của bản dịch và căn cứ cho đáp án. Giữ nguyên các thông tin đã xác minh về offline, Gemini và dữ liệu trải nghiệm khi biên tập.

- `$customer-research` để quan sát người học thật và tìm bước họ gặp khó.
- `$onboarding` để tối ưu đường đến lần tra từ đầu tiên hoặc hoàn thành bài mẫu và lưu cụm từ.
- `$content-strategy` để ưu tiên cập nhật nội dung theo mục tiêu tra từ, ôn TOEIC và đọc tiếng Anh công việc.

## Trạng thái production và admin

- [App](https://dualdictionary.netlify.app/) · [Admin](https://dualdictionary.netlify.app/admin/experience/) · [Thông báo dữ liệu](https://dualdictionary.netlify.app/vi/du-lieu-trai-nghiem/).
- `DD_EXPERIENCE_OPERATIONS=enabled` đang bật cho Netlify Functions, context production. Endpoint đọc trạng thái `/.netlify/functions/experience?operations` đã trả `{"enabled":true}`. Số liệu mặc định đếm tải audio bắt đầu, thành công và lỗi theo ngày giờ Việt Nam và phiên bản. Bản ghi bộ đếm không chứa mã phiên hoặc mã lượt học.
- Hành trình TOEIC chỉ ghi khi người học chủ động bật chia sẻ. Báo cáo nối mở bộ, hoàn thành, lưu lỗi sai và quay lại ôn trong 7 ngày. Tỷ lệ quay lại chỉ tính các lượt đã có đủ 7 ngày quan sát. Góp ý chỉ gửi khi người dùng bấm Gửi.
- Đã kiểm tra Chromium và backend cục bộ với dữ liệu giả lập. Trên production đã xác minh service worker `v196`, thông báo, trạng thái bật và endpoint báo cáo trả 401 khi thiếu khóa. Báo cáo hành trình đã được đối chiếu với các lượt QA có kiểm soát ở v200. Chưa đối chiếu riêng số đếm audio qua một lượt tải production có kiểm soát.
- Khóa admin và khóa Gemini nhập qua giao diện hoặc quản lý qua hệ thống cấu hình phù hợp. Giữ bí mật và dữ liệu người dùng ngoài Git, chat và ảnh chụp.

## Luồng người học mới

Commit `bd95ec03ab` rút gọn Chào mừng, đưa nút tải gói đề xuất lên màn hình đầu và thêm lối vào bài mẫu. Đã kiểm tra Chromium ở 320, 390 và 1280 px, gồm tải và tra từ, làm bài mẫu và đưa thẻ vào Ôn tập. Bài mẫu hiện dùng giao diện tiếng Anh.

## Gemini thật đã nghiệm thu trên Chromium cục bộ

- **Tạo bài từ Sổ tay** qua Gemini 3.6 Flash. Đủ ba câu hợp lệ, lưu và mở lại đủ ba câu sau khi reload offline.
- **Lesson Studio** qua Gemini 3.8 Flash. Sửa và xem trước yêu cầu, nhận hai cụm bám nguồn, tạo bài tập và xác nhận gói ở trạng thái `draft`. Model mặc định vẫn là 3.6 Flash. Lượt 3.6 Flash trên trình duyệt gặp HTTP 429.
- TOEIC từng được nghiệm thu với Gemini thật trên production cho Dừng, Thử lại, Hỏi tiếp và mở lời giải offline. Reader, AI Tutor, Viết, ghi chú Nói và bài công việc đã có phản hồi thật qua client.

## Việc tiếp theo

1. Quan sát 5 người học mới thử Tra từ hoặc Reader → Chat → lưu → Ôn tập. Đối chiếu góp ý theo chủ đề và các mốc admin để xác định ưu tiên UX.
2. Trong admin, dùng tử số và mẫu số, tách lượt QA khỏi diễn giải hành vi người học. Xác nhận riêng bộ đếm audio và Theo dõi Netlify RUM/Observability khi cần điều tra hiệu năng.
3. Đối chiếu quy trình lưu trữ, rút lại đồng ý và xóa dữ liệu. Báo cáo hành trình đọc tối đa 90 ngày. Blobs chưa có tác vụ xóa tự động.
4. Lấy Search Console theo URL × truy vấn để chọn nhóm mục từ biên tập tiếp. Dữ liệu này phục vụ ưu tiên SEO.
