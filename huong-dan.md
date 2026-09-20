# TASK: TẠO TÀI LIỆU HƯỚNG DẪN SỬ DỤNG

Bạn đang làm việc trên project **AI Education Video Factory**.

Hãy kiểm tra TOÀN BỘ source code hiện tại và tạo tài liệu hướng dẫn sử dụng thực tế cho người dùng.

## 1. MỤC TIÊU

Tạo file:

```text
docs/USER_GUIDE.md
```

Nếu project đã có tài liệu hướng dẫn người dùng thì:

* Đọc và đánh giá tài liệu hiện tại.
* Không xóa nội dung hữu ích.
* Cập nhật lại toàn bộ theo chức năng thực tế hiện tại.
* Không mô tả những chức năng chưa tồn tại như thể đã hoàn thành.

Tài liệu phải giúp một người **không cần biết code** có thể sử dụng hệ thống từ đầu đến cuối.

---

# 2. NGUYÊN TẮC QUAN TRỌNG

## KHÔNG ĐƯỢC BỊA CHỨC NĂNG

Trước khi viết tài liệu:

1. Scan toàn bộ project.
2. Kiểm tra:

   * Routes
   * API
   * Pages
   * Components
   * Database models
   * Upload
   * AI providers
   * Worker
   * Render
   * YouTube
   * Settings
   * Queue
3. Xác định chức năng nào thực sự hoạt động.
4. Chạy test/build/typecheck/lint nếu có thể.
5. Chỉ mô tả chức năng có bằng chứng từ source code hoặc đã kiểm chứng runtime.

Phân loại:

```text
IMPLEMENTED_AND_VERIFIED
IMPLEMENTED_BUT_NOT_VERIFIED
PARTIAL
MOCK_ONLY
UI_ONLY
API_ONLY
NOT_IMPLEMENTED
BROKEN
```

Nếu chức năng chưa hoàn thiện, ghi rõ:

> Tính năng này hiện chưa khả dụng / đang phát triển.

Không được viết:

> Bạn có thể sử dụng...

nếu thực tế chức năng chưa hoạt động.

---

# 3. CẤU TRÚC USER_GUIDE.md

Tạo tài liệu có cấu trúc sau.

---

# AI Education Video Factory

## Hướng dẫn sử dụng

Giới thiệu ngắn:

* Hệ thống dùng để làm gì?
* Đối tượng sử dụng.
* Quy trình tổng quát.
* Kết quả cuối cùng người dùng nhận được.

---

# 1. Tổng quan hệ thống

Giải thích đơn giản:

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
Storyboard
   ↓
Assets
   ↓
TTS
   ↓
Subtitle
   ↓
Render video
   ↓
Duyệt video
   ↓
