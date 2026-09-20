# AI Education Video Factory

## Hướng dẫn sử dụng

AI Education Video Factory là hệ thống quản trị để biến nội dung bài học thành video giáo dục dọc, ngắn. Đối tượng sử dụng hiện tại là quản trị viên nội dung. Quy trình đã được kiểm chứng với AI mock, MongoDB, worker và FFmpeg; kết quả cuối là MP4 9:16 có giọng mẫu và phụ đề tiếng Việt.

> Trạng thái môi trường hiện tại: pipeline **MOCK ONLY** đối với LLM, tạo ảnh, OCR và TTS. OpenAI thật, OCR thật và YouTube thật chưa được cấu hình/kiểm chứng. Không xem hình, nội dung OCR hoặc âm thanh mock là nội dung sản xuất thật.

Tài liệu này mô tả phiên bản source và runtime được kiểm tra ngày 2026-09-09. Các nhãn dùng trong tài liệu:

- `IMPLEMENTED_AND_VERIFIED`: đã có code và đã qua kiểm tra runtime phù hợp.
- `IMPLEMENTED_BUT_NOT_VERIFIED`: có UI/backend nhưng chưa điều khiển bằng browser automation.
- `PARTIAL`: chỉ một phần workflow hoạt động.
- `MOCK_ONLY`: chỉ kiểm chứng bằng provider mock.
- `API_ONLY`: có API nhưng không có thao tác tương ứng trên UI.
- `NOT_IMPLEMENTED`: người dùng chưa thể sử dụng.
- `NOT_CONFIGURED`: có adapter/code nhưng môi trường chưa có credentials.

## Interactive Step-by-Step Guide

Sau khi đăng nhập, mở `/dashboard/help` hoặc chọn **Hướng dẫn** trong sidebar. Trang này chia quy trình thành 15 bước, có quick action đến đúng màn hình và lưu các bước đã hoàn thành/bỏ qua trong `localStorage` của trình duyệt. Trạng thái này là checklist cá nhân, không thay thế trạng thái thật của Lesson, Script, Render Job hoặc Video trong MongoDB.

# 1. Tổng quan hệ thống

```text
Bài học
   ↓
Tài liệu nguồn
   ↓
AI phân tích
   ↓
Tạo kịch bản
   ↓
Duyệt kịch bản
   ↓
Storyboard 5–7 cảnh
   ↓
Ảnh + giọng đọc
   ↓
SRT subtitle
   ↓
FFmpeg render
   ↓
Duyệt video
   ↓
YouTube (chưa cấu hình thật)
```

- Bài học thuộc một môn, khối và sách giáo khoa.
- Tài liệu nguồn cung cấp nội dung cho bước phân tích. TXT, DOCX và PDF có text layer được trích xuất; ảnh dùng nội dung có tiền tố `[MOCK OCR]` trong mock mode, còn OCR thật chưa cấu hình.
- AI Analysis tạo tóm tắt nguồn, mục tiêu, dữ kiện, định nghĩa, công thức, ví dụ, lỗi thường gặp, từ khóa và độ khó.
- Script Studio tạo kịch bản 25–35 giây gồm tiêu đề, hook, narration và CTA. Người dùng phải duyệt script trước bước storyboard.
- Storyboard chia narration thành 5–7 scene, mỗi scene có timing, mô tả hình, image prompt và nội dung subtitle.
- Hệ thống tìm lại asset cùng cache identity trước khi tạo asset mới. TTS cũng tái sử dụng nội dung giống nhau.
- Worker dùng FFmpeg để ghép ảnh, voice và SRT thành MP4 dọc.
- Chỉ video đã render và được duyệt mới đi đến màn hình publish.

# 2. Yêu cầu hệ thống

## Chạy bằng Docker — khuyến nghị

- macOS, Windows hoặc Linux có Docker và Docker Compose.
- OrbStack có thể dùng thay Docker Desktop trên macOS.
- Trình duyệt hiện đại.
- Dung lượng trống đủ cho MongoDB, image, audio và video. Project không quy định mức dung lượng tối thiểu.
- Docker tự cung cấp Node.js 22 cho web/worker, MongoDB 7 và FFmpeg trong worker.
- Internet và API key chỉ cần khi dùng OpenAI hoặc YouTube thật.

```bash
docker compose build
docker compose up -d
```

## Chạy development không đóng gói web bằng Docker

Các script sau tồn tại:

```bash
npm install
npm run dev
npm run worker
```

Chế độ này còn yêu cầu một MongoDB mà tiến trình trên host truy cập được và FFmpeg có trong `PATH` của worker. Compose hiện không publish cổng MongoDB ra host, nên cách chạy kết hợp host web + Compose MongoDB **CHƯA VERIFY**. Với người dùng thông thường, dùng toàn bộ Docker Compose.

# 3. Cài đặt lần đầu

1. Clone project và mở terminal tại thư mục project.
2. Tạo file cấu hình:

   ```bash
   cp .env.example .env
   ```

3. Trong `.env`, thay toàn bộ password/secret mẫu, tối thiểu gồm MongoDB, session và admin.
4. Kiểm tra Compose:

   ```bash
   docker compose config
   ```

5. Build và khởi động MongoDB, web, worker:

   ```bash
   docker compose build
   docker compose up -d
   ```

6. Kiểm tra container:

   ```bash
   docker compose ps
   docker compose logs --tail=100 web worker mongodb
   ```

7. Kiểm tra health:

   ```bash
   curl http://localhost:3000/api/health
   ```

   Kết quả tốt có `application`, `mongodb`, `storage` và `worker` là `ok`. `ffmpeg` hiển thị `worker-only` vì FFmpeg nằm trong worker.

8. Mở một trong các URL:

   - `http://localhost:3000/login`
   - OrbStack: `https://web.ai-education-video-factory.orb.local/login`

9. Đăng nhập bằng `ADMIN_EMAIL` và `ADMIN_PASSWORD` đã đặt trong `.env`. Tài khoản được tạo trong MongoDB khi đăng nhập đúng lần đầu.

> Không có mật khẩu admin mặc định an toàn để dùng chung. Không commit `.env` hoặc đưa password vào tài liệu công khai.

# 4. Cấu hình Environment

Các biến dưới đây được lấy từ `.env.example` và source hiện tại.

