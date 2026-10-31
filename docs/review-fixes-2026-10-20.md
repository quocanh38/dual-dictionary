# Sửa 7 lỗi review — v129 LIVE

Baseline: netlify/main abe0ddb40. **Đã deploy v129 lúc 12:47 VN 20/10/2026**, commit `8c9f8a335`, deploy `6ad700749b8bb81a93455ed0`, SW `mdx-dict-v100`.

## Thay đổi

1. Reading Again chỉ chấm/lưu item gốc; không ghi lại bản sao có due/reviewCount cũ.
2. Import v3 giữ fsrs qua makeItem, cùng chính sách local-wins hiện tại; JSON và backup dùng chung đường này.
3. Review không tạo session queue trước khi boot tải items xong; queue đang học được giữ nguyên.
4. Kết quả lookup/build/miss/error cũ không được cập nhật DOM khi generation hoặc dictionary identity đã đổi; history chỉ ghi truy vấn hiện tại có kết quả.
5. Gloss cache invalidate khi attach/remove/replace dictionary, không giữ negative result; kết quả đang chạy từ nguồn cũ tự đọc lại nguồn hiện tại.
6. QA so hash mọi precache asset với baseline Git (text bỏ khác biệt CRLF; binary giữ nguyên), kiểm tra CACHE tăng khi shell đổi và asset có mặt. All-mode chạy link-check ×2, SW-check, regression, production smoke ×3.
7. Optimizer dùng cùng ranh giới một ngày với scheduler. Log mới giữ elapsedDays chính xác, cờ longTerm và warm-init state; log cũ không có cờ dùng elapsedDays >= 1. Không viết lại lịch sử review cũ. Những log cũ từng làm tròn elapsedDays sát ranh giới ngày không thể khôi phục độ chính xác đã mất.

## Validation

- node tools/review-regression.cjs: 13 scenario ALL PASS (restore/local-wins, reading Good/Again, boot queue, race hit/miss/error/build/source replacement, gloss lifecycle, scheduler/replay first/sub-day/day/warm/legacy, SW hash/bump/missing/binary).
- node tools/fuzzy-test.cjs: ALL PASS.
- node --check các file runtime thay đổi và tools mới: PASS.
- Chrome headless profile riêng, origin localhost: direct Review boot có due card; reading Again giữ reviewCount/FSRS/due sau reload; Reader coverage; viewport 390px không tràn ngang; 0 pageerror. Chạy SW bình thường để không tạo SecurityError do harness chặn SW trong iframe sandbox.
- node tools/local-qa.cjs: ALL PASS — 10.402 HTML / 109.948 internal links / 0 dead ở cả 2 lượt; shell v99→v100 hợp lệ; regression PASS; live-smoke 3/3 ×7 URL. Production smoke xác nhận bản live cũ còn khỏe, không xác nhận bản sửa đã được deploy.

## Chạy QA

Lệnh sau deploy v129, từ repo root trên Mac/Windows:

    node tools/local-qa.cjs all --live-sha 8c9f8a335

Tool đang giữ baseline mặc định v128 eac22a52b; production đã v129. Từ nay chạy `node tools/local-qa.cjs all --live-sha 8c9f8a335` để dùng đúng baseline live, hoặc truyền --expected-cache mdx-dict-v100 cho smoke. Smoke lấy CACHE kỳ vọng từ sw.js của baseline.

Kiểm tra bản local/snapshot chỉ định:

    node tools/local-qa.cjs live-smoke --base-url http://127.0.0.1:8765 --expected-cache mdx-dict-v100

Sau khi owner duyệt push, vẫn phải làm deploy-verify trước/sau và runbook hiện tại. QA này không thay thế full-snapshot parity hay kiểm tra mic/notification/iOS thật.

## Biên bản deploy

- Netlify ready: 2026-10-20T05:47:58.401Z (12:47 VN).
- Production và URL snapshot mỗi nơi smoke ×3, 7/7 URL, SW v100: ALL PASS.
- Chrome production profile riêng: direct Review có due item; reading Again giữ FSRS/reviewCount/due sau reload; Reader coverage; mobile 390px không tràn; 0 pageerror.
- Full-snapshot postverify: live 13.025, không thiếu/lệch asset hoặc docs trước ghi biên bản; 3 case-diff info. AGENTS.md untracked chỉ local, được loại khỏi Git push.
- Biên bản này commit local sau deploy, ship cùng release kế theo trap 11.