YouTube
```

Giải thích từng bước bằng ngôn ngữ dễ hiểu.

---

# 2. Yêu cầu hệ thống

Nêu chính xác yêu cầu dựa trên project hiện tại.

Ví dụ:

* macOS / Windows / Linux
* Docker
* MongoDB
* FFmpeg
* Node.js nếu cần
* Browser
* Disk space
* API keys nếu cần

Không tự đặt version nếu source code không xác định.

Phân biệt:

### Chạy bằng Docker

```bash
docker compose up -d
```

### Chạy development

```bash
npm install
npm run dev
```

Chỉ đưa command nếu command thực sự tồn tại trong project.

---

# 3. Cài đặt lần đầu

Hướng dẫn từng bước:

1. Clone project.
2. Cấu hình `.env`.
3. Khởi động MongoDB.
4. Khởi động web.
5. Khởi động worker.
6. Kiểm tra health.
7. Mở trình duyệt.
8. Đăng nhập.

Nếu project có Docker Compose thì ưu tiên hướng dẫn Docker.

---

# 4. Cấu hình Environment

Liệt kê các biến môi trường thực tế đang được project sử dụng.

Ví dụ:

```env
MONGODB_URI=
JWT_SECRET=
OPENAI_API_KEY=
...
```

Không được invent biến môi trường.

Với mỗi biến:

| Variable | Bắt buộc | Ý nghĩa | Ví dụ |
| -------- | -------- | ------- | ----- |
| ...      | ...      | ...     | ...   |

Đặc biệt giải thích:

* Mock AI
* Real AI
* AI pricing
* Budget
* Storage
* YouTube
* OAuth
* MongoDB

Nếu có:

```env
MOCK_AI=true
```

phải giải thích rõ:

> Mock mode chỉ dùng để test pipeline, không tạo kết quả AI thực tế.

---

# 5. Đăng nhập

Hướng dẫn:

1. Mở trang login.
2. Nhập username/email.
3. Nhập password.
4. Login.
5. Logout.

Nếu có tài khoản mặc định, chỉ ghi nếu source code thực sự có.

Giải thích lỗi thường gặp:

* Sai password
* Session hết hạn
* MongoDB không kết nối
* Cookie/session lỗi

---

# 6. Dashboard

Giải thích từng thành phần Dashboard.

Ví dụ:

* Tổng số bài học
* Tổng video
* Render queue
* AI usage
* Cost
* Batch jobs
* Analytics

Chỉ mô tả những gì thực tế tồn tại.

---

# 7. Quản lý môn học

Hướng dẫn đầy đủ:

## Tạo môn học

## Xem môn học

## Sửa môn học

## Xóa môn học

## Tìm kiếm/lọc

Nếu có.

Mỗi thao tác cần:

```text
Bước 1
Bước 2
Bước 3
Kết quả
```

---

# 8. Quản lý khối lớp

Hướng dẫn:

* Tạo khối
* Sửa
* Xóa
* Liên kết môn học
* Sử dụng trong bài học

---

# 9. Quản lý sách giáo khoa

Hướng dẫn:

* Tạo textbook
* Chọn môn
* Chọn khối
* Nhập thông tin
* Upload tài liệu nếu có
* Quản lý tài liệu

---

# 10. Quản lý bài học

Đây là phần quan trọng.

Hướng dẫn:

## Tạo bài học

Thông tin cần nhập.

## Chỉnh sửa bài học

## Xóa bài học

## Xem chi tiết

## Liên kết tài liệu nguồn

## Bắt đầu tạo video

Giải thích trạng thái bài học nếu có.

---

# 11. Tài liệu nguồn

Hướng dẫn upload:

* PDF
* DOCX
* TXT
* Image

Chỉ liệt kê format mà code thực sự hỗ trợ.

Giải thích:

```text
Upload
 ↓
Validate file
 ↓
Extract text / OCR
 ↓
Processing
 ↓
Ready
```

Giải thích trạng thái:

```text
UPLOADED
PROCESSING
READY
FAILED
```

nếu các trạng thái này thực sự tồn tại.

---

# 12. AI phân tích bài học

Giải thích:

* AI nhận dữ liệu gì?
* AI phân tích gì?
* Kết quả nằm ở đâu?
* Khi nào nên chạy lại?
* Có cache không?
* Có tốn AI credit không?

Ví dụ:

```text
Lesson
 ↓
AI Analysis
 ↓
Learning objectives
 ↓
Key concepts
 ↓
Difficulty
 ↓
Teaching points
```

Không tự thêm field nếu project không có.

---

# 13. Tạo kịch bản video

Hướng dẫn:

1. Chọn bài học.
2. Chạy Generate Script.
3. Chờ AI.
4. Kiểm tra script.
5. Chỉnh sửa nếu được hỗ trợ.
6. Approve script.

Giải thích yêu cầu video:

* YouTube Shorts
* 9:16
* khoảng 30 giây
* narration
* hook
* nội dung chính
* conclusion/CTA nếu có.

Nếu hệ thống có validation thời lượng, giải thích nó.

---

# 14. Duyệt kịch bản

Giải thích:

```text
Draft
 ↓
Review
 ↓
Approve
 ↓
Storyboard
```

Nếu reject:

```text
Reject
 ↓
Edit
 ↓
Generate/Update
 ↓