| Variable | Bắt buộc | Ý nghĩa | Ví dụ an toàn |
| --- | --- | --- | --- |
| `NODE_ENV` | Có trong Compose | Môi trường Node | `development` |
| `APP_URL` | Có | URL trình duyệt; cũng quyết định cookie Secure | `https://web.ai-education-video-factory.orb.local` |
| `INTERNAL_APP_URL` | Có khi chạy Compose | URL web nội bộ để middleware kiểm tra session | `http://web:3000` |
| `MONGODB_URI` | Có | URI của app user và `authSource` | `mongodb://app_user:...@mongodb:27017/ai_education_video_factory?authSource=ai_education_video_factory` |
| `MONGO_ROOT_USERNAME` | Có với Compose | Root user dùng khởi tạo/backup | `admin` |
| `MONGO_ROOT_PASSWORD` | Có với Compose | Root password | giá trị bí mật mạnh |
| `MONGO_DATABASE` | Có với Compose | Tên database ứng dụng | `ai_education_video_factory` |
| `MONGO_APP_USERNAME` | Có với Compose | User read/write của web và worker | `app_user` |
| `MONGO_APP_PASSWORD` | Có với Compose | Password của app user | giá trị bí mật mạnh |
| `STORAGE_ROOT` | Có | Thư mục media trong container | `/app/storage` |
| `LOG_LEVEL` | Không | Có trong template nhưng logger hiện chưa đọc biến này | `info` |
| `SESSION_SECRET` | Có cho production | Khóa ký session | chuỗi ngẫu nhiên dài |
| `ADMIN_EMAIL` | Có cho login lần đầu | Email admin được phép tự tạo | `admin@example.com` |
| `ADMIN_PASSWORD` | Có cho login lần đầu | Password admin ban đầu | password mạnh, tối thiểu UI yêu cầu 8 ký tự |
| `AI_LLM_PROVIDER` | Có | `mock` hoặc `openai` | `mock` |
| `AI_IMAGE_PROVIDER` | Có | `mock` hoặc `openai` | `mock` |
| `AI_TTS_PROVIDER` | Có | `mock` hoặc `openai` | `mock` |
| `MOCK_AI` | Có khi test | `true` ép cả LLM/Image/TTS sang mock | `true` |
| `OPENAI_API_KEY` | Khi dùng OpenAI | API key cho LLM, image và TTS | để trống trong mock |
| `OPENAI_MODEL` | Khi dùng OpenAI LLM | Model LLM từ cấu hình | `gpt-4o-mini` |
| `OPENAI_IMAGE_MODEL` | Khi dùng OpenAI image | Model tạo ảnh | `gpt-image-1` |
| `OPENAI_TTS_MODEL` | Khi dùng OpenAI TTS | Model speech | `gpt-4o-mini-tts` |
| `OPENAI_TTS_VOICE` | Khi dùng TTS | Voice áp dụng cho toàn bộ request hiện tại | `alloy` |
| `AI_TIMEOUT_MS` | Không | Timeout request AI | `30000` |
| `AI_RETRY_LIMIT` | Không | Số lần retry có kiểm soát | `2` |
| `AI_RETRY_BASE_MS` | Không | Backoff ban đầu | `1000` |
| `AI_PRICING_JSON` | Muốn có cost thật | JSON bảng giá theo provider/model/operation | xem dưới đây |
| `DAILY_AI_BUDGET` | Không | Ngân sách USD/ngày; `0` là tắt giới hạn | `0` |
| `MONTHLY_AI_BUDGET` | Không | Ngân sách USD/tháng; `0` là tắt giới hạn | `0` |
| `YOUTUBE_PROVIDER` | Có | `mock` hoặc provider thật | `mock` |
| `YOUTUBE_CLIENT_ID` | Khi dùng YouTube thật | Google OAuth client ID | để trống trong mock |
| `YOUTUBE_CLIENT_SECRET` | Khi dùng YouTube thật | Google OAuth client secret | để trống trong mock |
| `YOUTUBE_REDIRECT_URI` | Khi dùng YouTube thật | Callback phải khớp Google Console | `https://.../api/youtube/oauth/callback` |
| `YOUTUBE_CREDENTIAL_KEY` | Khi dùng YouTube thật | Khóa mã hóa token lưu trong MongoDB | chuỗi ngẫu nhiên dài |
| `YOUTUBE_OAUTH_STATE_SECRET` | Có cho OAuth production | Khóa ký OAuth state | chuỗi ngẫu nhiên dài |
| `OPENAI_BASE_URL` | Tùy chọn, có trong source | Endpoint OpenAI-compatible | mặc định `https://api.openai.com/v1` |
| `MAX_UPLOAD_SIZE` | Tùy chọn, có trong source | Giới hạn source document theo byte | mặc định 50 MB |
| `MAX_ASSET_SIZE` | Tùy chọn, có trong source | Giới hạn upload asset theo byte cho video endpoint | mặc định 100 MB |

Ví dụ hình dạng `AI_PRICING_JSON`:

```env
AI_PRICING_JSON={"version":"custom","currency":"USD","rules":{"openai:gpt-5.6-luna:lesson_analysis":{"inputPerMillionTokens":0,"outputPerMillionTokens":0,"cachedInputPerMillionTokens":0}}}
```

Phải thay số `0` bằng bảng giá đã tự xác minh. Lookup dùng `provider + model + operation`; thiếu rule sẽ hiển thị chi phí không xác định thay vì bịa số.

`MOCK_AI=true` chỉ dùng để thử pipeline. LLM mock tạo nội dung mẫu, image mock tạo SVG có chữ `MOCK ASSET`, TTS mock tạo âm WAV dạng tone. Mock YouTube không upload và không đánh dấu video là published.

# 5. Đăng nhập

1. Mở `/login`.
2. Nhập email khớp `ADMIN_EMAIL`.
3. Nhập password khớp `ADMIN_PASSWORD`.
4. Chọn **Sign in**. Thành công sẽ chuyển đến `/dashboard` hoặc đường dẫn `next` nội bộ.
5. Để đăng xuất, chọn biểu tượng **Log out** ở cuối sidebar.

Session tồn tại tối đa 7 ngày, được lưu trong MongoDB và cookie `edu_session`. Nếu đăng nhập không thành công:

