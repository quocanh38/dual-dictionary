# Quy trình chất lượng xuyên suốt hackathon

Áp dụng cho Offline Lesson Studio, mọi bài học Meta tạo và mọi lần thay đổi generator/player. Có hiệu lực từ 27/10/2026. Dùng nền v143 đã chốt, giữ khai báo phần nền và phần mới trong `NEW-WORK.md`. Đây là quy trình thực hiện khi làm việc trong chat, không phải lịch tự chạy nền/qua đêm.

## Cập nhật ủy quyền mới — 27/10/2026

Owner đã giao agent tự duyệt P1 sau chấm chéo giữa các model; chỉ hỏi trước
khi deploy. Quy định chờ owner duyệt nội dung ở phần lịch sử bên dưới được
thay bằng quyết định biên tập có ghi bằng chứng của agent chính. Vẫn bắt buộc
review toàn bài gắn exact hash, giải quyết mọi critical/uncertain, rà lại khi
sửa payload và chạy approve riêng qua quality-gate; hai model cùng đồng ý
không phải chứng minh đúng tuyệt đối. Các reviewer phải ghi model được cấu
hình, phạm vi và mức tiếp xúc review trước. Không gọi đây là human review.
Xem `lesson-studio-evidence/p1-cross-model-2026-10-27/AUTHORIZATION.md`.


## Cấu hình review tiết kiệm — chỉ đạo tiếp theo của owner

Owner yêu cầu dùng model tiết kiệm, phù hợp vì quota Codex giảm nhanh.
Từ batch tiếp theo: gpt-6-luna rà đầu, gpt-6.1-sol rà bản chốt; reasoning vừa
đủ, gom tối đa ba bài cùng một lượt. Chỉ nâng model khi còn bất đồng khó hoặc
lỗi critical/uncertain chưa giải quyết. Gom sửa đổi trước khi freeze payload;
chỉ rà lại các pack bị sửa, vẫn đủ mọi tiêu chí của exact hash mới. Không chạy
lại ba bài đã duyệt/QA trong phiên chỉ để thay reviewer đắt bằng rẻ. Giữ đúng
model đã thực sự dùng trong bằng chứng lịch sử, không đổi tên hồi tố.
Review Codex và generation Meta có quota khác nhau. P1 tiếp tục dùng Meta theo chỉ đạo owner mới bên dưới.

## Cập nhật quyền dùng Meta — 27/10/2026

Owner chịu trách nhiệm credits Meta và đã yêu cầu Codex không kiểm tra Meta usage/Billing. Chỉ đạo này thay thế việc tra usage/Billing trước lượt gọi ở Bước 2 khi tiếp tục P1. Không tra usage hoặc số dư tài khoản; không tự suy ra chi phí/số credits. Giữ nguyên request, response hoặc lỗi đã có, nhưng không gọi Billing để xác minh. Các giới hạn không tự retry và tối đa một lượt repair cho mỗi bản nháp vẫn giữ nguyên. Không deploy nếu owner chưa chỉ thị.

## Trạng thái và người chịu trách nhiệm

`SOURCE_READY → GENERATED_DRAFT → STRUCTURE_PASS → EDITORIAL_REVIEW → CHANGES_REQUIRED hoặc READY_FOR_APPROVAL → APPROVED → RELEASE_QA_PASS → DEPLOYED`

Codex thực hiện code, kiểm tra, rà nội dung có ghi bằng chứng và sửa. Duyệt nội dung do AI hỗ trợ là đủ để chuẩn bị hồ sơ; ghi đúng **AI-assisted editor**, không gọi đó là reviewer tiếng Anh độc lập hoặc chứng nhận sư phạm. Không yêu cầu người học thật tham gia để duyệt bài hay qua QA bản nộp. Thử nghiệm người học là nghiên cứu bổ sung, chỉ báo cáo nếu thực sự có dữ liệu. Người biên soạn/chủ dự án vẫn quyết định duyệt phát hành qua thao tác duyệt riêng. Deploy chỉ thực hiện khi chủ dự án ra lệnh theo runbook hiện có. `READY_FOR_APPROVAL` chỉ có nghĩa đã hoàn tất hồ sơ rà; không đồng nghĩa đã phát hành hay chứng minh hiệu quả học.

## Một vòng làm việc bắt buộc