Approve
```

Chỉ mô tả workflow thực tế.

---

# 15. Storyboard

Giải thích:

* Scene là gì?
* Mỗi scene chứa gì?
* Duration
* Narration
* Visual description
* Asset
* Transition
* Camera movement

Nếu có AI tạo storyboard thì giải thích.

---

# 16. Asset Library

Giải thích:

### Asset là gì?

Ví dụ:

* Character
* Background
* Object
* Illustration
* Image

Hướng dẫn:

* Upload asset
* Xem asset
* Search
* Filter
* Reuse
* Gán asset vào scene
* Generate asset bằng AI nếu hỗ trợ

---

# 17. Character Profile

Nếu hệ thống có:

* Tạo character
* Tên
* Mô tả
* Visual style
* Reference image
* Reuse character

Giải thích tại sao nên tái sử dụng character để giảm chi phí AI.

---

# 18. Style Preset

Nếu có:

* Tạo style
* Chọn style
* Reuse style
* Áp dụng cho storyboard/assets.

---

# 19. Tạo giọng đọc TTS

Giải thích:

```text
Script
 ↓
TTS
 ↓
Audio
```

Hướng dẫn:

* Chọn voice
* Generate
* Preview
* Regenerate
* Cache

Giải thích rõ:

* Mock TTS nếu có.
* Real TTS nếu cấu hình provider.
* Chi phí nếu có tracking.

---

# 20. Subtitle

Hướng dẫn:

* Generate subtitle
* Preview
* Chỉnh sửa nếu có
* Format
* Style
* Burn vào video nếu hệ thống hỗ trợ.

Nếu hỗ trợ SRT/ASS thì ghi chính xác.

---

# 21. Render Video

Giải thích:

```text
Storyboard
+ Assets
+ Audio
+ Subtitle
        ↓
      FFmpeg
        ↓
      Video
```

Thông số video thực tế:

* Resolution
* FPS
* Codec
* Audio codec
* Duration
* Aspect ratio

Không tự đặt thông số nếu source code khác.

---

# 22. Render Queue

Giải thích:

* Job pending
* Processing
* Completed
* Failed
* Retry
* Cancel

Nếu có:

* lease
* heartbeat
* retry
* stale job recovery

thì giải thích ở mức người dùng, không cần giải thích code.

---

# 23. Video Studio

Hướng dẫn:

* Xem video
* Preview
* Kiểm tra subtitle
* Kiểm tra audio
* Approve
* Reject
* Render lại

---

# 24. Duyệt video

Workflow:

```text
Rendered
 ↓
Review
 ↓
Approve
 ↓
Ready to publish
```

Nếu reject thì hướng dẫn quy trình xử lý.

---

# 25. YouTube

Nếu tính năng đã hoạt động:

## Kết nối YouTube

Hướng dẫn OAuth từng bước.

## Chọn channel

## Upload video

## Metadata

* Title
* Description
* Tags
* Thumbnail
* Privacy

Đặc biệt giải thích:

```text
private
unlisted
public
```

Nếu default là private thì phải nói rõ.

Nếu YouTube chưa cấu hình production:

> Tính năng này hiện chỉ có adapter/mã nguồn nhưng chưa thể sử dụng production.

Không được mô tả là đã hoạt động nếu chưa verify.

---

# 26. Batch Processing

Nếu có:

Giải thích cách tạo batch:

```text
Lesson 1
Lesson 2
Lesson 3
      ↓
Batch
      ↓
AI Analysis
      ↓
Script
      ↓
Storyboard
      ↓
TTS
      ↓
Render
```

Giải thích:

* Start
* Pause
* Resume
* Cancel
* Retry
* Progress
* Failed jobs

Nếu dependency chain chưa hoàn thiện thì phải ghi rõ.

---

# 27. AI Cost & Usage

Giải thích cho người dùng:

* AI usage là gì?
* LLM usage
* Image usage
* TTS usage
* Estimated cost
* Cache hit
* Budget limit

Giải thích cache:

```text
Request giống nhau
       ↓
Cache hit
       ↓
Không gọi AI lại
       ↓