- Kiểm tra email/password trong `.env` và restart web nếu vừa đổi biến môi trường.
- `ADMIN_PASSWORD` chỉ tạo user ở lần đăng nhập đầu; đổi biến này không tự reset password của admin đã tồn tại.
- Kiểm tra `docker compose ps` và log MongoDB/web.
- Nếu đăng nhập xong vẫn ở `/login`, kiểm tra `APP_URL`, `INTERNAL_APP_URL` và reverse proxy có truyền `X-Forwarded-Proto: https`.
- Session đã logout hoặc hết hạn phải đăng nhập lại; không sửa cookie thủ công.

# 6. Dashboard

Trang `/dashboard` đọc dữ liệu thật từ MongoDB và storage:

- số Subjects, Grades, Textbooks, Lessons, Scripts và Videos;
- số render job đang queued/processing;
- số video có trạng thái published;
- chi phí AI hôm nay/tháng này;
- dung lượng storage;
- số publishing job đang chờ;
- 5 render job gần nhất và tiến độ.

Nút **Create lesson** mở trang Lessons. Nếu dashboard lỗi, dùng **Retry**, sau đó kiểm tra MongoDB và web logs. UI dashboard đã có route/runtime smoke; thao tác trình duyệt tự động chưa được kiểm chứng.

# 7. Quản lý môn học

Mở **Subjects** (`/dashboard/subjects`).

## Tạo môn học

1. Nhập **Name**.
2. Có thể nhập Description và chọn `active`/`archived`.
3. Chọn **Create**.
4. Kết quả: record được lưu MongoDB, slug tự sinh và danh sách refresh.

## Xem, sửa, xóa và tìm kiếm

1. Dùng ô **Search...** hoặc bộ lọc status.
2. Chọn **Edit**, sửa dữ liệu rồi **Save changes**.
3. Để xóa, chọn **Delete**, sau đó chọn **Confirm delete**.
4. Subject đang được textbook tham chiếu sẽ không bị xóa; hãy giữ hoặc archive thay vì phá liên kết.
5. Dùng **Previous/Next** khi có nhiều hơn 20 record.

# 8. Quản lý khối lớp

Mở **Grades** (`/dashboard/grades`).

1. Nhập tên và level nguyên từ 1 đến 12.
2. Chọn status rồi **Create**.
3. Dùng Search/status, Edit và quy trình xác nhận Delete giống Subjects.
4. Level phải duy nhất. Grade đang được textbook tham chiếu không thể xóa.

Không có chức năng gán môn trực tiếp vào grade. Subject và grade được liên kết thông qua Textbook và Lesson.

# 9. Quản lý sách giáo khoa

Mở **Textbooks** (`/dashboard/textbooks`).

1. Tạo Subject và Grade trước.
2. Nhập tên textbook.
3. Chọn Subject và Grade từ dữ liệu MongoDB thật.
4. Có thể nhập Publisher, Edition, Description và status.
5. Chọn **Create**; dùng Edit/Search/status/pagination để quản lý.
6. Textbook đang được Lesson sử dụng không thể xóa.

Trang Textbook hiện **không có upload tài liệu**. Tài liệu nguồn được upload tại Lesson Detail.

# 10. Quản lý bài học

Mở **Lessons** (`/dashboard/lessons`).

## Tạo bài học

1. Chọn Subject và Grade.
2. Chọn Textbook. Khi chọn textbook, UI đồng bộ subject/grade theo textbook.
3. Nhập Lesson title.
4. Có thể nhập Chapter, Lesson number, Objectives, Key concepts, Summary và status.
5. Chọn **Create**.

Subject/grade của lesson phải khớp textbook. Trạng thái hợp lệ là `draft`, `processing`, `ready`, `archived`.

## Chỉnh sửa, xem chi tiết và xóa

- Chọn **Edit** để sửa; **Save changes** để lưu.
- Chọn tên lesson để mở `/dashboard/lessons/[id]`.
- Trang chi tiết chứa thông tin bài học, upload tài liệu, lịch sử phân tích và Script Studio.
- Lesson có source document không thể xóa. Với lesson đã có script/video, hiện chưa có cascade cleanup đầy đủ; nên archive thay vì xóa để tránh orphan record.

# 11. Tài liệu nguồn

Upload ngay trong Lesson Detail hoặc mở trực tiếp `/dashboard/source-documents`.

Định dạng được chấp nhận:

- PDF (`.pdf`, có text layer);
- DOCX (`.docx`);
- TXT (`.txt`);
- PNG (`.png`);
- JPG/JPEG (`.jpg`, `.jpeg`).

Giới hạn mặc định là 50 MB. Hệ thống kiểm tra extension, MIME và file signature.

```text
Upload
  ↓
Kiểm tra loại/kích thước/nội dung
  ↓
Lưu trạng thái UPLOADED → PROCESSING
  ↓
Trích xuất đồng bộ
  ↓
Lưu storage/documents và MongoDB
```

Trạng thái thực tế:

- `UPLOADED`: file đã được lưu.
- `PROCESSING`: đang trích xuất.
- `READY`: đã trích xuất được text.
- `OCR_NOT_CONFIGURED`: ảnh ở real mode đã lưu nhưng chưa có OCR provider.
- `FAILED`: file hợp lệ đã upload nhưng parser/extraction lỗi.

Upload hiện xử lý đồng bộ nên UI thường chỉ kịp thấy trạng thái cuối. Với `MOCK_AI=true`, ảnh thành `READY` nhưng extracted text luôn có nhãn `[MOCK OCR]`; không dùng nội dung này như OCR sản xuất. PDF scan không có text layer thường thành `FAILED`.

# 12. AI phân tích bài học

Trong Lesson Detail, chọn **Analyze lesson**.

AI nhận title, summary, objectives, key concepts, chapter và tối đa 120.000 ký tự từ các source document `READY`. Nếu không có bất kỳ nội dung nào, request bị chặn.

Kết quả hiển thị:

- Summary;
- Objectives;
- Key facts;
- Definitions;
- Công thức;
- Examples;
- Common mistakes;
- Từ khóa;
- Difficulty và provider/model.

Chọn **Regenerate analysis** khi nguồn hoặc lesson thay đổi. Nếu content, provider, model, prompt version và settings giống nhau, hệ thống trả cache hit và không gọi provider. Cache hit vẫn ghi AIUsage với cost 0.