| Bước | Thực hiện | Điều kiện qua / bằng chứng |
|---|---|---|
| 1. Chốt đầu vào | ID nguồn, bài đọc gốc/có quyền dùng, academic/workplace, B1/B2 ước lượng; ghi model, prompt, phiên bản code và mục đích: development / evaluation / release. | Không có key, dữ liệu người học hay đề thi sao chép trong nội dung/log. Nguồn dùng chỉnh prompt không được tính vào bộ đánh giá chưa thấy. |
| 2. Meta tạo bản nháp | Mỗi lô tối đa 3 nguồn; giữ nguyên request, response hoặc lỗi. Theo chỉ đạo owner hiện tại, không tra Meta usage/Billing và không tự suy ra số credits/chi phí. Không gọi Meta chỉ để tự chấm chính Meta. | Không tự retry. Một repair call/bản nháp; hết lượt thì sửa biên tập hoặc loại. Tạo bản nháp mới không được dùng để giấu lượt lỗi hay vượt hạn mức của cùng công việc. |
| 3. Kiểm tra cấu trúc | Chạy schema, citation, phrase/source, ID đáp án, coverage, dung lượng, quyền sử dụng và cổng review. | Sai cấu trúc hoặc response thiếu/cắt giữa JSON → BLOCKED; không nhận một phần, không bịa dữ liệu thay thế. |
| 4. Rà nội dung đầy đủ | Rà cả hai cụm, EN/VI, từng câu hỏi, **mọi lựa chọn**, mọi giải thích và bài transfer theo rubric dưới. | Mỗi tiêu chí có kết luận + lý do cụ thể. Có critical hoặc uncertain chưa giải quyết → CHANGES_REQUIRED. Không chỉ đọc đáp án được gắn đúng. |
| 5. Sửa và rà lại | Lưu bản Meta gốc bất biến; lưu before/after, ai sửa, lý do, số gọi Meta thêm. Giữ metadata Meta gốc; không nhận sửa tay là output Meta mới. | Hash nội dung đổi → review cũ hết hiệu lực. Rà lại toàn bài, không chỉ câu vừa sửa. Chạy preview và kiểm tra luồng bằng test tự động/mô phỏng trên bản cuối; không cần tuyển người học thật. Bài chưa phát hành dùng revision/hash; đã duyệt/phát hành thì tăng version. |
| 6. Duyệt riêng | Hồ sơ review đầy đủ, đúng hash, không còn lỗi chặn; chủ biên quyết định duyệt; bộ bài phát hành hackathon dùng lệnh approve rõ ràng sau audit. | Gói approved + checksum, review và manifest duyệt. Script không tự hiểu tiếng Anh đúng/sai và không tự duyệt sau khi test PASS. |
| 7. QA bản phát hành | Import đúng gói approved vào browser sạch → đọc → chọn đáp án sai/đúng → transfer → Vault/Review → reload/offline. Kiểm tra cả browser cũ còn dữ liệu. Dùng automation và giả lập thiết bị khi không có máy thật. | Kết quả gắn hash gói và phiên bản code. Preview unapproved hữu ích nhưng **không thay thế** QA gói approved/import thật. Dữ liệu và lịch ôn cũ được giữ; nếu có lỗi thì quay lại bước sửa, tăng version khi cần. Không yêu cầu người học hoặc điện thoại thật để hoàn tất QA; ghi rõ giả lập và các giới hạn tương ứng. |
| 8. Deploy và minh chứng | Khi có lệnh deploy: snapshot đầy đủ, parity, cache, health/smoke theo `docs/deploy-state.md`; kiểm tra live rồi cập nhật demo/hồ sơ. | Không deploy chỉ vì một bài đạt review. Live, sample, dữ liệu đã lưu và mô phỏng được gắn nhãn riêng. Video dùng phiên bản đã kiểm tra. |

## Rubric rà nội dung

Mỗi bài hiện có 17 dòng tiêu chí: 1 quyền/nguồn; 3 tiêu chí × 2 cụm; 2 tiêu chí × 5 bài tập.

- **Nguồn và nghĩa:** cụm xuất hiện trong câu trích; chọn đúng nghĩa theo ngữ cảnh; Meaning (VI) là nghĩa tiếng Việt tự nhiên, có dấu, không phải lý do chọn cụm. Tránh định nghĩa quá hẹp, ví dụ “keep track of” không bắt buộc phải ghi chép.
- **Đáp án duy nhất:** đọc từng lựa chọn như một câu độc lập, thử tìm ngữ cảnh hợp lý khiến lựa chọn “sai” thành đúng. Nếu có, sửa hoặc ghi uncertain. Không chấm sai vì hoạt động nghe nhỏ nhặt, văn phong quá trang trọng, người nói ở quán cà phê hoặc ý định bị suy đoán.
- **Lời giải:** nêu lỗi cụ thể và cách sửa; không tổng quát hóa quá mức. Ví dụ “survey” có thể đi với “about/on”, không dạy rằng chỉ “about” mới đúng. Distractor phải có lỗi khách quan phù hợp mục tiêu, không là chuỗi từ vô nghĩa.
- **Transfer:** đổi vai trò, người nhận hoặc mục đích thực chất; không chỉ viết lại câu nguồn. Model answer tự nhiên, dùng đúng cụm, checklist hỗ trợ tự đánh giá. Không tự cho điểm năng lực viết/CEFR/IELTS.

Phân loại: **critical** = sai nghĩa, sửa oan, nhiều đáp án đúng, sai nguồn hoặc lỗi nội dung làm người học hiểu sai; **uncertain** = chưa đủ cơ sở để kết luận, xử lý như lỗi chặn; **minor** = trình bày/diễn đạt nhỏ không ảnh hưởng đáp án, có thể ghi nhận giới hạn. Không tự đổi uncertain thành pass vì hết thời gian.