Tiết kiệm chi phí
```

Nếu có Dashboard cost thì hướng dẫn cách xem.

---

# 28. AI Budget

Nếu có:

* Daily budget
* Monthly budget
* Limit
* Warning
* Block request

Giải thích cách cấu hình.

---

# 29. Analytics

Hướng dẫn:

* Video count
* Render statistics
* AI usage
* Cost
* Publishing
* YouTube analytics

Chỉ mô tả metric thực tế có trong code.

---

# 30. Backup & Restore

Nếu có:

Giải thích:

### Backup

```bash
...
```

### Restore

```bash
...
```

Cảnh báo:

> Không restore production database nếu chưa backup dữ liệu hiện tại.

Nếu command chưa được kiểm chứng thì đánh dấu:

> Chưa verified.

---

# 31. Storage

Giải thích nơi lưu file.

Ví dụ:

```text
storage/
├── documents/
├── images/
├── audio/
├── videos/
├── subtitles/
├── thumbnails/
├── cache/
└── exports/
```

Chỉ đưa những thư mục thực sự tồn tại.

Giải thích:

* File upload nằm ở đâu?
* Video render nằm ở đâu?
* Cache nằm ở đâu?
* Có persistence sau Docker restart không?

---

# 32. Xử lý lỗi thường gặp

Tạo bảng:

| Lỗi                       | Nguyên nhân | Cách xử lý |
| ------------------------- | ----------- | ---------- |
| Login failed              | ...         | ...        |
| MongoDB connection failed | ...         | ...        |
| AI request failed         | ...         | ...        |
| TTS failed                | ...         | ...        |
| Render failed             | ...         | ...        |
| Upload failed             | ...         | ...        |
| YouTube OAuth failed      | ...         | ...        |

Không đưa workaround nguy hiểm.

Đặc biệt:

## MongoDB

TUYỆT ĐỐI không hướng dẫn:

```bash
docker compose down -v
docker volume rm ...
dropDatabase()
```

trừ khi có cảnh báo cực kỳ rõ ràng và chỉ dùng khi người dùng chủ động muốn reset toàn bộ database.

Ưu tiên:

* kiểm tra connection string
* kiểm tra credentials
* kiểm tra container
* kiểm tra logs.

---

# 33. Kiểm tra hệ thống

Tạo checklist:

```text
[ ] Docker đang chạy
[ ] MongoDB đang chạy
[ ] Web đang chạy
[ ] Worker đang chạy
[ ] FFmpeg hoạt động
[ ] Login hoạt động
[ ] Upload hoạt động
[ ] AI provider hoạt động
[ ] TTS hoạt động
[ ] Render hoạt động
[ ] YouTube OAuth hoạt động
```

Đánh dấu trạng thái hiện tại dựa trên kiểm chứng thực tế.

---

# 34. Quy trình tạo video hoàn chỉnh

Đây phải là phần quan trọng nhất của tài liệu.

Viết thành tutorial:

## Từ bài học → YouTube Short

Ví dụ:

```text
1. Login
2. Tạo Subject
3. Tạo Grade
4. Tạo Textbook
5. Tạo Lesson
6. Upload source document
7. Analyze lesson
8. Generate script
9. Review script
10. Approve script
11. Generate storyboard
12. Select/reuse assets
13. Generate TTS
14. Generate subtitle
15. Render video
16. Review video
17. Approve
18. Connect YouTube
19. Upload
```

Mỗi bước phải có:

* Người dùng thao tác gì?
* Kết quả mong đợi?
* Nếu lỗi thì kiểm tra gì?

---

# 35. Workflow khuyến nghị

Đưa ra workflow tối ưu để giảm chi phí AI:

```text
1. Chuẩn hóa lesson
2. Upload source
3. AI analysis
4. Generate script
5. Review trước khi tiếp tục
6. Storyboard
7. Reuse Asset Library
8. Chỉ generate asset thiếu
9. Generate TTS
10. Render local
11. Review
12. Upload YouTube
```

Nhấn mạnh:

> Không nên generate hình ảnh/TTS trước khi script và storyboard được duyệt.

---

# 36. FAQ

Tạo FAQ dựa trên code thực tế.

Ví dụ:

* Tại sao AI không chạy?
* Mock AI là gì?
* Làm sao chuyển sang real AI?
* Vì sao render lâu?
* Vì sao video không upload YouTube?
* Cache hoạt động như thế nào?
* Làm sao giảm chi phí AI?
* File upload được lưu ở đâu?
* Restart Docker có mất dữ liệu không?
* Làm sao backup?

---

# 37. Trạng thái tính năng hiện tại

Cuối tài liệu tạo bảng:

| Module          | Status | Ghi chú |
| --------------- | ------ | ------- |
| Authentication  | ...    | ...     |
| Dashboard       | ...    | ...     |
| Subject         | ...    | ...     |
| Grade           | ...    | ...     |
| Textbook        | ...    | ...     |
| Lesson          | ...    | ...     |
| Source Document | ...    | ...     |
| AI Analysis     | ...    | ...     |
| Script          | ...    | ...     |
| Storyboard      | ...    | ...     |
| Asset           | ...    | ...     |
| TTS             | ...    | ...     |
| Subtitle        | ...    | ...     |
| Render          | ...    | ...     |
| Video Studio    | ...    | ...     |
| YouTube         | ...    | ...     |
| Batch           | ...    | ...     |
| Analytics       | ...    | ...     |
| Backup          | ...    | ...     |

Status phải lấy từ kết quả audit thực tế.

---

# 38. QUY TẮC VỀ TÍNH CHÍNH XÁC

Trước khi hoàn thành `USER_GUIDE.md`, hãy kiểm tra:

### Code

```text
Routes
API
Models
Services
Components
Worker
Docker
Scripts
.env.example
README
docs
```

### Không được

* Bịa UI.
* Bịa button.
* Bịa API.
* Bịa environment variable.
* Bịa command.
* Bịa provider.
* Bịa workflow.
* Bịa trạng thái "completed".
* Bịa khả năng YouTube.
* Bịa AI provider.

### Phải

Nếu chưa biết:

```text
CHƯA VERIFY
```

Nếu chưa implement:

```text
CHƯA TRIỂN KHAI
```

Nếu chỉ mock:

```text
MOCK ONLY
```

Nếu UI có nhưng backend chưa có:

```text
UI ONLY
```

Nếu API có nhưng UI chưa có:

```text
API ONLY
```

---

# 39. KHÔNG CHỈ TẠO TÀI LIỆU

Sau khi tạo `docs/USER_GUIDE.md`, hãy kiểm tra tài liệu có khớp project không.

Thực hiện:

```text
1. Scan source
2. Tạo USER_GUIDE.md
3. Kiểm tra command trong tài liệu
4. Kiểm tra route trong tài liệu
5. Kiểm tra environment variables
6. Kiểm tra workflow
7. Kiểm tra trạng thái feature
8. Chạy test/build nếu có thể
9. Sửa tài liệu nếu phát hiện sai
```

---

# 40. CẬP NHẬT README

Nếu `README.md` chưa có phần hướng dẫn người dùng:

Thêm section:

```markdown
## User Guide