Chọn **Force regenerate** để bỏ qua cache và tạo version mới; thao tác này yêu cầu xác nhận vì có thể phát sinh chi phí. Reload trang vẫn giữ kết quả đã lưu trong MongoDB.

Để dùng OpenAI, cấu hình server `.env`: `MOCK_AI=false`, `AI_LLM_PROVIDER=openai`, `OPENAI_ANALYSIS_MODEL=gpt-5.6-luna`, `OPENAI_API_KEY` và `AI_TIMEOUT_MS=60000`. Không gửi API key vào chat hoặc đặt trong biến `NEXT_PUBLIC_*`. Chạy `docker compose up -d --force-recreate web worker` để áp dụng environment, không xóa volume. `AI_LLM_PROVIDER` là cấu hình LLM sẵn có dùng chung; task này chỉ kiểm chứng bước 6, không thay đổi bước 7.

Provider trên UI lấy từ backend: Mock vẫn có nhãn 🧪 Mock; thiếu key báo AI chưa được cấu hình; kết quả OpenAI lưu đúng provider/model thực tế. Hướng dẫn chỉ coi OpenAI đã kiểm chứng khi có analysis tương ứng trong MongoDB. Không có progress phần trăm giả: khi gọi API chỉ hiển thị đang chờ server.

Tài liệu nguồn phải READY và có text thật; OCR chưa cấu hình hoặc MOCK OCR không được dùng cho OpenAI. Nguồn vượt giới hạn 32.000 token ước lượng bị từ chối, không bị cắt ngẫu nhiên. Hãy chia thành các bài học nhỏ hơn. Lỗi key, timeout, budget và schema được hiển thị để thử lại; dữ liệu sai schema không được lưu.

Trạng thái hiện tại: **REAL AI — PASS**. Đã kiểm chứng OpenAI `gpt-5.6-luna` → Structured Outputs → Zod → MongoDB → UI và reload. Bước 6 hiển thị ✨ OpenAI từ trạng thái backend. Lần thử thật dùng 548 input/379 output tokens trong 9,435 giây; lần hai CACHE HIT. Pricing chưa cấu hình nên chi phí request thật là chưa xác định, không phải 0. Xem [báo cáo và Analysis ID](ai-pipeline.md).

# 13. Tạo kịch bản video

1. Hoàn thành Analysis.
2. Trong **Script Studio**, chọn **Generate script**.
3. Kiểm tra title, hook, narration, CTA, word count, thời lượng, provider/model và version.
4. Chọn **Edit** nếu cần, sửa title/hook/narration/CTA rồi **Save**.
5. Sau khi sửa, script trở về trạng thái `review` và được validation lại.

Kịch bản hướng đến video dọc khoảng 30 giây. Validation yêu cầu hook, narration, CTA và narration ước tính 25–35 giây theo tốc độ 2,85 từ/giây. Tỷ lệ 9:16 được áp dụng ở storyboard/render, không phải một trường chỉnh sửa của script.

# 14. Duyệt kịch bản

Workflow thực tế:

```text
generated/review
      ↓ Approve
approved
      ↓
Storyboard được mở khóa
```

- Chọn **Approve** khi nội dung và thời lượng đúng.
- Chọn **Reject** để đặt trạng thái `rejected`.
- Sau Reject, dùng **Edit** rồi Save hoặc **Regenerate script**, kiểm tra lại và Approve.
- API từ chối approval nếu script không đạt 25–35 giây.
- Chỉ script `approved` hiện nút **Storyboard** và được phép generate scene.

# 15. Storyboard

Scene là một đoạn hình + voice + subtitle theo khoảng thời gian. Mở storyboard từ script đã duyệt.

1. Chọn **Generate scenes**.
2. Hệ thống tạo 5–7 scene không overlap và tổng thời lượng gần bằng script.
3. Mỗi scene hiện có scene number, start/end, narration, visual description, image prompt, subtitle text và asset.
4. Chọn **Edit** để sửa timing/narration/visual/image prompt/subtitle text rồi **Save scene**.
5. Dùng mũi tên lên/xuống để đổi thứ tự.
6. Chọn **Regenerate** để tạo lại storyboard.

UI có edit, reorder và xóa scene khi storyboard vẫn giữ ít nhất 5 scene. API hỗ trợ thêm scene trong giới hạn 5–7; thao tác chỉ hợp lệ khi timing toàn bộ storyboard vẫn liên tục và khớp duration. Animation prompt/transition có field trong model nhưng chưa có control UI đầy đủ. Camera movement chưa triển khai.

# 16. Asset Library

Asset là file dùng cho scene hoặc video: `image`, `audio`, `video`, `music`, `sfx`, `thumbnail`.

Mở **Assets** (`/dashboard/assets`) để:

1. Chọn type.
2. Nhập tags tùy chọn.
3. Chọn file và **Upload**.
4. Search theo filename/prompt hoặc filter theo type.
5. Preview image/audio/video.
6. Xóa asset chưa được sử dụng. Asset đang gắn với scene bị chặn xóa.

Định dạng asset thực tế: PNG/JPG/JPEG/WEBP; MP3/WAV/M4A; MP4/MOV/WEBM. Giới hạn upload UI Asset Library là 100 MB.

Trong Storyboard, **Generate image** hoặc **Generate missing images** sẽ tìm asset cùng cache identity trước; nếu có thì reuse, nếu thiếu thì gọi image provider. Người dùng cũng có thể chọn ảnh có sẵn và **Assign**; assignment thay asset cùng loại thay vì gắn chồng.

# 17. Character Profile

Mở **Characters** (`/dashboard/characters`) để tạo, sửa, archive, tìm kiếm và xóa profile chưa được scene sử dụng. Khi edit scene, chọn Character; appearance/visual style được đưa vào image prompt và cache key. Profile đang được scene tham chiếu phải archive thay vì xóa. API/model hỗ trợ `referenceAssets`, nhưng UI chọn reference image hiện chưa có.

# 18. Style Preset

Mở **Styles** (`/dashboard/styles`) để tạo, sửa, archive và xóa preset chưa được scene sử dụng. Chọn preset trong editor scene; prompt prefix, negative prompt và aspect ratio được đưa vào request/cache hình ảnh. Tên preset phải duy nhất.

# 19. Tạo giọng đọc TTS

Trong Storyboard:

1. Kiểm tra narration của từng scene.
2. Chọn **Generate voice**.
3. Hệ thống tạo một audio asset cho mỗi scene.
4. Preview bằng audio control dưới scene.
5. **Generate/reuse voice** dùng cache; **Regenerate voice** buộc provider chạy lại và thay voice cũ trong scene.

Voice/model lấy từ `.env`; UI chưa cho chọn voice theo từng request. Môi trường hiện tại dùng mock tone WAV, không phải giọng đọc thật. OpenAI TTS có adapter nhưng `NOT_CONFIGURED` và chưa được real-provider test.

# 20. Subtitle

Trong Video Studio, chọn **Edit subtitles** để sửa từng scene, **Save subtitles** để lưu vào Scene và file SRT, hoặc **Generate SRT** để tạo lại từ storyboard. Worker tạo snapshot SRT và burn nội dung vào MP4 khi render.

- SRT: `IMPLEMENTED_AND_VERIFIED`.
- Chỉnh style subtitle từ UI: `NOT_IMPLEMENTED`.
- ASS: `NOT_IMPLEMENTED`.
- Preview file SRT trước render: đã hỗ trợ; overlay video xuất hiện sau render.

# 21. Render Video

Trước khi render, mỗi scene phải có một image asset và một audio asset hợp lệ.

```text
Storyboard + scene images + scene voices + SRT + music/SFX tùy chọn
                       ↓
                 FFmpeg worker
                       ↓
                      MP4
```

Trong Storyboard chọn **Open Video Studio**, sau đó chọn **Render video**. Job được đưa vào MongoDB để worker claim.

Thông số renderer hiện tại:

- 1080 × 1920;
- tỷ lệ 9:16;
- 30 fps;
- H.264 (`libx264`), pixel format `yuv420p`;
- AAC 128 kbps, resample 48 kHz;
- thời lượng tổng 25–35 giây;
- SRT được burn-in.

Render settings width/height/FPS/subtitle margin lấy từ Settings, được snapshot vào RenderJob rồi worker áp dụng. Music toàn video được lặp, đặt 12%, fade in/out; SFX theo scene đặt 25%; mixer dùng limiter để giảm clipping. Runtime music/SFX đã được ffprobe xác nhận với video 33,334 giây, H.264/AAC.

# 22. Render Queue

Mở **Render Queue** (`/dashboard/render-queue`). Trang hiển thị tối đa 50 job gần nhất, progress, current step, retry count, error và worker logs.

Trạng thái:

- `queued`: đang chờ worker;
- `processing`: FFmpeg đang xử lý;
- `completed`: đã có MP4/SRT;
- `failed`: hết retry hoặc lỗi không xử lý được;
- `cancelled`: đã hủy.

Thao tác:

- **Open video** để quay về Video Studio.
- **Cancel** cho queued/processing job. Job đang chạy nhận cancellation request và FFmpeg được terminate an toàn.
- **Retry** chỉ hiện với failed job.

Worker có heartbeat/lease. Nếu worker chết khi giữ job, job stale được đưa lại queue để worker khác nhận; người dùng không cần chỉnh database.

# 23. Video Studio

Mở từ Storyboard hoặc Render Queue tại `/dashboard/videos/[id]`.

- Xem status, duration và render progress.
- Xem scene timeline, ảnh, narration và preview voice.
- Preview MP4 khi render hoàn tất.
- Mở file SRT.
- Generate/edit/save SRT và download MP4.
- Chọn background music/SFX đã upload trong phần **Audio mix**.
- Tìm/filter video tại `/dashboard/videos`; xóa có kiểm soát chỉ khi video không rendering/published.
- Chọn Render lại với video rejected/failed hoặc khi cần phiên bản mới.
- Khi status là `ready_for_review`, chọn **Approve** hoặc **Reject**.
- Khi approved, link **Publish to YouTube** xuất hiện.

Trang/API đã qua runtime route smoke và backend E2E; thao tác click/preview bằng browser automation chưa chạy.

# 24. Duyệt video

```text
rendering
   ↓ worker hoàn tất
ready_for_review
   ↓ Approve
approved
   ↓
được phép mở publish
```

Nếu chọn **Reject**, video thành `rejected`. Kiểm tra scene/image/voice/subtitle, sửa tại Storyboard nếu cần rồi chọn **Render again**. API không cho approve nếu video chưa có output hoặc chưa ở `ready_for_review`.

# 25. YouTube

## Trạng thái hiện tại

`MOCK_ONLY / REAL NOT_CONFIGURED`. Mock publish trả `published:false`, không tạo channel/token giả và giữ video ở trạng thái `approved`.

Code có OAuth, mã hóa token, kiểm tra channel và upload multipart, nhưng chưa có credentials và chưa real-provider test. Vì vậy tính năng production hiện chưa khả dụng.

Khi quản trị viên cấu hình Google credentials trong tương lai:

1. Mở **YouTube** (`/dashboard/youtube`).
2. Chọn **Connect YouTube**. Khi credentials thật có mặt, trình duyệt chuyển trực tiếp tới Google OAuth; mock mode chỉ báo NOT_CONFIGURED.
3. Sau OAuth callback hợp lệ, channel được lưu và token được mã hóa/select-hidden.
4. Với video `approved`, mở **Publish to YouTube**.
5. Chọn channel và privacy rồi **Publish**.

Privacy:

- `private`: mặc định và an toàn nhất;
- `unlisted`: ai có link có thể xem;
- `public`: công khai; UI bắt buộc tick xác nhận rõ ràng.

UI publish có override title, description và tags. Thumbnail upload/publish chưa hoàn thiện.

# 26. Batch Processing

Mở **Batch** (`/dashboard/batch`). Feature hiện `PARTIAL`.

1. Tick từ 1 đến 100 lessons.
2. Chọn **Start batch**.
3. Mỗi lesson nhận chuỗi job Analysis → Script → chờ script approval → Storyboard → Assets → TTS → Render → chờ video approval → YouTube.
4. Xem counts theo trạng thái ở Recent batches.
5. **Pause** ngăn worker claim job mới; job an toàn đang chạy có thể hoàn tất.
6. **Resume** tiếp tục claim.
7. **Cancel** hủy queued job và yêu cầu job/FFmpeg đang chạy dừng.
8. **Retry failed** đưa failed/blocked job về queue phù hợp.