## Công cụ kiểm soát hồ sơ

Chạy từ repository root, dùng Node gần đây:

```
node tools/lessons/quality-gate.mjs template candidate.json review.json
node tools/lessons/quality-gate.mjs audit candidate.json review.json
node tools/lessons/quality-gate-check.mjs
```

`template` sinh checklist **pending**, không tự điền pass. Với bộ bài phát hành hackathon, checklist 17 tiêu chí và audit là bắt buộc; bốn checkbox duyệt sẵn có trong UI chỉ hỗ trợ biên soạn cục bộ, không thay thế hồ sơ này. Reviewer đọc bài và điền từng evidence. `audit` chỉ kiểm tra hồ sơ đủ, đúng hash, đúng tiêu chí và không còn finding chặn; không phải một model chấm chất lượng ngôn ngữ.

Chỉ khi người biên soạn quyết định duyệt mới chạy:

```
node tools/lessons/quality-gate.mjs approve candidate.json review.json NEW_RELEASE_DIRECTORY
```

Thư mục phải mới. Kết quả `pack.json` import được, `review.json`, `approval.json` liên kết hash bản đã rà với hash bản approved. Công cụ không upload, install hay deploy. Review của bản khác/hash cũ, criterion thiếu/trùng, finding critical/uncertain chưa đóng đều bị từ chối. Approval là xác nhận biên tập được ghi nhận, không phải chữ ký số chứng minh danh tính.

## Khi nào chạy lại, chạy bao nhiêu

- **Thay prompt/model:** ghi prompt version mới, thử lô development nhỏ trước; giữ cả lỗi và lượt sửa. Sau khi chốt prompt, chạy evaluation trên nguồn chưa từng dùng để chỉnh prompt. Nếu xem kết quả rồi sửa prompt theo đó, các nguồn ấy trở thành development; bổ sung nguồn evaluation mới.
- **Sửa bài:** schema + hồ sơ review mới cho toàn bài + preview bản cuối; approved pack phải qua import/offline QA trước khi đưa vào release set.
- **Sửa player/storage/Vault/cache:** chạy đúng các contract/network/browser/hồi quy liên quan; bắt buộc kiểm tra browser có dữ liệu cũ nếu đụng persistence/cache. Không chạy lại toàn bộ test cũ nếu thay đổi chỉ ở tài liệu và không có vấn đề mới.
- **Trước release:** chốt danh sách pack ID/version/hash; chạy approved-pack QA trên chính danh sách đó và phiên bản code cuối. Không thay nội dung sau QA mà giữ nguyên bằng chứng.
- **Cuối mỗi phiên:** cập nhật bảng công việc, lỗi đang mở, usage thực tế, commit, live version và bước kế tiếp trong handoff. Trước video/hồ sơ nộp: đóng băng release set; dùng đúng số liệu có bằng chứng, giữ baseline v143 rõ ràng.

## Số liệu cần ghi, không đánh tráo

Theo lô: số nguồn; selection/exercise HTTP thành công; schema hợp lệ lần đầu; lỗi nghĩa/đáp án/giải thích/transfer; sửa tay/repair; loại/chờ/duyệt; số API call; latency nếu có. Không tra account-level usage/Billing theo chỉ đạo owner; không suy diễn token, số dư hay chi phí. Nếu response vốn đã chứa usage thì giữ nguyên trường trả về cùng raw response, không cần tra bổ sung. Báo mẫu số rõ: **nguồn, lượt gọi, bản nháp và câu hỏi là những mẫu số khác nhau**.

Tách development khỏi evaluation; nội dung sửa tay khỏi output Meta thô; test mô phỏng khỏi người học/thiết bị thật. Không đổi 9 HTTP 200 thành “9 bài chất lượng tốt”. Không công bố tỷ lệ giữ nhớ sau 24 giờ khi chỉ có giả lập. Reviewer độc lập, thiết bị thật, hiệu quả học chưa có thì ghi chưa có; các mục này là giới hạn nghiên cứu cần công khai, không phải điều kiện chặn code, duyệt biên tập hay QA.

Mục tiêu 10–20 bài đã duyệt chỉ đạt khi từng bài qua tất cả cổng cần thiết. Nếu sát hạn, giảm số bài thay vì hạ cổng chất lượng. Tập mẫu nhỏ có rà rõ và lỗi được báo trung thực tốt hơn tập lớn chưa kiểm chứng.

## Vòng đầu tiên áp dụng quy trình

Hai bài Library/Workplace đã được sửa biên tập, bản Meta gốc và diff được giữ lại. Rà toàn bài còn bắt được q4 quán cà phê bị sửa oan và định nghĩa keep track of quá hẹp; đã sửa kèm theo. Community cũng được rà theo cùng rubric. Xem `docs/lesson-studio-evidence/quality-cycle-2026-10-27/` và bảng trạng thái; không sửa ngược báo cáo pilot lịch sử. Chưa có lệnh duyệt release/deploy trong vòng này; không có gọi Meta mới.