Xem:
[docs/USER_GUIDE.md](docs/USER_GUIDE.md)
```

Không thay đổi các phần README không liên quan.

---

# 41. TẠO QUICK START

Ngoài `USER_GUIDE.md`, tạo:

```text
docs/QUICK_START.md
```

Quick Start phải ngắn, giúp người dùng chạy hệ thống trong khoảng 5–10 phút.

Bao gồm:

```text
1. Start Docker
2. Start project
3. Open browser
4. Login
5. Create lesson
6. Upload document
7. Run pipeline
8. Render video
```

Chỉ đưa những bước thực sự hoạt động.

---

# 42. OUTPUT CUỐI CÙNG

Sau khi hoàn thành, báo cáo:

```text
USER GUIDE:
docs/USER_GUIDE.md

QUICK START:
docs/QUICK_START.md
```

Sau đó báo cáo:

### Features verified

### Features not verified

### Features not implemented

### Features mock-only

### Broken features

### Documentation assumptions

### Commands tested

### Routes tested

### Final recommendation

Quan trọng:

**Không được nói "hoàn thành" chỉ vì file Markdown đã được tạo.**

Mục tiêu là tạo tài liệu phản ánh **đúng 100% khả năng sử dụng thực tế của project tại thời điểm hiện tại**.