Dependency, pause/resume/cancel, retry/failure và stale recovery đã được kiểm tra. Test điều khiển batch với 3 lessons/21 jobs đã pass; full 3-video qua cả hai approval gate chưa chạy. Khi YouTube chưa cấu hình, bước publish không thể hoàn tất production.

# 27. AI Cost & Usage

Mở **AI Cost** (`/dashboard/analytics/cost`). Trang hiển thị:

- cost hôm nay và tháng này;
- daily/monthly budget;
- số cache hit trên tổng request;
- average cost trên video hoàn tất trong tháng;
- số record có cost chưa xác định;
- tổng hợp request/cache/cost theo provider, model và operation.

```text
Request có cùng content + provider + model + prompt version + settings
                            ↓
                         Cache hit
                            ↓
                   Không gọi AI lần nữa
                            ↓
                         Cost = 0
```

AIUsage ghi provider, model, operation, status, cached, estimatedCost và duration. Khi provider không trả usage, hệ thống không bịa token count. Nếu `AI_PRICING_JSON` chưa cấu hình, mock vẫn có cost 0 còn real unknown pricing hiển thị unknown.

# 28. AI Budget

Đặt trong `.env`:

```env
DAILY_AI_BUDGET=0
MONTHLY_AI_BUDGET=0
```

`0` nghĩa là tắt giới hạn. Giá trị dương là USD theo bảng pricing đã cấu hình. Khi tổng cost đã đạt hạn mức, request bị chặn trước provider call và AIUsage nhận status `blocked_budget`.

UI Settings chỉ hiển thị budget; chưa cho chỉnh budget. Muốn đổi, sửa `.env` và recreate web/worker:

```bash
docker compose up -d --force-recreate web worker
```

# 29. Analytics

- Dashboard: số record, render queue, published video, cost và storage.
- AI Cost: request/cache/cost/budget theo AIUsage.
- YouTube Analytics (`/dashboard/analytics`): views, likes, comments và thời điểm fetch của snapshot thật.

Trong mock mode, **Sync analytics** chỉ trả preview 0 và không lưu vào dữ liệu thật. Watch time, retention, subscribers có field trong model nhưng API sync/UI hiện chưa populate/hiển thị đầy đủ. Real YouTube analytics là `NOT_CONFIGURED`.

# 30. Backup & Restore

Các script đã được runtime verify.

## Backup

```bash
scripts/backup-mongodb.sh
```

Archive và metadata được tạo trong `backups/`.

## Restore an toàn vào database kiểm tra riêng

```bash
scripts/restore-mongodb.sh backups/mongodb-YYYYMMDD-HHMMSS.archive ai_education_video_factory_regression_restore_YYYYMMDD_HHMMSS
```

Script từ chối restore đè active database và yêu cầu tên target chứa `_regression_restore_`.

> Luôn backup trước khi restore. Không dùng `docker compose down -v`, `docker volume rm` hoặc `dropDatabase()` để xử lý lỗi thông thường. Không restore trực tiếp lên production database đang dùng.

# 31. Storage

File host nằm trong `storage/` và được bind-mount chung vào `/app/storage` của web/worker.

```text
storage/
├── audio/
├── documents/
├── images/
├── logs/
├── subtitles/
├── temp/
├── textbooks/
├── thumbnails/
└── videos/
```

- Source upload: `documents/`.
- Image/generated placeholder: `images/`.
- TTS, music, SFX upload: `audio/`.
- MP4: `videos/`.
- SRT: `subtitles/`.
- File tạm FFmpeg: `temp/`, được dọn sau render.
- Cache metadata AI nằm trong MongoDB hoặc được suy ra từ file/hash; không có thư mục `storage/cache`.

Storage đã được kiểm tra vẫn tồn tại sau restart web/worker. MongoDB nằm trong named volume riêng. Không xóa `storage/` hoặc volume khi chưa backup.

# 32. Xử lý lỗi thường gặp

| Lỗi | Nguyên nhân thường gặp | Cách xử lý an toàn |
| --- | --- | --- |
| Login failed | Sai admin env, user disabled hoặc MongoDB lỗi | Kiểm tra `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `docker compose ps` và web/Mongo logs; restart web sau khi đổi env |
| Login thành công nhưng quay lại login | Sai `APP_URL`/`INTERNAL_APP_URL`, proxy thiếu HTTPS header | Dùng `INTERNAL_APP_URL=http://web:3000`; kiểm tra reverse proxy và cookie Secure |
| MongoDB connection failed | URI/user/password/authSource sai hoặc MongoDB chưa healthy | Kiểm tra `.env`, `docker compose ps`, `docker compose logs mongodb web worker`; không xóa volume |
| Upload failed | Quá 50 MB, extension/MIME/signature không khớp | Dùng đúng PDF/DOCX/TXT/PNG/JPG/JPEG và file không hỏng |
| PDF status FAILED | PDF scan hoặc không có text layer | Chuyển sang PDF có text, DOCX/TXT; OCR hiện chưa cấu hình |
| AI request failed | Provider/key/model sai, timeout hoặc schema trả về sai | Xem Settings/provider status và logs; dùng mock để kiểm tra pipeline, không coi mock là output thật |
| Budget exceeded | Daily/monthly cost đã đạt ngưỡng | Kiểm tra AI Cost và pricing; chờ kỳ mới hoặc điều chỉnh budget có chủ đích |
| TTS failed | Thiếu storyboard, key/model/voice sai | Tạo storyboard trước; kiểm tra provider env và logs |
| Render không bắt đầu | Thiếu image/voice, scene count hoặc duration sai | Đảm bảo 5–7 scene, mỗi scene có image+audio, tổng 25–35 giây và worker `ok` |
| Render failed | Media hỏng, FFmpeg lỗi hoặc worker dừng | Xem Render Queue logs; kiểm tra worker/FFmpeg rồi dùng Retry |
| Render bị đứng | Worker mất heartbeat hoặc lease | Kiểm tra worker logs; restart worker, stale job sẽ được recovery |
| YouTube OAuth failed | Credentials/callback/state sai | Hiện real provider chưa cấu hình; kiểm tra Google Console redirect URI và server env khi triển khai |
| Video không publish | Chưa approved, thiếu MP4/channel hoặc đang mock | Render và Approve trước; mock luôn trả `published:false` |

# 33. Kiểm tra hệ thống

Trạng thái tại lần kiểm chứng gần nhất:

- [x] Docker Compose config/build hoạt động.
- [x] MongoDB healthy và app-user đọc/ghi được.
- [x] Web trả health/login/dashboard routes.
- [x] Worker heartbeat và polling hoạt động.
- [x] FFmpeg render được H.264/AAC 1080×1920.
- [x] Login/session/logout hoạt động.
- [x] TXT upload/extraction runtime hoạt động; PDF/DOCX extraction có test.
- [x] AI mock hoạt động và ghi AIUsage/cache.
- [x] TTS mock tạo audio đọc được.
- [x] Render mock pipeline tạo MP4 đọc được.
- [x] OpenAI Lesson Analysis thật: PASS; không suy ra các bước LLM/Image/TTS khác đã được kiểm chứng.
- [x] Mock OCR ảnh có nhãn rõ; OCR thật: `NOT_CONFIGURED`.
- [ ] YouTube OAuth/upload thật: `NOT_CONFIGURED`.
- [ ] Browser automation toàn bộ form/preview: `CHƯA VERIFY`.
- [x] Batch 3 lessons pause/resume/cancel đã kiểm chứng.
- [ ] Full 3-video qua approval gates: `CHƯA VERIFY`.

Lệnh kiểm tra nhanh:

```bash
docker compose ps
curl http://localhost:3000/api/health
docker compose exec -T worker ffmpeg -version
docker compose logs --tail=100 web worker mongodb
```

# 34. Quy trình tạo video hoàn chỉnh

## Từ bài học đến video YouTube Short

1. **Login** — mở `/login`, nhập admin env. Kết quả: dashboard hiện ra. Nếu lỗi, kiểm tra MongoDB và session config.
2. **Tạo Subject** — mở Subjects, nhập tên, Create. Kết quả: môn xuất hiện trong danh sách.
3. **Tạo Grade** — nhập tên/level 1–12. Kết quả: khối được lưu.
4. **Tạo Textbook** — chọn đúng Subject/Grade, nhập tên. Kết quả: textbook có thể chọn khi tạo lesson.
5. **Tạo Lesson** — chọn đúng ba quan hệ, nhập title/summary/objectives/concepts. Kết quả: mở được Lesson Detail.
6. **Upload source** — dùng TXT/DOCX/PDF có text. Kết quả mong đợi: `READY` và số ký tự lớn hơn 0. Ảnh trong mock mode trả `[MOCK OCR]`; real mode trả `OCR_NOT_CONFIGURED`.
7. **Analyze lesson** — chọn Analyze. Kết quả: analysis v1 và provider/model xuất hiện. Nếu báo thiếu nội dung, bổ sung summary/source.
8. **Generate script** — chọn Generate script. Kết quả: script 25–35 giây. Nếu validation lỗi, chỉnh narration/hook/CTA.
9. **Review script** — đọc nội dung, word count, duration; dùng Edit nếu cần.
10. **Approve script** — chọn Approve. Kết quả: link Storyboard xuất hiện.
11. **Generate storyboard** — tạo 5–7 scene. Kết quả: timing liên tục, không overlap.
12. **Review scene** — sửa narration/visual/image prompt/subtitle trước khi tốn chi phí media.
13. **Generate images** — chọn Generate missing images. Kết quả hiện tại: mock SVG hoặc real image nếu provider thật đã cấu hình.
14. **Generate TTS** — chọn Generate voice. Kết quả hiện tại: mock WAV có thể preview.
15. **Open Video Studio** — kiểm tra từng scene có image và voice; tùy chọn music/SFX, generate/edit SRT.
16. **Render video** — chọn Render video. Kết quả: Render Queue chạy đến `completed`; nếu fail, mở logs.
17. **Review video** — xem/download MP4, nghe audio, mở SRT.
18. **Approve hoặc Reject** — chỉ Approve khi output đúng. Reject rồi sửa/render lại nếu cần.
19. **YouTube** — production hiện `NOT_CONFIGURED`. Trong mock mode, Publish chỉ kiểm tra gate và trả thông báo mock, không upload thật.

Phần 1–18 đã qua backend/runtime E2E ở mock mode. Việc click toàn bộ bằng browser automation chưa được kiểm chứng.

# 35. Workflow khuyến nghị

1. Chuẩn hóa title, summary, objectives và key concepts.
2. Upload source có text sạch.
3. Chạy Analysis một lần rồi đọc kết quả.
4. Generate script và sửa trước khi approve.
5. Chỉ tạo Storyboard sau khi script đã ổn định.
6. Review timing, narration và image prompt.
7. Cho hệ thống reuse Asset Library/cache trước.
8. Chỉ generate ảnh còn thiếu.
9. Generate TTS sau khi narration scene đã chốt.
10. Render bằng FFmpeg local.
11. Review MP4/SRT rồi mới approve.
12. Chỉ upload YouTube sau khi real OAuth đã được cấu hình và kiểm chứng.

> Không nên generate hình ảnh hoặc TTS trước khi script và storyboard được duyệt. Mỗi thay đổi narration/voice/model có thể tạo cache miss và chi phí mới.

# 36. FAQ

## Tại sao AI không chạy?

Kiểm tra Settings. Nếu provider là OpenAI nhưng key trống, hệ thống trả `NOT_CONFIGURED`. Dùng `MOCK_AI=true` để kiểm tra pipeline hoặc cấu hình key thật; không trộn kết quả mock vào nội dung production.

## Mock AI là gì?

Là provider local có output định dạng đúng để test flow. Hình có chữ MOCK, giọng là tone WAV, YouTube không upload.

## Làm sao chuyển sang OpenAI thật?

Đặt `MOCK_AI=false`, chọn các `AI_*_PROVIDER=openai`, cấu hình key/model/pricing rồi recreate web và worker. Real provider chưa được kiểm chứng trong môi trường hiện tại, nên hãy thử trên dữ liệu không quan trọng trước.

## Vì sao render lâu?

Worker render từng scene, ghép video rồi burn subtitle. Kiểm tra progress và logs trong Render Queue; không tạo job render trùng cho cùng video.

## Vì sao không upload được YouTube?

Video phải `approved`, có MP4 và channel thật. Môi trường hiện tại chưa có credentials; mock luôn không publish.

## Cache hoạt động thế nào?

Cache phụ thuộc provider, model, prompt version, content và generation settings. Đổi model, voice, prompt hoặc nội dung sẽ tạo cache miss.

## Làm sao giảm chi phí?

Chốt source/script/storyboard trước media generation, reuse asset/cache, đặt budget và cấu hình pricing chính xác.

## File upload nằm ở đâu?

Trong `storage/documents`; image/audio/video/subtitle nằm ở thư mục tương ứng.

## Restart Docker có mất dữ liệu không?

Restart web/worker không làm mất bind-mounted storage hoặc named Mongo volume. Không dùng `down -v`.

## Làm sao backup?

Chạy `scripts/backup-mongodb.sh`; restore chỉ vào database kiểm tra riêng theo phần Backup & Restore.

## Có thể tạo Character Profile hoặc Style Preset không?

Có. Mở **Characters** hoặc **Styles**, tạo profile/preset rồi chọn trong editor scene trước khi generate ảnh. Record đang được scene sử dụng phải archive thay vì xóa.

# 37. Trạng thái tính năng hiện tại

| Module | Status | Ghi chú |
| --- | --- | --- |
| Authentication | IMPLEMENTED_AND_VERIFIED | Login/session/logout, secure cookie và redirect fix đã runtime test |
| Dashboard | IMPLEMENTED_BUT_NOT_VERIFIED | Dữ liệu thật/API và route smoke pass; chưa browser automation |
| Subject | IMPLEMENTED_BUT_NOT_VERIFIED | CRUD/search/filter/pagination backend pass; UI chưa automation |
| Grade | IMPLEMENTED_BUT_NOT_VERIFIED | CRUD và level validation; UI chưa automation |
| Textbook | IMPLEMENTED_BUT_NOT_VERIFIED | Quan hệ thật và safe delete; UI chưa automation |
| Lesson | IMPLEMENTED_BUT_NOT_VERIFIED | CRUD/detail/backend E2E; delete pipeline chưa cascade đầy đủ |
| Source Document | IMPLEMENTED_AND_VERIFIED | TXT runtime, PDF/DOCX tests, MIME guard; Mock OCR có nhãn, OCR thật NOT_CONFIGURED |
| AI Analysis | REAL_AI_VERIFIED | OpenAI gpt-5.6-luna, Structured Outputs/Zod, MongoDB, cache, usage, UI/reload và nhãn bước 6 PASS. Pricing chưa cấu hình. |
| Script | IMPLEMENTED_AND_VERIFIED (MOCK AI) | Generate/validation/approval gate runtime test |
| Storyboard | IMPLEMENTED_AND_VERIFIED (MOCK AI) | Generate/cache/timing, edit/reorder/delete và profile/style integration |
| Asset | IMPLEMENTED_AND_VERIFIED (MOCK generation) | Upload/preview/cache/manual assignment/reuse pass |
| Character Profile | IMPLEMENTED_BUT_NOT_VERIFIED | Create + scene integration runtime pass; browser edit/delete chưa automation |
| Style Preset | IMPLEMENTED_BUT_NOT_VERIFIED | Create + image/cache integration runtime pass; browser edit/delete chưa automation |
| TTS | MOCK_ONLY | WAV/cache/preview pass; real TTS NOT_CONFIGURED |
| Subtitle | IMPLEMENTED_AND_VERIFIED | Generate/edit/save SRT + burn-in; không có ASS/style editor |
| Render | IMPLEMENTED_AND_VERIFIED | MP4 H.264/AAC và music/SFX fade/limiter verified |
| Render Queue | IMPLEMENTED_BUT_NOT_VERIFIED | API/worker runtime pass; UI chưa browser automation |
| Video Studio | IMPLEMENTED_BUT_NOT_VERIFIED | Preview/status/approval backend pass; UI chưa automation |
| YouTube | MOCK_ONLY | Gate/mock safety pass; OAuth/upload thật NOT_CONFIGURED |
| Batch | PARTIAL | 3-lesson controls/recovery pass; full 3-video gated completion chưa chạy |
| AI Cost/Budget | IMPLEMENTED_AND_VERIFIED | Mock usage/cache/budget tests pass; pricing thật chưa cấu hình |
| Analytics | PARTIAL | Mock preview không persist; YouTube sync thật NOT_CONFIGURED |
| Settings | IMPLEMENTED_AND_VERIFIED | Defaults được snapshot và áp dụng vào FFmpeg; provider status không lộ secret |
| Backup | IMPLEMENTED_AND_VERIFIED | Backup + isolated restore pass |
| Browser E2E | CHƯA VERIFY | HTTP route smoke/backend E2E đã pass, chưa có browser engine |
| Interactive Help | IMPLEMENTED_BUT_NOT_VERIFIED | Route, responsive UI, local progress và links đã static/build test; chưa browser automation |

# 38. Lưu ý chính xác và an toàn

- Trang quản trị và API dưới `/dashboard`/`/api` yêu cầu session, ngoại trừ health/login/session và OAuth callback.
- Mongo Express chỉ có trong development Compose và mở cổng 8081; production Compose không có Mongo Express và không publish MongoDB.
- Không đưa API key, session secret, YouTube token hoặc Mongo password lên frontend/log/tài liệu.
- Settings hiện chỉ lưu giá trị không bí mật. Secret vẫn phải nằm trong environment.
- Không dùng dữ liệu E2E mock làm nội dung production.
- Project hiện có production build/runtime mock pass nhưng tổng thể vẫn **NOT READY** vì real provider, YouTube, browser E2E và full 3-video approval-gated batch chưa được kiểm chứng.

## Chọn VieNeu-TTS và tạo giọng đọc tiếng Việt

Đặt `TTS_PROVIDER=vieneu`, `MOCK_AI=false` trong `.env`, chạy `docker compose up -d --build` và đợi `tts` healthy. Giữ các cấu hình MongoDB hiện có. Trong Storyboard hoặc Video Studio, chọn Voice từ danh sách VieNeu rồi Generate/reuse voice. Job chạy ở worker; giao diện hiện Generating và tự cập nhật. Khi hoàn tất, nghe bằng audio player; thời lượng, kHz và provider hiển thị dưới player. Regenerate tạo bản mới, Retry chạy lại job lỗi, Cancel ngăn gắn kết quả đang tạo. Phụ đề được cập nhật theo thời lượng audio; sau đó chọn Render video. Xem [TTS](tts.md) để xử lý lỗi. Speed và upload voice cloning chưa được bật.
